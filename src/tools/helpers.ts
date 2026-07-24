/** Shared helpers — always size-cap tool output. */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded, hardCapText, project, stripNoise } from "../bounds.js";
import { summarizeResourceUsage } from "../summarize.js";

export const deviceParam = {
	device: Type.Optional(
		Type.String({
			description:
				"Device key from fortigate.json (optional if only one device). Example: edge",
		}),
	),
};

/** True when payload already went through bounded() (avoid double-wrap / hint loss). */
function alreadyBounded(data: unknown): boolean {
	return (
		!!data &&
		typeof data === "object" &&
		!Array.isArray(data) &&
		((data as { _truncated?: boolean })._truncated === true ||
			(data as { _bytes_cap?: number })._bytes_cap != null)
	);
}

/** Compact JSON (no pretty-print). Never mid-slice JSON (invalid parse = P0 agent break). */
export function textResult(data: unknown, details: Record<string, unknown> = {}) {
	const max = getMaxResponseBytes();
	const defaultHint = "Response too large; narrow query or raise maxResponseBytes.";

	if (typeof data === "string") {
		return { content: [{ type: "text", text: hardCapText(data, max) }], details };
	}

	// Global: drop q_origin_key + empty-string keys before bound/serialize
	data = stripNoise(data);

	// Bound once — callers may already have called bounded() with a better hint
	let payload: unknown = alreadyBounded(data) ? data : bounded(data, defaultHint, max);
	let text = JSON.stringify(payload);

	// Envelope overhead can still push past max; re-bound inner data, never chop JSON
	if (text.length > max) {
		const inner =
			payload &&
			typeof payload === "object" &&
			!Array.isArray(payload) &&
			"data" in (payload as object)
				? (payload as { data: unknown }).data
				: payload;
		const prevHint =
			payload && typeof payload === "object" && !Array.isArray(payload)
				? (payload as { _hint?: string })._hint
				: undefined;
		payload = bounded(inner, prevHint || defaultHint, Math.max(4000, Math.floor(max * 0.8)));
		text = JSON.stringify(payload);
	}
	if (text.length > max) {
		text = JSON.stringify({
			_truncated: true,
			_bytes_cap: max,
			_hint: defaultHint,
			preview: text.slice(0, Math.min(4000, max - 200)),
		});
	}

	return { content: [{ type: "text", text }], details };
}

export async function runForti(
	apiPath: string,
	params: any,
	signal: AbortSignal,
	onUpdate: ((u: any) => void) | undefined,
	ctx: ExtensionContext,
	opts: {
		query?: Record<string, unknown>;
		useResults?: boolean;
		projectKeep?: Set<string>;
		verbose?: boolean;
		boundHint?: string;
		/** Collapse FortiOS resource time-series to latest sample */
		summarizeResources?: boolean;
	} = {},
) {
	try {
		const { name, device: dev } = resolveDevice(params?.device);
		const token = getToken(dev);
		// Don't stomp ON status with transient "fg:name" while tools run if status is managed by toggle
		onUpdate?.({ content: [{ type: "text", text: `*fg ${name} ${apiPath}*` }] });

		let data: unknown = await fortiGet(apiPath, dev, token, opts.query || {}, signal);

		if (opts.summarizeResources) {
			data = summarizeResourceUsage(data);
		} else if (opts.useResults) {
			data = fortiResults(data);
		}

		if (opts.projectKeep) {
			data = project(
				data,
				opts.projectKeep,
				!!opts.verbose || !!params?.verbose,
			);
		}

		// Always bound — never dump unbounded FortiOS JSON into model context
		const max = getMaxResponseBytes();
		data = bounded(
			data,
			opts.boundHint ||
				"Narrow the query / lower count / use a single-object tool. Or set maxResponseBytes in fortigate.json.",
			max,
		);

		return textResult(data, { device: name, path: apiPath });
	} catch (e: any) {
		if (e?.name === "AbortError") throw e;
		return textResult(`Error: ${e?.message || String(e)}`);
	}
}
