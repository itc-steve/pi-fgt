/** FortiSwitch / FortiLink tools (2). FortiOS 7.4: monitor/switch-controller/*. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";


function matchSwitch(row: any, needle: string): boolean {
	const n = needle.toLowerCase();
	const hay = `${row?.["switch-id"] || ""} ${row?.serial || ""} ${row?.name || ""}`.toLowerCase();
	return hay.includes(n);
}

export function registerSwitchTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "get_fortiswitches",
		label: "FortiGate: FortiSwitches",
		description:
			"Managed FortiSwitches via FortiLink (monitor/switch-controller/managed-switch/status). " +
			"Summary without per-port detail. Prefer this over escape hatches.",
		promptSnippet: "FortiGate FortiSwitch / FortiLink status",
		parameters: Type.Object({
			...deviceParam,
			verbose: Type.Optional(Type.Boolean({ description: "Include full switch records (ports)" })),
		}),
		async execute(_id, params, signal) {
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data = fortiResults(
				await fortiGet(
					"monitor/switch-controller/managed-switch/status",
					dev,
					token,
					{},
					signal,
				),
			);
			// Replace the heavy ports[] array with counts; field selection itself
			// is config-driven (filters tools.get_fortiswitches.allowlist).
			if (!params.verbose && Array.isArray(data)) {
				data = data.map((sw: any) => {
					const { ports: rawPorts, ...rest } = sw ?? {};
					const ports = Array.isArray(rawPorts) ? rawPorts : [];
					return {
						...rest,
						port_count: ports.length,
						ports_up: ports.filter((p: any) => p?.status === "up").length,
					};
				});
			}
			data = bounded(
				data,
				"Use get_switch_port_status for per-port detail.",
				getMaxResponseBytes(),
			);
			return textResult(data, {
				device: name,
				path: "monitor/switch-controller/managed-switch/status",
			});
		},
	});

	pi.registerTool({
		name: "get_switch_port_status",
		label: "FortiGate: Switch Ports",
		description:
			"FortiSwitch port status (from managed-switch/status). " +
			"Prefer up_only=true for 'what's connected' (~80% smaller); full list only for down-port audits.",
		promptSnippet: "FortiGate FortiSwitch port status",
		parameters: Type.Object({
			...deviceParam,
			switch: Type.Optional(
				Type.String({ description: "Switch serial / switch-id (substring)" }),
			),
			up_only: Type.Optional(Type.Boolean({ description: "Only ports with status=up" })),
			verbose: Type.Optional(Type.Boolean({ description: "Full port records" })),
		}),
		async execute(_id, params, signal) {
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data = fortiResults(
				await fortiGet(
					"monitor/switch-controller/managed-switch/status",
					dev,
					token,
					{},
					signal,
				),
			);
			const swNeedle = String(params.switch || "").trim();
			const upOnly = !!params.up_only;
			const out: any[] = [];
			if (Array.isArray(data)) {
				for (const sw of data) {
					if (swNeedle && !matchSwitch(sw, swNeedle)) continue;
					const ports = Array.isArray(sw.ports) ? sw.ports : [];
					for (const p of ports) {
						if (upOnly && p?.status !== "up") continue;
						const row: Record<string, unknown> = { ...p };
						row.switch_id = sw["switch-id"] || sw.serial;
						row.switch_serial = sw.serial;
						out.push(row);
					}
				}
			}
			data = bounded(
				out,
				"Filter with switch= serial and/or up_only=true.",
				getMaxResponseBytes(),
			);
			return textResult(data, {
				device: name,
				path: "monitor/switch-controller/managed-switch/status",
			});
		},
	});
}
