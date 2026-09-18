/** SD-WAN VPN read-only tools (5). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export const SDWAN_VPN_TOOL_NAMES = [
  "get_sdwan_health_check",
  "get_sdwan_members",
  "get_sdwan_interface_log",
  "get_sdwan_sla_log",
  "get_ssl_vpn_stats",
] as const;

export function registerSdwanVpnTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_sdwan_health_check",
    label: "FortiGate: SD-WAN Health Check",
    description:
      "SD-WAN SLA per-link stats (monitor/virtual-wan/health-check). " +
      "Deprecated in FortiOS 7.6.4+ (may return {} even when probes exist). " +
      "Prefer get_sdwan_sla_log with latest=true. Read-only.",
    promptSnippet: "FortiGate sdwan health check",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data: any = fortiResults(await fortiGet("monitor/virtual-wan/health-check", dev, token, {}, signal));
        if (
          data &&
          typeof data === "object" &&
          !Array.isArray(data) &&
          Object.keys(data).length === 0
        ) {
          let sla_log: unknown;
          try {
            sla_log = fortiResults(
              await fortiGet("monitor/virtual-wan/sla-log", dev, token, { latest: 1 }, signal),
            );
          } catch (e: any) {
            if (e?.name === "AbortError") throw e;
            sla_log = undefined;
          }
          data = {
            sla_log,
            _hint:
              "monitor/virtual-wan/health-check returned {}. On FortiOS 7.6.4+ this path is deprecated and may be empty even when probes exist. Use get_sdwan_sla_log with latest=true (optional sla=\"<name>\"), or get_sdwan_members for per-link stats.",
          };
        }
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/virtual-wan/health-check" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sdwan_members",
    label: "FortiGate: SD-WAN Members",
    description: "SD-WAN per-link interface stats (monitor/virtual-wan/members). Read-only.",
    promptSnippet: "FortiGate sdwan members",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/virtual-wan/members", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/virtual-wan/members" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sdwan_interface_log",
    label: "FortiGate: SD-WAN Interface Log",
    description: "SD-WAN interface log (monitor/virtual-wan/interface-log). Read-only.",
    promptSnippet: "FortiGate sdwan interface log",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/virtual-wan/interface-log", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/virtual-wan/interface-log" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sdwan_sla_log",
    label: "FortiGate: SD-WAN SLA Log",
    description: "SD-WAN SLA log (monitor/virtual-wan/sla-log). Optional sla, latest. Read-only.",
    promptSnippet: "FortiGate sdwan sla log",
    parameters: Type.Object({
      ...deviceParam,
      sla: Type.Optional(Type.String({ description: "SLA name" })),
      latest: Type.Optional(Type.Boolean({ description: "Return latest only (query latest=1)" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const q: Record<string, unknown> = {};
        if (params.sla != null) q.sla = params.sla;
        if (params.latest) q.latest = 1;
        let data = fortiResults(await fortiGet("monitor/virtual-wan/sla-log", dev, token, q, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/virtual-wan/sla-log" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ssl_vpn_stats",
    label: "FortiGate: SSL VPN Stats",
    description: "SSL VPN stats (monitor/vpn/ssl/stats). Read-only.",
    promptSnippet: "FortiGate ssl vpn stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/vpn/ssl/stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/vpn/ssl/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
