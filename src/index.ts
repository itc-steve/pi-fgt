/**
 * pi-fgt entry.
 * Registers all FortiGate tools, then keeps them OFF by default each session.
 * Toggle with: /fortigate [on|off|toggle|status]
 * Footer status only shows when ON.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadConfig, listDevices } from "./config.js";
import { showDevicePicker } from "./device-picker.js";
import { FORTIGATE_TOOL_NAMES, FORTIGATE_TOOL_NAME_SET } from "./tool-names.js";
import { registerSystemTools } from "./tools/system.js";
import { registerNetworkTools } from "./tools/network.js";
import { registerFirewallTools } from "./tools/firewall.js";
import { registerVpnTools } from "./tools/vpn.js";
import { registerWirelessTools } from "./tools/wireless.js";
import { registerSwitchTools } from "./tools/switch.js";
import { registerSecurityTools } from "./tools/security.js";
import { registerAdminTools } from "./tools/admin.js";
import { registerLogTools } from "./tools/logs.js";
import { registerEscapeTools } from "./tools/escape.js";
import { registerSystemHealthTools } from "./tools/system_health.js";
import { registerSystemFabricTools } from "./tools/system_fabric.js";
import { registerRouterTools } from "./tools/router.js";
import { registerSdwanVpnTools } from "./tools/sdwan_vpn.js";
import { registerFirewallMonitorTools } from "./tools/firewall_monitor.js";
import { registerUserTools } from "./tools/users.js";
import { registerWifiTools } from "./tools/wifi.js";
import { registerSwitchMonitorTools } from "./tools/switch_monitor.js";
import { registerUtmEndpointTools } from "./tools/utm_endpoint.js";
import { registerMiscTools } from "./tools/misc.js";

/** Session-local enabled flag (resets every session_start). */
let enabledThisSession = false;

function isFortiGateActive(pi: ExtensionAPI): boolean {
	const active = new Set(pi.getActiveTools());
	return FORTIGATE_TOOL_NAMES.some((n) => active.has(n));
}

function setFortiGateEnabled(pi: ExtensionAPI, on: boolean): void {
	const active = pi.getActiveTools();
	const withoutFg = active.filter((n) => !FORTIGATE_TOOL_NAME_SET.has(n));
	if (on) {
		const registered = new Set(pi.getAllTools().map((t) => t.name));
		const toAdd = FORTIGATE_TOOL_NAMES.filter((n) => registered.has(n));
		pi.setActiveTools([...new Set([...withoutFg, ...toAdd])]);
		enabledThisSession = true;
	} else {
		pi.setActiveTools(withoutFg);
		enabledThisSession = false;
	}
}

/** Clear footer chip when off (empty string removes status). */
function clearStatus(ctx: ExtensionContext): void {
	ctx.ui.setStatus("fortigate", "");
}

/** Footer only when tools ON this session. */
function updateStatus(ctx: ExtensionContext): void {
	if (!enabledThisSession) {
		clearStatus(ctx);
		return;
	}
	try {
		const devs = listDevices().map((d) => d.name);
		const devPart = devs.length > 0 ? devs.join(", ") : "no visible devices";
		ctx.ui.setStatus("fortigate", `fortigate: ON (${devPart})`);
	} catch {
		ctx.ui.setStatus("fortigate", "fortigate: ON");
	}
}

function parseArgs(args: unknown): string {
	if (Array.isArray(args)) return args.join(" ").trim().toLowerCase();
	return String(args ?? "").trim().toLowerCase();
}

