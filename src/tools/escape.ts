/** Escape-hatch reads + explicit write refusal (3). Prefer typed tools first. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults, PATH_HINTS } from "../client.js";
import { bounded } from "../bounds.js";
import { validatePath } from "../validate.js";

const READ_ONLY_REFUSAL = "This server is read-only. Operation refused.";

export function registerEscapeTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "get_config_object",
		label: "FortiGate: Config Object",
		description:
			"Read any cmdb object by bare path (GET cmdb/<path>). " +
			"Examples: firewall/policy, wireless-controller/wtp, switch-controller/managed-switch. " +
			"No api/v2 prefix, no query string. Prefer typed tools (get_fortiaps, get_fortiswitches, …) when available. VDOM-pinned.",
		promptSnippet: "FortiGate generic cmdb GET",
		parameters: Type.Object({
			...deviceParam,
			path: Type.String({ description: "Bare cmdb path e.g. firewall/policy (no api/v2)" }),
		}),
		async execute(_id, params, signal) {
			try {
				const p = validatePath(params.path);
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet(`cmdb/${p}`, dev, token, {}, signal));
				data = bounded(
					data,
					"Append an object name/id to the path to fetch a single record. " + PATH_HINTS,
					getMaxResponseBytes(),
				);
				return textResult(data, { device: name, path: `cmdb/${p}` });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_monitor_resource",
		label: "FortiGate: Monitor Resource",
		description:
			"Read any monitor resource by bare path (GET monitor/<path>). " +
			"Examples: wifi/managed_ap, switch-controller/managed-switch/status, system/status. " +
			"No api/v2 prefix. Prefer typed tools when available. VDOM-pinned. Read-only.",
		promptSnippet: "FortiGate generic monitor GET",
		parameters: Type.Object({
			...deviceParam,
			path: Type.String({ description: "Bare monitor path e.g. wifi/managed_ap (no api/v2)" }),
		}),
		async execute(_id, params, signal) {
			try {
				const p = validatePath(params.path);
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet(`monitor/${p}`, dev, token, {}, signal));
				data = bounded(
					data,
					"Prefer typed tools for paging/filters. " + PATH_HINTS,
					getMaxResponseBytes(),
				);
				return textResult(data, { device: name, path: `monitor/${p}` });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "attempt_write_operation",
		label: "FortiGate: Write Refusal",
		description:
			"Always refuses. Proves read-only stance. Performs no network I/O.",
		promptSnippet: "FortiGate write refusal (always fails)",
		parameters: Type.Object({
			method: Type.Optional(Type.String({ description: "HTTP verb attempted", default: "POST" })),
			path: Type.Optional(Type.String({ description: "Path attempted", default: "/example" })),
		}),
		async execute(_id, params) {
			const method = String(params.method || "POST").toUpperCase();
			const path = String(params.path || "/example");
			return textResult(`${READ_ONLY_REFUSAL} (attempted ${method} ${path})`);
		},
	});
}
