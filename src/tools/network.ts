/** Network / routing tools (5). */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded, compactApps } from "../bounds.js";
import { clampPerPage } from "../validate.js";
import { PER_PAGE_CAP } from "../types.js";

/** apps[] → ["udp/53"]. Field selection itself lives in filters/defaults.ts. */
function withCompactApps(row: any): any {
  const apps = compactApps(row?.apps);
  return apps ? { ...row, apps } : row;
}

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
      "DHCP leases (monitor/system/dhcp). Optional ip/mac/interface filters (client-side). " +
      "Projected fields by default; verbose=true for full lease records.",
    promptSnippet: "FortiGate DHCP leases (filter by ip/mac)",
    parameters: Type.Object({
      ...deviceParam,
      ip: Type.Optional(Type.String({ description: "Filter by IP (exact or substring)" })),
      mac: Type.Optional(Type.String({ description: "Filter by MAC (substring, separators ignored)" })),
      interface: Type.Optional(Type.String({ description: "Filter by interface name (substring)" })),
      verbose: Type.Optional(Type.Boolean({ description: "Full lease records (default: projected)" })),
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
      "Active sessions (monitor/firewall/sessions) — who is talking to whom right now. " +
      "Default projects to saddr/daddr/ports/proto/intf/policyid/bytes/duration + compact apps. " +
      "ALWAYS pass source_ip or dest_ip for host forensics (client-side on fetched window). " +
      "verbose=true for full FortiOS fields. details is partial — see _hint.",
    promptSnippet: "FortiGate sessions",
    parameters: Type.Object({
      ...deviceParam,
      count: Type.Optional(Type.Number({ default: 25 })),
      source_ip: Type.Optional(Type.String({ description: "Filter by source IP (substring; client-side on fetched window)" })),
      dest_ip: Type.Optional(Type.String({ description: "Filter by dest IP (substring; client-side on fetched window)" })),
      verbose: Type.Optional(Type.Boolean({ description: "Full session fields (default: projected ops fields)" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const c = clampPerPage(params.count || 25);
      const src = String(params.source_ip || "").trim().toLowerCase();
      const dst = String(params.dest_ip || "").trim().toLowerCase();
      // FortiOS 7.6+ requires count on monitor/firewall/sessions (424 without it).
      // API count range: 20..1000; values below 20 are rounded up by FortiOS.
      // c is the user-facing row limit; fetchCount is the API fetch window, which
      // is NOT clampPerPage-capped (that cap is 50, the per-tool row limit).
      const SESSION_FETCH_MAX = 1000;
      const fetchCount = src || dst ? SESSION_FETCH_MAX : Math.max(20, c);
      const q: Record<string, string | number> = { count: fetchCount, summary: "true" };
      // ponytail: FortiOS 7.4 ignores srcaddr4/dstaddr4 on this endpoint — filter client-side
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data: any = fortiResults(await fortiGet("monitor/firewall/sessions", dev, token, q, signal));

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
          // Field selection is config-driven (filters tools.get_firewall_sessions);
          // only the apps[] compaction has to happen here (self-gating).
          details = details.map(withCompactApps);
          data = {
            summary: {
              matched_count: matchedInWindow,
              session_count: sessionCount,
            },
            details,
            _partial: true,
            _returned: details.length,
            _total_matched: matchedInWindow,
            _hint:
              matchedInWindow === 0
                ? `No matches in first ${fetched} of ${sessionCount ?? "?"} sessions (client-side filter). Empty ≠ no such sessions — omit filter or retry.`
                : `Filtered client-side within first ${fetched} of ${sessionCount ?? "?"} sessions; returned ${details.length}.`,
          };
        } else {
          details = details.slice(0, c).map(withCompactApps);
          data = { ...data, details };
          if (typeof apiMatched === "number" && details.length < apiMatched) {
            data = {
              ...data,
              _partial: true,
              _returned: details.length,
              _total_matched: apiMatched,
              _hint: `details is first ${details.length} of ${apiMatched} matched sessions; raise count (max ${PER_PAGE_CAP}) or filter source_ip/dest_ip.`,
            };
          }
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
      "Default drops 1-week history arrays + asic/software/nturbo splits (verbose=true for full). " +
      "Correlate policyid with get_firewall_policies. Zero hits ≠ policy disabled.",
    promptSnippet: "FortiGate policy hits",
    parameters: Type.Object({
      ...deviceParam,
      verbose: Type.Optional(Type.Boolean({ description: "Include week arrays + asic/software splits" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data = fortiResults(await fortiGet("monitor/firewall/policy", dev, token, {}, signal));
      return textResult(bounded(data, "Correlate with get_firewall_policy; verbose=true for week history.", getMaxResponseBytes()), { device: name });
    },
  });
}
