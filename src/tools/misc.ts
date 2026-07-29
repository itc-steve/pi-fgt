/** Misc read-only tools (17). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded, compactApps } from "../bounds.js";
import { clampPerPage } from "../validate.js";

export const MISC_TOOL_NAMES = [
  "get_license_fortianalyzer_status",
  "get_registration_status",
  "get_forticare_connectivity",
  "get_fortiguard_comm_stats",
  "get_extenders",
  "get_lan_extensions",
  "get_lldp_neighbors",
  "get_lldp_ports",
  "get_dns_latency",
  "get_ddns_servers",
  "get_reverse_ip_lookup",
  "get_log_stats",
  "get_log_disk_usage",
  "get_log_device_state",
  "get_log_fortianalyzer_status",
  "get_log_forticloud_status",
  "get_fortiview_statistics",
] as const;

export function registerMiscTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_license_fortianalyzer_status",
    label: "FortiGate: License Fortianalyzer Status",
    description:
      "FAZ FortiCare/license indicators (monitor/license/fortianalyzer-status). Pair with get_log_fortianalyzer_status. Read-only.",
    promptSnippet: "FortiGate license fortianalyzer status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/license/fortianalyzer-status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/license/fortianalyzer-status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_registration_status",
    label: "FortiGate: Registration Status",
    description: "Registration status (monitor/registration/forticloud/device-status). Read-only.",
    promptSnippet: "FortiGate registration status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/registration/forticloud/device-status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/registration/forticloud/device-status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_forticare_connectivity",
    label: "FortiGate: Forticare Connectivity",
    description: "FortiCare connectivity check (monitor/registration/forticare/check-connectivity). Read-only.",
    promptSnippet: "FortiGate forticare connectivity",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/registration/forticare/check-connectivity", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/registration/forticare/check-connectivity" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fortiguard_comm_stats",
    label: "FortiGate: Fortiguard Comm Stats",
    description: "Fortiguard service communication stats (monitor/fortiguard/service-communication-stats). Read-only.",
    promptSnippet: "FortiGate fortiguard comm stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/fortiguard/service-communication-stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/fortiguard/service-communication-stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_extenders",
    label: "FortiGate: Extenders",
    description: "FortiExtender stats (monitor/extender-controller/extender). Read-only.",
    promptSnippet: "FortiGate extenders",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/extender-controller/extender", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/extender-controller/extender" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_lan_extensions",
    label: "FortiGate: LAN Extensions",
    description: "LAN extension connectors (monitor/extension-controller/fortigate). Read-only.",
    promptSnippet: "FortiGate lan extensions",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/extension-controller/fortigate", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/extension-controller/fortigate" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_lldp_neighbors",
    label: "FortiGate: LLDP Neighbors",
    description: "LLDP neighbors (monitor/network/lldp/neighbors). Read-only.",
    promptSnippet: "FortiGate lldp neighbors",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/network/lldp/neighbors", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/network/lldp/neighbors" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_lldp_ports",
    label: "FortiGate: LLDP Ports",
    description: "LLDP ports (monitor/network/lldp/ports). Read-only.",
    promptSnippet: "FortiGate lldp ports",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/network/lldp/ports", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/network/lldp/ports" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_dns_latency",
    label: "FortiGate: DNS Latency",
    description: "DNS latency (monitor/network/dns/latency). Read-only.",
    promptSnippet: "FortiGate dns latency",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/network/dns/latency", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/network/dns/latency" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ddns_servers",
    label: "FortiGate: DDNS Servers",
    description: "DDNS servers (monitor/network/ddns/servers). Read-only.",
    promptSnippet: "FortiGate ddns servers",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/network/ddns/servers", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/network/ddns/servers" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_reverse_ip_lookup",
    label: "FortiGate: Reverse IP Lookup",
    description: "Reverse IP lookup (monitor/network/reverse-ip-lookup). ip required. Read-only.",
    promptSnippet: "FortiGate reverse ip lookup",
    parameters: Type.Object({
      ...deviceParam,
      ip: Type.String({ description: "IP address for reverse lookup" }),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/network/reverse-ip-lookup", dev, token, { ip: params.ip }, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/network/reverse-ip-lookup" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_log_stats",
    label: "FortiGate: Log Stats",
    description:
      "Rough log volume counters by category (monitor/log/stats). Complements get_logs. Read-only.",
    promptSnippet: "FortiGate log stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/log/stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/log/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_log_disk_usage",
    label: "FortiGate: Log Disk Usage",
    description:
      "Local log disk usage (monitor/log/current-disk-usage). Often zeros when log_disk_status=not_available. Read-only.",
    promptSnippet: "FortiGate log disk usage",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/log/current-disk-usage", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/log/current-disk-usage" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_log_device_state",
    label: "FortiGate: Log Device State",
    description:
      "Which log backends are available/enabled (monitor/log/device/state): memory, disk, fortianalyzer, forticloud. " +
      "Call this before get_logs when choosing source=. Read-only.",
    promptSnippet: "FortiGate log device state",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data: any = fortiResults(await fortiGet("monitor/log/device/state", dev, token, {}, signal));
        // Guide agent: is_enabled=false ≠ path missing; pick source from flags
        if (data && typeof data === "object") {
          const pick: string[] = [];
          if (data.memory?.is_available) pick.push("memory" + (data.memory.is_enabled ? "" : " (buffer; logging may be off)"));
          if (data.disk?.is_available && data.disk?.is_enabled) pick.push("disk");
          else if (data.disk?.is_available === false) pick.push("disk unavailable");
          if (data.fortianalyzer?.is_available && data.fortianalyzer?.is_enabled) {
            pick.push(`fortianalyzer (${data.fortianalyzer.ip || "configured"})`);
          } else if (data.fortianalyzer?.is_available && !data.fortianalyzer?.is_enabled) {
            pick.push("fortianalyzer present but disabled");
          }
          if (data.forticloud?.is_enabled) pick.push("forticloud");
          data = {
            ...data,
            _hint:
              `Suggested get_logs source=: ${pick.join(" | ") || "none clear — try memory"}. ` +
              "is_enabled=false means that log *device* is not active as a destination; memory queries may still return [].",
          };
        }
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/log/device/state" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_log_fortianalyzer_status",
    label: "FortiGate: Log Fortianalyzer Status",
    description:
      "FAZ registration/connection/serial/disk (monitor/log/fortianalyzer). " +
      "If registration=registered and connection=allow, get_logs source=fortianalyzer works (async poll handled in-tool). Read-only.",
    promptSnippet: "FortiGate log fortianalyzer status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        try {
          let data = fortiResults(await fortiGet("monitor/log/fortianalyzer", dev, token, {}, signal));
          data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
          return textResult(data, { device: name, path: "monitor/log/fortianalyzer" });
        } catch (e: any) {
          if (e?.name === "AbortError") throw e;
          const msg = String(e?.message || e);
          // 424 when FAZ not configured / feature idle (common on home FGTs)
          if (/424/.test(msg)) {
            return textResult(
              {
                _empty: true,
                registration: "not_configured",
                connection: "n/a",
                _hint:
                  "FortiAnalyzer status API returned 424 — FAZ is not configured or not active on this device. " +
                  "Use get_log_device_state; get_logs source=memory (or disk if available). " +
                  "Do not keep retrying fortianalyzer on this box.",
              },
              { device: name, path: "monitor/log/fortianalyzer" },
            );
          }
          return textResult(`Error: ${msg}`);
        }
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_log_forticloud_status",
    label: "FortiGate: Log Forticloud Status",
    description:
      "FortiCloud logging quota/usage (monitor/log/forticloud). Use get_logs source=forticloud only if enabled. Read-only.",
    promptSnippet: "FortiGate log forticloud status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/log/forticloud", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/log/forticloud" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fortiview_statistics",
    label: "FortiGate: Fortiview Statistics",
    description:
      "Fortiview realtime statistics (monitor/fortiview/realtime-statistics). " +
      "report_by: source|dstaddr|device|… ; count clamped to 50. " +
      "Default projects ops fields + compact apps (verbose=true for full). " +
      "On some builds report_by only sorts — rows may still be per src/dst pair.",
    promptSnippet: "FortiGate fortiview statistics",
    parameters: Type.Object({
      ...deviceParam,
      report_by: Type.Optional(
        Type.String({ description: "Group by: source|dstaddr|device|… (default source)" }),
      ),
      sort_by: Type.Optional(Type.String({ description: "Sort by field (optional)" })),
      count: Type.Optional(Type.Number({ description: "Max rows (default 25, max 50)" })),
      verbose: Type.Optional(Type.Boolean({ description: "Full FortiView fields" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const q: Record<string, unknown> = {
          report_by: String(params.report_by || "source").trim() || "source",
          count: clampPerPage(params.count ?? 25),
        };
        if (params.sort_by != null) q.sort_by = params.sort_by;
        let data: any = fortiResults(await fortiGet("monitor/fortiview/realtime-statistics", dev, token, q, signal));
        // Project details[] when present
        const rows = Array.isArray(data) ? data : Array.isArray(data?.details) ? data.details : null;
        // Field selection is config-driven (filters tools.get_fortiview_statistics);
        // only apps[] compaction happens here.
        if (rows) {
          const projected = rows.map((row: any) => {
            const out = { ...row };
            const apps = compactApps(row.apps);
            if (!apps) return out; // apps_compact off → leave raw objects
            out.apps = apps;
            // prefer name×count form when the API supplies counts
            if (Array.isArray(row.apps) && row.apps.some((a: any) => a?.count != null)) {
              out.apps = row.apps
                .map((a: any) => (a?.name ? `${a.name}${a.count != null ? `×${a.count}` : ""}` : null))
                .filter(Boolean);
            }
            return out;
          });
          data = Array.isArray(data) ? projected : { ...data, details: projected };
        }
        data = bounded(data, "Lower count or change report_by.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/fortiview/realtime-statistics" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