export default function (pi: ExtensionAPI): void {
	registerSystemTools(pi);
	registerNetworkTools(pi);
	registerFirewallTools(pi);
	registerVpnTools(pi);
	registerWirelessTools(pi);
	registerSwitchTools(pi);
	registerSecurityTools(pi);
	registerAdminTools(pi);
	registerLogTools(pi);
	registerEscapeTools(pi);
	registerSystemHealthTools(pi);
	registerSystemFabricTools(pi);
	registerRouterTools(pi);
	registerSdwanVpnTools(pi);
	registerFirewallMonitorTools(pi);
	registerUserTools(pi);
	registerWifiTools(pi);
	registerSwitchMonitorTools(pi);
	registerUtmEndpointTools(pi);
	registerMiscTools(pi);

	pi.on("session_start", (_event, ctx) => {
		try {
			const cfg = loadConfig(true);
			const wantOn = cfg.sessionDefault === "on";
			setFortiGateEnabled(pi, wantOn);
			updateStatus(ctx);
		} catch {
			setFortiGateEnabled(pi, false);
			clearStatus(ctx);
		}
	});

	const handleCommand = async (args: unknown, ctx: ExtensionContext) => {
		const cmd = parseArgs(args) || "toggle";
		const currentlyOn = isFortiGateActive(pi);

		if (cmd === "devices" || cmd === "d" || cmd === "select" || cmd === "pick") {
			if (!ctx.hasUI) {
				ctx.ui.notify("Device picker needs an interactive UI.", "warn");
				return;
			}
			await showDevicePicker(ctx);
			updateStatus(ctx);
			return;
		}

		if (cmd === "status" || cmd === "s") {
			const cfg = loadConfig();
			const visible = listDevices().map((d) => d.name);
			const total = Object.keys(cfg.devices || {}).length;
			const hiddenCount = total - visible.length;
			ctx.ui.notify(
				`FortiGate tools: ${currentlyOn ? "ON" : "OFF"} | sessionDefault=${cfg.sessionDefault ?? "off"} | visible=[${visible.join(", ") || "none"}]${hiddenCount > 0 ? ` | ${hiddenCount} hidden` : ""}`,
				"info",
			);
			enabledThisSession = currentlyOn;
			updateStatus(ctx);
			return;
		}

		if (cmd === "on" || cmd === "enable" || cmd === "1") {
			setFortiGateEnabled(pi, true);
			updateStatus(ctx);
			ctx.ui.notify("FortiGate tools ON (this session)", "success");
			return;
		}

		if (cmd === "off" || cmd === "disable" || cmd === "0") {
			setFortiGateEnabled(pi, false);
			updateStatus(ctx);
			ctx.ui.notify("FortiGate tools OFF (this session)", "info");
			return;
		}

		if (cmd === "toggle" || cmd === "t") {
			const next = !currentlyOn;
			setFortiGateEnabled(pi, next);
			updateStatus(ctx);
			ctx.ui.notify(
				next ? "FortiGate tools ON (this session)" : "FortiGate tools OFF (this session)",
				next ? "success" : "info",
			);
			return;
		}

		ctx.ui.notify(
			"Usage: /fortigate [on|off|toggle|status|devices]  — 'devices' opens the visibility picker. Default each session is off.",
			"warn",
		);
	};

	const SUBCOMMANDS: Array<{ value: string; description: string }> = [
		{ value: "on", description: "Enable FortiGate tools this session" },
		{ value: "off", description: "Disable FortiGate tools this session" },
		{ value: "toggle", description: "Flip FortiGate tools on/off" },
		{ value: "status", description: "Show on/off + visible/hidden devices" },
		{ value: "devices", description: "Open the device visibility picker" },
	];

	const getArgumentCompletions = (prefix: string) => {
		const p = String(prefix ?? "").trim().toLowerCase();
		const items = SUBCOMMANDS.filter((s) => s.value.startsWith(p)).map((s) => ({
			value: s.value,
			label: s.value,
			description: s.description,
		}));
		return items.length > 0 ? items : null;
	};

	pi.registerCommand("fortigate", {
		description:
			"FortiGate tools: /fortigate [on|off|toggle|status|devices]",
		getArgumentCompletions,
		handler: handleCommand as any,
	});
}
