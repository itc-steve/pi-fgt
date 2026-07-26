/**
 * Wrap pi.registerTool once so every FortiGate tool runs inside an
 * AsyncLocalStorage context carrying its own name + verbose flag.
 *
 * ponytail: proxying the API beats editing 191 execute() bodies, and new
 * tools are covered automatically instead of silently missing per-tool rules.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { withToolContext } from "./index.js";

export function withFilterContext(pi: ExtensionAPI): ExtensionAPI {
	const original = pi.registerTool.bind(pi);

	const patched = (tool: any) => {
		const execute = tool?.execute;
		if (typeof execute !== "function") return original(tool);

		return original({
			...tool,
			execute(
				toolCallId: string,
				params: any,
				signal: AbortSignal,
				onUpdate: any,
				ctx: any,
			) {
				return withToolContext(tool.name, !!params?.verbose, () =>
					execute.call(tool, toolCallId, params, signal, onUpdate, ctx),
				);
			},
		});
	};

	return new Proxy(pi, {
		get(target, prop, receiver) {
			if (prop === "registerTool") return patched;
			return Reflect.get(target, prop, receiver);
		},
	}) as ExtensionAPI;
}
