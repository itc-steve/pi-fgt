/** Response size guards + field projection. */

import { DEFAULT_MAX_RESPONSE_BYTES, PER_PAGE_CAP } from "./types.js";
import { deepTrim } from "./summarize.js";
import { clampPerPage as clampPerPageValidate } from "./validate.js";

/** @deprecated Prefer import from validate.js — kept for any external callers. */
export function clampPerPage(n: number, cap = PER_PAGE_CAP): number {
	return clampPerPageValidate(n, cap);
}

export function project(items: any, keep: Set<string>, verbose?: boolean): any {
	if (verbose || !Array.isArray(items)) return items;
	return items
		.filter((item: any) => item && typeof item === "object")
		.map((item: any) => {
			const out: Record<string, any> = {};
			for (const k of keep) {
				if (k in item) out[k] = item[k];
			}
			return out;
		});
}

function jsonSize(payload: unknown): number {
	try {
		return JSON.stringify(payload, (_k, v) =>
			typeof v === "bigint" ? v.toString() : v,
		).length;
	} catch {
		return Number.MAX_SAFE_INTEGER;
	}
}

/**
 * Cap payload size. Prefers structured truncation over raw string preview.
 */
export function bounded(
	payload: any,
	hint = "Narrow the query: filter by name/id, lower count, or request a single object.",
	maxBytes = DEFAULT_MAX_RESPONSE_BYTES,
): any {
	if (jsonSize(payload) <= maxBytes) return payload;

	// 1) list → keep leading items that fit (budget for envelope keys/hint)
	if (Array.isArray(payload)) {
		const envelopeOverhead = 180 + (hint?.length || 0);
		const budget = Math.max(1000, maxBytes - envelopeOverhead);
		const kept: any[] = [];
		let running = 2;
		for (const item of payload) {
			const chunk = jsonSize(item) + 1;
			if (running + chunk > budget) break;
			kept.push(item);
			running += chunk;
		}
		return {
			_truncated: true,
			_returned: kept.length,
			_total: payload.length,
			_bytes_cap: maxBytes,
			_hint: hint,
			data: kept,
		};
	}

	// 2) object → deep-trim arrays then re-check
	const trimmed = deepTrim(payload, 15);
	if (jsonSize(trimmed) <= maxBytes) {
		return {
			_truncated: true,
			_bytes_cap: maxBytes,
			_hint: hint,
			data: trimmed,
		};
	}

	// 3) last resort: compact string preview (small)
	const previewBudget = Math.min(4000, maxBytes);
	let raw: string;
	try {
		raw = JSON.stringify(trimmed);
	} catch {
		raw = String(trimmed);
	}
	return {
		_truncated: true,
		_original_bytes: raw.length,
		_bytes_cap: maxBytes,
		_hint: hint,
		preview: raw.slice(0, previewBudget),
	};
}

/** Final hard cap on tool text returned to the model (chars). */
export function hardCapText(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return (
		text.slice(0, maxChars) +
		`\n…[truncated ${text.length}→${maxChars} chars; raise maxResponseBytes or narrow query]`
	);
}
