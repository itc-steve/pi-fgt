/** Wifi read-only tools (11). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";
import { clampPerPage } from "../validate.js";

export const WIFI_TOOL_NAMES = [
  "get_wifi_ap_status",
  "get_wifi_statistics",
  "get_wifi_rogue_aps",
  "get_wifi_interfering_aps",
  "get_wifi_firmware",
  "get_wifi_unassociated_devices",
  "get_wifi_station_capability",
  "get_wifi_nac_stats",
  "get_wifi_matched_devices",
  "get_wifi_meta",
  "get_wifi_vlan_probe",
] as const;

export function registerWifiTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_wifi_ap_status",
    label: "FortiGate: WiFi AP Status",
    description: "per-AP stats (monitor/wifi/ap_status). Read-only.",
    promptSnippet: "FortiGate WiFi AP status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/ap_status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/ap_status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_statistics",
    label: "FortiGate: WiFi Statistics",
    description: "aggregated FortiAP stats (monitor/wifi/statistics). Read-only.",
    promptSnippet: "FortiGate WiFi statistics",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/statistics", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/statistics" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_rogue_aps",
    label: "FortiGate: Rogue APs",
    description:
      "Rogue APs (monitor/wifi/rogue_ap). Prefer live_only=true. " +
      "Default projects compact fields, sorts by signal, caps rows. verbose=true for full.",
    promptSnippet: "FortiGate rogue APs",
    parameters: Type.Object({
      ...deviceParam,
      live_only: Type.Optional(
        Type.Boolean({ description: "Only currently visible (is_dead=false) rogues" }),
      ),
      verbose: Type.Optional(Type.Boolean({ description: "Full rogue records + detected_by_wtp" })),
      count: Type.Optional(Type.Number({ description: "Max rows after filter/sort (default 15, max 50)" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/rogue_ap", dev, token, {}, signal));
        const total = Array.isArray(data) ? data.length : 0;
        if (Array.isArray(data)) {
          if (params.live_only) data = data.filter((r: any) => r && r.is_dead === false);
          // Strongest signal first (ops: "what's near me"); live before dead as tiebreak
          data = [...data].sort((a: any, b: any) => {
            const dead = Number(!!a?.is_dead) - Number(!!b?.is_dead);
            if (dead !== 0) return dead;
            return (Number(b?.signal_strength) || 0) - (Number(a?.signal_strength) || 0);
          });
          const cap = clampPerPage(params.count ?? 15);
          const truncated = data.length > cap;
          if (truncated) data = data.slice(0, cap);
          if (!params.verbose) {
            data = data.map((r: any) => {
              const det = Array.isArray(r?.detected_by_wtp) ? r.detected_by_wtp : [];
              return {
                ssid: r.ssid,
                mac: r.mac,
                manufacturer: r.manufacturer,
                security_mode: r.security_mode,
                signal_strength: r.signal_strength,
                channel: r.channel,
                is_fake: r.is_fake,
                is_dead: r.is_dead,
                wtp_count: r.wtp_count ?? det.length,
                wtp_ip: det[0]?.wtp_ip || r.wtp_ip,
                last_seen: r.last_seen,
              };
            });
          }
          if (truncated) {
            data = {
              _truncated: true,
              _returned: cap,
              _total_after_filter: total,
              _hint: "Raised signal-first cap; pass count= or verbose=true for more.",
              data,
            } as any;
          }
        }
        data = bounded(
          data,
          "Use live_only=true; list is often hundreds of historical dead SSIDs.",
          getMaxResponseBytes(),
        );
        return textResult(data, { device: name, path: "monitor/wifi/rogue_ap" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_interfering_aps",
    label: "FortiGate: Interfering APs",
    description: "interfering APs (monitor/wifi/interfering_ap). Read-only.",
    promptSnippet: "FortiGate interfering APs",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/interfering_ap", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/interfering_ap" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_firmware",
    label: "FortiGate: WiFi Firmware",
    description: "current + recommended AP firmware (monitor/wifi/firmware). Read-only.",
    promptSnippet: "FortiGate WiFi firmware",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/firmware", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/firmware" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_unassociated_devices",
    label: "FortiGate: Unassociated Devices",
    description:
      "unassociated devices (monitor/wifi/unassociated-devices). Large list — filter mac= / manufacturer=. Read-only.",
    promptSnippet: "FortiGate unassociated WiFi devices",
    parameters: Type.Object({
      ...deviceParam,
      mac: Type.Optional(Type.String({ description: "MAC substring (separators ignored)" })),
      manufacturer: Type.Optional(Type.String({ description: "Manufacturer substring" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/unassociated-devices", dev, token, {}, signal));
        if (Array.isArray(data)) {
          const mac = String(params.mac || "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
          const mfr = String(params.manufacturer || "").trim().toLowerCase();
          if (mac || mfr) {
            data = data.filter((row: any) => {
              if (mac) {
                const rowMac = String(row?.mac || "").toLowerCase().replace(/[^0-9a-f]/g, "");
                if (!rowMac.includes(mac)) return false;
              }
              if (mfr && !String(row?.manufacturer || "").toLowerCase().includes(mfr)) return false;
              return true;
            });
          }
        }
        data = bounded(
          data,
          "Filter with mac= or manufacturer=; unfiltered list is often 400+ historical MACs.",
          getMaxResponseBytes(),
        );
        return textResult(data, { device: name, path: "monitor/wifi/unassociated-devices" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_station_capability",
    label: "FortiGate: Station Capability",
    description:
      "station capability (monitor/wifi/station-capability). Often hundreds of rows — " +
      "filter with mac= (substring). Read-only.",
    promptSnippet: "FortiGate station capability",
    parameters: Type.Object({
      ...deviceParam,
      mac: Type.Optional(
        Type.String({ description: "Filter by station MAC (substring, separators ignored)" }),
      ),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/station-capability", dev, token, {}, signal));
        if (Array.isArray(data)) {
          const mac = String(params.mac || "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
          if (mac) {
            data = data.filter((row: any) => {
              const rowMac = String(row?.mac_address || row?.mac || "")
                .toLowerCase()
                .replace(/[^0-9a-f]/g, "");
              return rowMac.includes(mac);
            });
          }
        }
        data = bounded(
          data,
          "Filter with mac=; full table is often 100k+ of historical probe stations.",
          getMaxResponseBytes(),
        );
        return textResult(data, { device: name, path: "monitor/wifi/station-capability" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_nac_stats",
    label: "FortiGate: WiFi NAC Stats",
    description: "NAC device stats (monitor/wifi/nac-device/stats). Read-only.",
    promptSnippet: "FortiGate WiFi NAC stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/nac-device/stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/nac-device/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_matched_devices",
    label: "FortiGate: Matched Devices",
    description: "matched devices (monitor/wifi/matched-devices). Read-only.",
    promptSnippet: "FortiGate matched devices",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/matched-devices", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/matched-devices" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_meta",
    label: "FortiGate: WiFi Meta",
    description: "wifi meta (monitor/wifi/meta). Read-only.",
    promptSnippet: "FortiGate WiFi meta",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/meta", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/meta" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wifi_vlan_probe",
    label: "FortiGate: VLAN Probe",
    description:
      "vlan probe (monitor/wifi/vlan-probe). Requires VLAN probe feature configured on the FortiAP profile; " +
      "returns 424 when the feature/params are unavailable. Read-only.",
    promptSnippet: "FortiGate WiFi VLAN probe",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wifi/vlan-probe", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wifi/vlan-probe" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        const msg = String(e?.message || e);
        if (/424/.test(msg)) {
          return textResult(
            "Error: VLAN probe unavailable (424). Enable/configure VLAN probe on the FortiAP profile, " +
              "or use get_wifi_clients / get_switch_detected_devices for station placement.",
          );
        }
        return textResult(`Error: ${msg}`);
      }
    },
  });
}
