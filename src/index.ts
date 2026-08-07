/**
 * pi-fgt entry.
 * Registers all FortiGate tools, then keeps them OFF by default each session.
 * Every device also starts hidden from the AI; /fortigate and /fortigate on
 * open the picker so the human chooses which FortiGates this session exposes.
 * Selection is in-memory only — never saved, never shared between terminals.
 * Footer status only shows when ON.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadConfig, listDevices, resetSessionVisibility } from "./config.js";
import { showDevicePicker } from "./device-picker.js";
import { loadFilters, filtersPath, filtersLoadError } from "./filters/index.js";
import { withFilterContext } from "./filters/wrap.js";
import {
	formatDeviceStatusLines,
	runAddWizard,
	runEditWizard,
	runRemoveWizard,
	runTokenWizard,
} from "./setup-wizard.js";
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
		const devPart = devs.length > 0 ? devs.join(", ") : "no devices selected";
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
	// Every tool registers through a proxy that tags responses with the tool
	// name, so ~/.pi/agent/fortigate-filters.json can apply per-tool rules.
	pi = withFilterContext(pi);

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
			resetSessionVisibility();
			loadFilters(true);
			const cfg = loadConfig(true);
			const wantOn = cfg.sessionDefault === "on";
			setFortiGateEnabled(pi, wantOn);
			updateStatus(ctx);
		} catch {
			setFortiGateEnabled(pi, false);
			clearStatus(ctx);
		}
	});

	/** Turn tools on and let the human pick which FortiGates the AI may see. */
	const enableAndPick = async (ctx: ExtensionContext) => {
		setFortiGateEnabled(pi, true);
		if (!ctx.hasUI) {
			updateStatus(ctx);
			ctx.ui.notify(
				"FortiGate tools ON, but device selection needs an interactive UI — no devices are visible to the AI.",
				"warn",
			);
			return;
		}
		const selected = await showDevicePicker(ctx);
		updateStatus(ctx);
		ctx.ui.notify(
			selected.length
				? `FortiGate ON — AI can see: [${selected.join(", ")}]`
				: "FortiGate ON — no devices selected, so the AI sees none. Run /fortigate again to pick.",
			selected.length ? "success" : "warn",
		);
	};

	const handleCommand = async (args: unknown, ctx: ExtensionContext) => {
		const cmd = parseArgs(args);
		const currentlyOn = isFortiGateActive(pi);

		// Bare /fortigate, /fortigate on, /fortigate devices → enable + pick.
		if (
			!cmd ||
			cmd === "on" ||
			cmd === "enable" ||
			cmd === "1" ||
			cmd === "devices" ||
			cmd === "d" ||
			cmd === "select" ||
			cmd === "pick"
		) {
			await enableAndPick(ctx);
			return;
		}

		if (cmd === "status" || cmd === "s") {
			const cfg = loadConfig();
			const selected = listDevices().map((d) => d.name);
			const total = Object.keys(cfg.devices || {}).length;
			const detail = formatDeviceStatusLines().join("\n");
			ctx.ui.notify(
				[
					`FortiGate tools: ${currentlyOn ? "ON" : "OFF"} | AI can see ${selected.length}/${total}: [${selected.join(", ") || "none"}]`,
					detail,
				].join("\n"),
				"info",
			);
			enabledThisSession = currentlyOn;
			updateStatus(ctx);
			return;
		}

		if (cmd === "add" || cmd === "a") {
			const result = await runAddWizard(ctx);
			if (result.ok) {
				// Successful add selects the device; enable tools so AI can use it.
				setFortiGateEnabled(pi, true);
			}
			updateStatus(ctx);
			return;
		}

		if (cmd === "token" || cmd === "tok") {
			await runTokenWizard(ctx);
			updateStatus(ctx);
			return;
		}

		if (cmd === "edit" || cmd === "e") {
			await runEditWizard(ctx);
			updateStatus(ctx);
			return;
		}

		if (cmd === "remove" || cmd === "rm" || cmd === "del" || cmd === "delete") {
			await runRemoveWizard(ctx);
			updateStatus(ctx);
			return;
		}

		if (cmd === "filters" || cmd === "f") {
			const fc = loadFilters(true);
			const err = filtersLoadError();
			const on: string[] = [];
			const off: string[] = [];
			for (const [n, g] of Object.entries(fc.groups || {})) {
				(g.exclude ? on : off).push(n);
			}
			const tools = Object.keys(fc.tools || {});
			ctx.ui.notify(
				[
					err ? `⚠ ${err}` : `Config: ${filtersPath()}`,
					`Filtering: ${fc.enabled ? "ON" : "OFF"}  |  verbose bypass: ${fc.audit?.verboseBypassesFilters ? "yes" : "no"}`,
					`Excluded groups (${on.length}): ${on.join(", ") || "none"}`,
					`Kept groups (${off.length}): ${off.join(", ") || "none"}`,
					`Per-tool rules: ${tools.join(", ") || "none"}`,
					`Edit that file to change what the AI sees; responses carry _filtered when fields were removed.`,
				].join("\n"),
				err ? "warn" : "info",
			);
			return;
		}

		if (cmd === "off" || cmd === "disable" || cmd === "0") {
			setFortiGateEnabled(pi, false);
			resetSessionVisibility();
			updateStatus(ctx);
			ctx.ui.notify("FortiGate tools OFF, temporary state cleared", "info");
			return;
		}

		if (cmd === "toggle" || cmd === "t") {
			if (currentlyOn) {
				setFortiGateEnabled(pi, false);
				resetSessionVisibility();
				updateStatus(ctx);
				ctx.ui.notify("FortiGate tools OFF, temporary state cleared", "info");
			} else {
				await enableAndPick(ctx);
			}
			return;
		}

		ctx.ui.notify(
			"Usage: /fortigate [on|off|toggle|status|filters|add|token|edit|remove]  — /fortigate opens the device picker. Devices are hidden from the AI until you select them, every session, never saved.",
			"warn",
		);
	};

	const SUBCOMMANDS: Array<{ value: string; description: string }> = [
		{ value: "on", description: "Enable FortiGate tools + pick devices for this session" },
		{ value: "off", description: "Disable FortiGate tools and clear temporary state" },
		{ value: "toggle", description: "Flip FortiGate tools on (with picker) / off" },
		{ value: "status", description: "Show on/off, storage, and credential source (never values)" },
		{ value: "devices", description: "Open the device picker (same as /fortigate)" },
		{ value: "filters", description: "Show which response fields are being excluded, and from where" },
		{ value: "add", description: "Add device (session or persistent) via setup wizard" },
		{ value: "token", description: "Set session/persistent token or clear temporary token" },
		{ value: "edit", description: "Edit device settings in its current storage (no token)" },
		{ value: "remove", description: "Remove a device (optional unused env-key delete)" },
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
			"FortiGate tools + config: /fortigate [on|off|toggle|status|add|token|edit|remove]",
		getArgumentCompletions,
		handler: handleCommand as any,
	});
}
