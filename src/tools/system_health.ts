/** System health read-only tools (18). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export const SYSTEM_HEALTH_TOOL_NAMES = [
	"get_system_performance_status",
	"get_vm_information",
	"get_system_storage",
	"get_global_resources",
	"get_vdom_resources",
	"get_running_processes",
	"get_current_admins",
	"get_ntp_status",
	"get_system_timezone",
	"get_link_monitors",
	"get_interface_poe",
	"get_interface_transceivers",
	"get_available_interfaces",
	"get_acquired_dns",
	"get_traffic_history_interface",
	"get_top_applications",
	"get_resolve_fqdn",
	"get_ipconf",
] as const;

export function registerSystemHealthTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "get_system_performance_status",
		label: "FortiGate: System Performance Status",
		description:
			"CPU per-core + mem/session snapshot (monitor/system/performance/status). " +
			"Prefer this or get_system_resource_usage for 'is the box busy?' questions. Read-only.",
		promptSnippet: "FortiGate system performance status",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/performance/status", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/performance/status" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_vm_information",
		label: "FortiGate: VM Information",
		description: "VM information (monitor/system/vm-information). Read-only.",
		promptSnippet: "FortiGate VM information",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/vm-information", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/vm-information" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_system_storage",
		label: "FortiGate: System Storage",
		description: "System storage (monitor/system/storage). Read-only.",
		promptSnippet: "FortiGate system storage",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/storage", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/storage" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_global_resources",
		label: "FortiGate: Global Resources",
		description: "Global resources (monitor/system/global-resources). Read-only.",
		promptSnippet: "FortiGate global resources",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/global-resources", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/global-resources" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_vdom_resources",
		label: "FortiGate: VDOM Resources",
		description: "VDOM resources (monitor/system/vdom-resource). Read-only.",
		promptSnippet: "FortiGate VDOM resources",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/vdom-resource", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/vdom-resource" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_running_processes",
		label: "FortiGate: Running Processes",
		description: "Running processes (monitor/system/running-processes). Can be large. Read-only.",
		promptSnippet: "FortiGate running processes",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/running-processes", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/running-processes" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_current_admins",
		label: "FortiGate: Current Admins",
		description: "Current admins (monitor/system/current-admins). Read-only.",
		promptSnippet: "FortiGate current admins",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/current-admins", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/current-admins" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_ntp_status",
		label: "FortiGate: NTP Status",
		description: "NTP status (monitor/system/ntp/status). Read-only.",
		promptSnippet: "FortiGate NTP status",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/ntp/status", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/ntp/status" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_system_timezone",
		label: "FortiGate: System Timezone",
		description: "System timezone (monitor/system/timezone). Read-only.",
		promptSnippet: "FortiGate system timezone",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/timezone", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/timezone" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_link_monitors",
		label: "FortiGate: Link Monitors",
		description:
			"Link monitors (monitor/system/link-monitor). Empty {} means none configured — check SD-WAN members instead. Read-only.",
		promptSnippet: "FortiGate link monitors",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data: any = fortiResults(await fortiGet("monitor/system/link-monitor", dev, token, {}, signal));
				if (
					data &&
					typeof data === "object" &&
					!Array.isArray(data) &&
					Object.keys(data).length === 0
				) {
					data = {
						_empty: true,
						_hint:
							"No link-monitor probes configured. For WAN health use get_sdwan_members / get_sdwan_health_check / get_dns_latency.",
					};
				}
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/link-monitor" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_interface_poe",
		label: "FortiGate: Interface POE",
		description:
			"Interface POE status (monitor/system/interface/poe). 404 on models without FGT-side PoE — use get_switch_health / port status for FortiSwitch PoE. Read-only.",
		promptSnippet: "FortiGate interface POE",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/interface/poe", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/interface/poe" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				const msg = String(e?.message || e);
				if (/404/.test(msg)) {
					return textResult(
						"Error: FGT interface PoE monitor not available (404). For FortiSwitch PoE use get_switch_health / get_switch_port_status.",
					);
				}
				return textResult(`Error: ${msg}`);
			}
		},
	});

	pi.registerTool({
		name: "get_interface_transceivers",
		label: "FortiGate: Interface Transceivers",
		description: "Interface transceivers (monitor/system/interface/transceivers). Read-only.",
		promptSnippet: "FortiGate interface transceivers",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/interface/transceivers", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/interface/transceivers" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_available_interfaces",
		label: "FortiGate: Available Interfaces",
		description: "Available interfaces (monitor/system/available-interfaces). Read-only.",
		promptSnippet: "FortiGate available interfaces",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/available-interfaces", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/available-interfaces" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_acquired_dns",
		label: "FortiGate: Acquired DNS",
		description: "Acquired DNS (monitor/system/acquired-dns). Read-only.",
		promptSnippet: "FortiGate acquired DNS",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/acquired-dns", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/acquired-dns" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_traffic_history_interface",
		label: "FortiGate: Traffic History Interface",
		description: "Traffic history for ONE interface (monitor/system/traffic-history/interface). interface is REQUIRED. Read-only.",
		promptSnippet: "FortiGate traffic history interface",
		parameters: Type.Object({
			...deviceParam,
			interface: Type.String({ description: "Interface name (required, e.g. wan1) — get names from get_interfaces_status" }),
			time_period: Type.Optional(Type.String({ description: "Time period: 10min|hour|day (default hour)" })),
		}),
		async execute(_id, params, signal) {
			try {
				const iface = String(params.interface ?? "").trim();
				if (!iface) {
					return textResult(
						"Error: 'interface' is required. Pick one from get_interfaces_status (e.g. wan1), then call again. The API returns 424 without it.",
					);
				}
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				const q: Record<string, any> = { interface: iface };
				if (params.time_period != null) q.time_period = params.time_period;
				let data = fortiResults(await fortiGet("monitor/system/traffic-history/interface", dev, token, q, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/traffic-history/interface" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				const msg = String(e?.message || e);
				// interface was supplied but API still 424 → history tracking off, not a missing arg
				if (/424/.test(msg) && String(params.interface ?? "").trim()) {
					return textResult(
						`Error: traffic history for interface '${String(params.interface).trim()}' returned 424. ` +
							"On many FGTs this means interface traffic history / FortiView tracking is disabled " +
							"(config), not a bad interface name. Prefer get_fortiview_statistics or live session tools.",
					);
				}
				return textResult(`Error: ${msg}`);
			}
		},
	});

	pi.registerTool({
		name: "get_top_applications",
		label: "FortiGate: Top Applications",
		description: "Top FortiView applications by bandwidth (monitor/system/traffic-history/top-applications). Requires FortiView application bandwidth tracking to be ENABLED on the device — returns 424 if off (a config setting, not a license). Read-only.",
		promptSnippet: "FortiGate top applications",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/traffic-history/top-applications", dev, token, {}, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/traffic-history/top-applications" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				const msg = String(e?.message || e);
				if (/424/.test(msg)) {
					return textResult(
						"Error: top-applications returned 424 — FortiView application bandwidth tracking is disabled " +
							"on this device (config, not a license). Use get_fortiview_statistics or get_firewall_sessions instead.",
					);
				}
				return textResult(`Error: ${msg}`);
			}
		},
	});

	pi.registerTool({
		name: "get_resolve_fqdn",
		label: "FortiGate: Resolve FQDN",
		description:
			"DNS resolve via the FortiGate (monitor/system/resolve-fqdn). fqdn required. " +
			"For firewall FQDN *address object* cache use get_fqdn_addresses(name=). Read-only.",
		promptSnippet: "FortiGate resolve FQDN",
		parameters: Type.Object({
			...deviceParam,
			fqdn: Type.String({ description: "FQDN to resolve" }),
		}),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/resolve-fqdn", dev, token, { fqdn: params.fqdn }, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/resolve-fqdn" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});

	pi.registerTool({
		name: "get_ipconf",
		label: "FortiGate: IP Conf",
		description: "IP configuration (monitor/system/ipconf). ipv4_address required. Read-only.",
		promptSnippet: "FortiGate ipconf",
		parameters: Type.Object({
			...deviceParam,
			ipv4_address: Type.String({ description: "IPv4 address" }),
		}),
		async execute(_id, params, signal) {
			try {
				const { name, device: dev } = resolveDevice(params.device);
				const token = getToken(dev);
				let data = fortiResults(await fortiGet("monitor/system/ipconf", dev, token, { ipv4_address: params.ipv4_address }, signal));
				data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
				return textResult(data, { device: name, path: "monitor/system/ipconf" });
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				return textResult(`Error: ${e?.message || String(e)}`);
			}
		},
	});
}
