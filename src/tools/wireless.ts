/** Wireless / FortiAP tools (2). FortiOS 7.4: monitor/wifi/*. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export function registerWirelessTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "get_fortiaps",
		label: "FortiGate: FortiAPs",
		description:
			"Managed FortiAPs (monitor/wifi/managed_ap). " +
			"Returns serial, IP (local_ipv4_addr), client count, status, MAC. Prefer this over escape hatches.",
		promptSnippet: "FortiGate FortiAP list (serial/IP/clients)",
		parameters: Type.Object({
			...deviceParam,
			verbose: Type.Optional(Type.Boolean({ description: "Include radio/details" })),
		}),
		async execute(_id, params, signal) {
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data = fortiResults(
				await fortiGet("monitor/wifi/managed_ap", dev, token, {}, signal),
			);
			data = bounded(
				data,
				"Use verbose=true for radios, or get_wifi_clients for stations.",
				getMaxResponseBytes(),
			);
			return textResult(data, { device: name, path: "monitor/wifi/managed_ap" });
		},
	});

	pi.registerTool({
		name: "get_wifi_clients",
		label: "FortiGate: WiFi Clients",
		description:
			"Connected WiFi stations (monitor/wifi/client). Optional filter by AP serial (wtp_id) or SSID (substring).",
		promptSnippet: "FortiGate WiFi client stations",
		parameters: Type.Object({
			...deviceParam,
			ap: Type.Optional(
				Type.String({ description: "Filter by AP serial / wtp_id / name (substring)" }),
			),
			ssid: Type.Optional(
				Type.String({
					description: "Filter by SSID or VAP name (substring, case-insensitive)",
				}),
			),
			verbose: Type.Optional(Type.Boolean({ description: "Full client records" })),
		}),
		async execute(_id, params, signal) {
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data = fortiResults(
				await fortiGet("monitor/wifi/client", dev, token, {}, signal),
			);
			if (Array.isArray(data)) {
				const ap = String(params.ap || "").trim().toLowerCase();
				const ssid = String(params.ssid || "").trim().toLowerCase();
				if (ap) {
					data = data.filter((c: any) => {
						const hay = `${c?.wtp_id || ""} ${c?.wtp_name || ""} ${c?.serial || ""}`.toLowerCase();
						return hay.includes(ap);
					});
				}
				if (ssid) {
					// substring: "Shield" matches Shield_optout_nomap; also match vap_name
					data = data.filter((c: any) => {
						const hay = `${c?.ssid || ""} ${c?.vap_name || ""}`.toLowerCase();
						return hay.includes(ssid);
					});
				}
			}
			data = bounded(
				data,
				"Filter with ap= or ssid= to narrow large client lists.",
				getMaxResponseBytes(),
			);
			return textResult(data, { device: name, path: "monitor/wifi/client" });
		},
	});
}
