/** Network / routing tools (5). */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";
import { clampPerPage } from "../validate.js";

export function registerNetworkTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_routing_table",
    label: "FortiGate: Routing Table",
    description:
      "IPv4 RIB (monitor/router/ipv4). count=50 default, clamped. " +
      "For a single destination prefer get_route_lookup(destination=).",
    promptSnippet: "FortiGate routing table",
    parameters: Type.Object({ ...deviceParam, count: Type.Optional(Type.Number({ default: 50 })) }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const count = clampPerPage(params.count);
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data = await fortiGet("monitor/router/ipv4", dev, token, { count }, signal);
      data = fortiResults(data);
      data = bounded(data, "Lower count for large tables.", getMaxResponseBytes());
      return textResult(data, { device: name });
    },
  });

  pi.registerTool({
    name: "get_arp_table",
    label: "FortiGate: ARP Table",
    description:
      "ARP (monitor/network/arp). Optional ip/mac/interface filters (client-side) — use them for single-host lookups.",
    promptSnippet: "FortiGate ARP table (filter by ip/mac)",
    parameters: Type.Object({
      ...deviceParam,
      ip: Type.Optional(Type.String({ description: "Filter by IP (exact or substring)" })),
      mac: Type.Optional(Type.String({ description: "Filter by MAC (substring, separators ignored)" })),
      interface: Type.Optional(Type.String({ description: "Filter by interface name (substring)" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data = fortiResults(await fortiGet("monitor/network/arp", dev, token, {}, signal));
      if (Array.isArray(data)) {
        const ip = String(params.ip || "").trim().toLowerCase();
        const mac = String(params.mac || "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
        const iface = String(params.interface || "").trim().toLowerCase();
        if (ip || mac || iface) {
          data = data.filter((row: any) => {
            if (ip && !String(row?.ip || "").toLowerCase().includes(ip)) return false;
            if (mac) {
              const rowMac = String(row?.mac || "").toLowerCase().replace(/[^0-9a-f]/g, "");
              if (!rowMac.includes(mac)) return false;
            }
            if (iface && !String(row?.interface || "").toLowerCase().includes(iface)) return false;
            return true;
          });
        }
      }
      return textResult(
        bounded(data, "Filter with ip=, mac=, or interface=.", getMaxResponseBytes()),
        { device: name },
      );
    },
  });

  pi.registerTool({
    name: "get_dhcp_leases",
    label: "FortiGate: DHCP Leases",
    description:
      "DHCP leases (monitor/system/dhcp). Optional ip/mac/interface filters (client-side).",
    promptSnippet: "FortiGate DHCP leases (filter by ip/mac)",
    parameters: Type.Object({
      ...deviceParam,
      ip: Type.Optional(Type.String({ description: "Filter by IP (exact or substring)" })),
      mac: Type.Optional(Type.String({ description: "Filter by MAC (substring, separators ignored)" })),
      interface: Type.Optional(Type.String({ description: "Filter by interface name (substring)" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data = fortiResults(await fortiGet("monitor/system/dhcp", dev, token, {}, signal));
      if (Array.isArray(data)) {
        const ip = String(params.ip || "").trim().toLowerCase();
        const mac = String(params.mac || "").trim().toLowerCase().replace(/[^0-9a-f]/g, "");
        const iface = String(params.interface || "").trim().toLowerCase();
        if (ip || mac || iface) {
          data = data.filter((row: any) => {
            if (ip && !String(row?.ip || "").toLowerCase().includes(ip)) return false;
            if (mac) {
              const rowMac = String(row?.mac || "").toLowerCase().replace(/[^0-9a-f]/g, "");
              if (!rowMac.includes(mac)) return false;
            }
            if (iface && !String(row?.interface || "").toLowerCase().includes(iface)) return false;
            return true;
          });
        }
      }
      return textResult(
        bounded(data, "Filter with ip=, mac=, or interface=.", getMaxResponseBytes()),
        { device: name },
      );
    },
  });

  pi.registerTool({
    name: "get_firewall_sessions",
    label: "FortiGate: Firewall Sessions",
    description:
      "Active sessions (monitor/firewall/session) — who is talking to whom right now. " +
      "Fields: saddr/daddr/sport/dport/proto/srcintf/dstintf/policyid/apps/bytes. " +
      "source_ip/dest_ip are client-side filters on the fetched window " +
      "(FortiOS 7.4 ignores server-side srcaddr filters). " +
      "details is always a partial list — see summary.matched_count / _partial / _hint.",
    promptSnippet: "FortiGate sessions",
    parameters: Type.Object({
      ...deviceParam,
      count: Type.Optional(Type.Number({ default: 25 })),
      source_ip: Type.Optional(Type.String({ description: "Filter by source IP (substring; client-side on fetched window)" })),
      dest_ip: Type.Optional(Type.String({ description: "Filter by dest IP (substring; client-side on fetched window)" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const c = clampPerPage(params.count || 25);
      const src = String(params.source_ip || "").trim().toLowerCase();
      const dst = String(params.dest_ip || "").trim().toLowerCase();
      // When filtering, fetch max page so client-side filter has a larger window
      const fetchCount = src || dst ? clampPerPage(50) : c;
      const q: Record<string, string | number> = { count: fetchCount, summary: "true" };
      // ponytail: FortiOS 7.4 ignores srcaddr4/dstaddr4 on this endpoint — filter client-side
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data: any = fortiResults(await fortiGet("monitor/firewall/session", dev, token, q, signal));

      if (data && typeof data === "object" && Array.isArray(data.details)) {
        let details: any[] = data.details;
        const fetched = details.length;
        const sessionCount = data.summary?.session_count;
        const apiMatched = data.summary?.matched_count;

        if (src || dst) {
          details = details.filter((row: any) => {
            if (src && !String(row?.saddr || "").toLowerCase().includes(src)) return false;
            if (dst && !String(row?.daddr || "").toLowerCase().includes(dst)) return false;
            return true;
          });
          const matchedInWindow = details.length;
          details = details.slice(0, c);
          data = {
            ...data,
            summary: {
              ...(data.summary || {}),
              // api matched_count is unfiltered — replace with window truth
              matched_count: matchedInWindow,
              session_count: sessionCount,
            },
            details,
            _client_filter: {
              source_ip: src || undefined,
              dest_ip: dst || undefined,
              note: "client-side on fetched window; FortiOS does not apply src/dst filters on this API",
            },
            _window: {
              fetched,
              session_count: sessionCount,
              matched_in_window: matchedInWindow,
              returned: details.length,
            },
            _partial: true,
            _returned: details.length,
            _total_matched: matchedInWindow,
            _hint:
              matchedInWindow === 0
                ? `No matches in first ${fetched} of ${sessionCount ?? "?"} sessions (client-side filter). Empty ≠ no such sessions — omit filter or retry.`
                : `Filtered client-side within first ${fetched} of ${sessionCount ?? "?"} sessions; returned ${details.length}.`,
          };
        } else if (typeof apiMatched === "number" && details.length < apiMatched) {
          // Unfiltered: FortiOS already limited details to count — be explicit
          data = {
            ...data,
            _partial: true,
            _returned: details.length,
            _total_matched: apiMatched,
            _hint: `details is first ${details.length} of ${apiMatched} matched sessions; raise count (max 50) or filter source_ip/dest_ip.`,
          };
        }
      }

      return textResult(bounded(data, "Use source_ip/dest_ip filters for large tables.", getMaxResponseBytes()), {
        device: name,
      });
    },
  });

  pi.registerTool({
    name: "get_policy_hit_counts",
    label: "FortiGate: Policy Hit Counts",
    description:
      "Live policy counters: active_sessions/bytes/packets per policyid (monitor/firewall/policy). " +
      "Correlate policyid with get_firewall_policies / get_firewall_policy. Zero hits ≠ policy disabled.",
    promptSnippet: "FortiGate policy hits",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data = fortiResults(await fortiGet("monitor/firewall/policy", dev, token, {}, signal));
      return textResult(bounded(data, "Correlate with get_firewall_policy.", getMaxResponseBytes()), { device: name });
    },
  });
}
