/** Switch monitor read-only tools (11). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export const SWITCH_MONITOR_TOOL_NAMES = [
  "get_switch_health",
  "get_switch_port_health",
  "get_switch_port_stats",
  "get_switch_transceivers",
  "get_switch_bios",
  "get_switch_dhcp_snooping",
  "get_switch_detected_devices",
  "get_switch_matched_devices",
  "get_switch_nac_stats",
  "get_switch_fsw_firmware",
  "get_switch_isl_lockdown",
] as const;

export function registerSwitchMonitorTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_switch_health",
    label: "FortiGate: Switch Health",
    description: "Managed switch health-check stats (monitor/switch-controller/managed-switch/health-status). Read-only.",
    promptSnippet: "FortiGate switch health",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/managed-switch/health-status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/managed-switch/health-status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_port_health",
    label: "FortiGate: Switch Port Health",
    description: "Switch port health (monitor/switch-controller/managed-switch/port-health). Read-only.",
    promptSnippet: "FortiGate switch port health",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/managed-switch/port-health", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/managed-switch/port-health" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_port_stats",
    label: "FortiGate: Switch Port Stats",
    description: "Switch port stats (monitor/switch-controller/managed-switch/port-stats). Read-only.",
    promptSnippet: "FortiGate switch port stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/managed-switch/port-stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/managed-switch/port-stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_transceivers",
    label: "FortiGate: Switch Transceivers",
    description: "Switch transceivers (monitor/switch-controller/managed-switch/transceivers). Read-only.",
    promptSnippet: "FortiGate switch transceivers",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/managed-switch/transceivers", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/managed-switch/transceivers" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_bios",
    label: "FortiGate: Switch BIOS",
    description: "Switch BIOS (monitor/switch-controller/managed-switch/bios). Read-only.",
    promptSnippet: "FortiGate switch bios",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/managed-switch/bios", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/managed-switch/bios" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_dhcp_snooping",
    label: "FortiGate: Switch DHCP Snooping",
    description: "Switch DHCP snooping (monitor/switch-controller/managed-switch/dhcp-snooping). Read-only.",
    promptSnippet: "FortiGate switch dhcp snooping",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/managed-switch/dhcp-snooping", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/managed-switch/dhcp-snooping" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_detected_devices",
    label: "FortiGate: Switch Detected Devices",
    description:
      "Detected devices (monitor/switch-controller/detected-device). " +
      "Optional mac=/port=/switch= substring filters. Read-only.",
    promptSnippet: "FortiGate switch detected devices",
    parameters: Type.Object({
      ...deviceParam,
      mac: Type.Optional(Type.String({ description: "MAC substring (separators ignored)" })),
      port: Type.Optional(Type.String({ description: "Port name substring (e.g. port21)" })),
      switch: Type.Optional(Type.String({ description: "Switch serial / switch-id substring" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/detected-device", dev, token, {}, signal));
        if (Array.isArray(data)) {
          const mac = String(params.mac || "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
          const port = String(params.port || "").trim().toLowerCase();
          const sw = String(params.switch || "").trim().toLowerCase();
          if (mac || port || sw) {
            data = data.filter((row: any) => {
              if (mac) {
                const rowMac = String(row?.mac || "").toLowerCase().replace(/[^0-9a-f]/g, "");
                if (!rowMac.includes(mac)) return false;
              }
              if (port && !String(row?.port_name || row?.port || "").toLowerCase().includes(port)) return false;
              if (
                sw &&
                !`${row?.switch_id || ""} ${row?.serial || ""}`.toLowerCase().includes(sw)
              ) {
                return false;
              }
              return true;
            });
          }
        }
        data = bounded(
          data,
          "Filter with mac=, port=, or switch=.",
          getMaxResponseBytes(),
        );
        return textResult(data, { device: name, path: "monitor/switch-controller/detected-device" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_matched_devices",
    label: "FortiGate: Switch Matched Devices",
    description: "Matched devices (monitor/switch-controller/matched-devices). Can be large. Read-only.",
    promptSnippet: "FortiGate switch matched devices",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/matched-devices", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/matched-devices" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_nac_stats",
    label: "FortiGate: Switch NAC Stats",
    description: "NAC device stats (monitor/switch-controller/nac-device/stats). Read-only.",
    promptSnippet: "FortiGate switch nac stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/nac-device/stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/nac-device/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_fsw_firmware",
    label: "FortiGate: Switch FSW Firmware",
    description: "FSW recommended firmware (monitor/switch-controller/fsw-firmware). Read-only.",
    promptSnippet: "FortiGate switch fsw firmware",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/fsw-firmware", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/fsw-firmware" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_switch_isl_lockdown",
    label: "FortiGate: Switch ISL Lockdown",
    description:
      "ISL lockdown status (monitor/switch-controller/isl-lockdown/status). " +
      "Returns 424 when ISL lockdown is not enabled/applicable. Read-only.",
    promptSnippet: "FortiGate switch isl lockdown",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/switch-controller/isl-lockdown/status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/switch-controller/isl-lockdown/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        const msg = String(e?.message || e);
        if (/424/.test(msg)) {
          return textResult(
            "Error: ISL lockdown status unavailable (424) — feature not enabled or not applicable on this FortiLink fabric.",
          );
        }
        return textResult(`Error: ${msg}`);
      }
    },
  });
}
