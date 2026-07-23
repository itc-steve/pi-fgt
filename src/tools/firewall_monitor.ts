/** Firewall monitor read-only tools (20). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export const FIREWALL_MONITOR_TOOL_NAMES = [
  "get_firewall_acl_stats",
  "get_firewall_acl6_stats",
  "get_dynamic_addresses",
  "get_fqdn_addresses",
  "get_vip_dnat_stats",
  "get_central_snat_stats",
  "get_ippool_stats",
  "get_ippool_mapping",
  "get_proxy_policy_stats",
  "get_proxy_sessions",
  "get_local_in_policies",
  "get_multicast_policy_stats",
  "get_lb_health",
  "get_lb_servers",
  "get_shaper_stats",
  "get_per_ip_shaper_stats",
  "get_internet_service_basic",
  "get_internet_service_match",
  "get_vip_overlap",
  "get_firewall_uuid_list",
] as const;

export function registerFirewallMonitorTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_firewall_acl_stats",
    label: "FortiGate: Firewall ACL Stats",
    description:
      "IPv4 ACL counters (monitor/firewall/acl). 404 when ACL feature unused/unavailable on this model. Read-only.",
    promptSnippet: "FortiGate firewall acl stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/acl", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/acl" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        const msg = String(e?.message || e);
        if (/404/.test(msg)) {
          return textResult(
            "Error: firewall ACL monitor not available on this device (404). ACL stats are unused on many branch FGTs.",
          );
        }
        return textResult(`Error: ${msg}`);
      }
    },
  });

  pi.registerTool({
    name: "get_firewall_acl6_stats",
    label: "FortiGate: Firewall ACL6 Stats",
    description: "IPv6 ACL counters (monitor/firewall/acl6). Read-only.",
    promptSnippet: "FortiGate firewall acl6 stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/acl6", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/acl6" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_dynamic_addresses",
    label: "FortiGate: Dynamic Addresses",
    description: "Fabric connector resolved IPs (monitor/firewall/address-dynamic). Read-only.",
    promptSnippet: "FortiGate dynamic addresses",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/address-dynamic", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/address-dynamic" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fqdn_addresses",
    label: "FortiGate: FQDN Addresses",
    description:
      "FQDN address objects → resolved IPs (monitor/firewall/address-fqdns). " +
      "List view omits addrs; this tool re-fetches each (or name=) with mkey so agents see real IPs. Read-only.",
    promptSnippet: "FortiGate fqdn addresses",
    parameters: Type.Object({
      ...deviceParam,
      name: Type.Optional(
        Type.String({ description: "FQDN object name or substring (e.g. gmail, microsoft)" }),
      ),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const nameQ = String(params.name || "").trim().toLowerCase();

        // Exact-ish single object: mkey returns addrs
        if (nameQ && !nameQ.includes("*") && nameQ.length > 0) {
          try {
            const one = fortiResults(
              await fortiGet("monitor/firewall/address-fqdns", dev, token, { mkey: String(params.name).trim() }, signal),
            );
            if (one && (Array.isArray(one) ? one.length : true)) {
              const payload = Array.isArray(one) ? one : [one];
              // if mkey exact miss, fall through to list+filter
              if (payload.some((r: any) => r?.addrs || r?.name)) {
                return textResult(
                  bounded(payload, "Filter with name=.", getMaxResponseBytes()),
                  { device: name, path: "monitor/firewall/address-fqdns" },
                );
              }
            }
          } catch {
            // fall through to list
          }
        }

        let list: any = fortiResults(
          await fortiGet("monitor/firewall/address-fqdns", dev, token, {}, signal),
        );
        if (!Array.isArray(list)) list = [];
        if (nameQ) {
          list = list.filter(
            (r: any) =>
              String(r?.name || "").toLowerCase().includes(nameQ) ||
              String(r?.fqdn || "").toLowerCase().includes(nameQ),
          );
        }

        // Expand resolved IPs (list endpoint only returns addrs_count)
        const cap = 40;
        const expanded: any[] = [];
        for (const row of list.slice(0, cap)) {
          const key = row?.name;
          if (!key) {
            expanded.push(row);
            continue;
          }
          try {
            const full = fortiResults(
              await fortiGet("monitor/firewall/address-fqdns", dev, token, { mkey: key }, signal),
            );
            if (Array.isArray(full) && full[0]) expanded.push(full[0]);
            else if (full && typeof full === "object") expanded.push(full);
            else expanded.push(row);
          } catch {
            expanded.push(row);
          }
        }
        let data: any = expanded;
        if (list.length > cap) {
          data = {
            data: expanded,
            _truncated: true,
            _returned: expanded.length,
            _total: list.length,
            _hint: `Expanded first ${cap} of ${list.length} FQDNs; filter with name=.`,
          };
        }
        data = bounded(data, "Filter with name= for one FQDN.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/address-fqdns" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_vip_dnat_stats",
    label: "FortiGate: VIP DNAT Stats",
    description:
      "VIP/server hit counts (monitor/firewall/dnat). 424 when no VIP stats / feature idle. Read-only.",
    promptSnippet: "FortiGate vip dnat stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/dnat", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/dnat" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        const msg = String(e?.message || e);
        if (/424/.test(msg)) {
          return textResult(
            "Error: VIP DNAT stats unavailable (424) — no VIP activity or feature idle. Use get_vip_objects for config.",
          );
        }
        return textResult(`Error: ${msg}`);
      }
    },
  });

  pi.registerTool({
    name: "get_central_snat_stats",
    label: "FortiGate: Central SNAT Stats",
    description: "Central SNAT map stats (monitor/firewall/central-snat-map). Read-only.",
    promptSnippet: "FortiGate central snat stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/central-snat-map", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/central-snat-map" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ippool_stats",
    label: "FortiGate: IP Pool Stats",
    description: "IPv4 pool stats (monitor/firewall/ippool). Read-only.",
    promptSnippet: "FortiGate ippool stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/ippool", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/ippool" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ippool_mapping",
    label: "FortiGate: IP Pool Mapping",
    description: "IP pool mapping (monitor/firewall/ippool/mapping). Optional mkey. Read-only.",
    promptSnippet: "FortiGate ippool mapping",
    parameters: Type.Object({
      ...deviceParam,
      mkey: Type.Optional(Type.String({ description: "Optional pool name" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const q: Record<string, unknown> = {};
        if (params.mkey) q.mkey = params.mkey;
        let data = fortiResults(await fortiGet("monitor/firewall/ippool/mapping", dev, token, q, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/ippool/mapping" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_proxy_policy_stats",
    label: "FortiGate: Proxy Policy Stats",
    description: "Proxy policy stats (monitor/firewall/proxy-policy). Read-only.",
    promptSnippet: "FortiGate proxy policy stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/proxy-policy", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/proxy-policy" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_proxy_sessions",
    label: "FortiGate: Proxy Sessions",
    description: "Proxy sessions (monitor/firewall/proxy/sessions). Can be large. Read-only.",
    promptSnippet: "FortiGate proxy sessions",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/proxy/sessions", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/proxy/sessions" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_local_in_policies",
    label: "FortiGate: Local In Policies",
    description: "Implicit/explicit local-in policies (monitor/firewall/local-in). Read-only.",
    promptSnippet: "FortiGate local in policies",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/local-in", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/local-in" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_multicast_policy_stats",
    label: "FortiGate: Multicast Policy Stats",
    description: "Multicast policy stats (monitor/firewall/multicast-policy). Read-only.",
    promptSnippet: "FortiGate multicast policy stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/multicast-policy", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/multicast-policy" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_lb_health",
    label: "FortiGate: Load Balance Health",
    description: "Load-balance health monitors (monitor/firewall/health). Read-only.",
    promptSnippet: "FortiGate lb health",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/health", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/health" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_lb_servers",
    label: "FortiGate: Load Balance Servers",
    description: "Load-balance servers (monitor/firewall/load-balance). Read-only.",
    promptSnippet: "FortiGate lb servers",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/load-balance", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/load-balance" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_shaper_stats",
    label: "FortiGate: Shaper Stats",
    description: "Shared shaper stats (monitor/firewall/shaper). Read-only.",
    promptSnippet: "FortiGate shaper stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/shaper", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/shaper" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_per_ip_shaper_stats",
    label: "FortiGate: Per-IP Shaper Stats",
    description: "Per-IP shaper stats (monitor/firewall/per-ip-shaper). Read-only.",
    promptSnippet: "FortiGate per-ip shaper stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/per-ip-shaper", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/per-ip-shaper" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_internet_service_basic",
    label: "FortiGate: Internet Service Basic",
    description:
      "Internet service catalog (monitor/firewall/internet-service-basic). ~1k+ entries — always filter with name=. Read-only.",
    promptSnippet: "FortiGate internet service basic",
    parameters: Type.Object({
      ...deviceParam,
      name: Type.Optional(
        Type.String({ description: "Substring filter on service name (e.g. Google, Microsoft)" }),
      ),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/internet-service-basic", dev, token, {}, signal));
        const nameQ = String(params.name || "").trim().toLowerCase();
        if (Array.isArray(data)) {
          if (nameQ) {
            data = data.filter((row: any) => String(row?.name || "").toLowerCase().includes(nameQ));
          }
          // useful slice only — full ISDB rows are huge
          data = data.map((row: any) => ({
            id: row?.id,
            name: row?.name,
            database: row?.database,
            direction: row?.direction,
            ip_number: row?.["ip-number"],
            ip_range_number: row?.["ip-range-number"],
          }));
        }
        data = bounded(
          data,
          "Filter with name= (e.g. Google); full ISDB is thousands of entries.",
          getMaxResponseBytes(),
        );
        return textResult(data, { device: name, path: "monitor/firewall/internet-service-basic" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_internet_service_match",
    label: "FortiGate: Internet Service Match",
    description:
      "Internet service match by IP (monitor/firewall/internet-service-match). ip required. " +
      "May 424 if ISDB match API unavailable on this build. Read-only.",
    promptSnippet: "FortiGate internet service match",
    parameters: Type.Object({
      ...deviceParam,
      ip: Type.String({ description: "IP address to match" }),
      mask: Type.Optional(Type.String({ description: "Optional netmask" })),
    }),
    async execute(_id, params, signal) {
      try {
        const ip = String(params.ip || "").trim();
        if (!ip) return textResult("Error: ip is required (e.g. 8.8.8.8).");
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const q: Record<string, unknown> = { ip };
        if (params.mask != null) q.mask = params.mask;
        let data = fortiResults(await fortiGet("monitor/firewall/internet-service-match", dev, token, q, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/internet-service-match" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        const msg = String(e?.message || e);
        if (/424/.test(msg)) {
          return textResult(
            `Error: internet-service-match returned 424 for ip=${String(params.ip || "").trim()}. ` +
              "API unavailable or needs extra params on this FortiOS build — try get_internet_service_basic name= instead.",
          );
        }
        return textResult(`Error: ${msg}`);
      }
    },
  });

  pi.registerTool({
    name: "get_vip_overlap",
    label: "FortiGate: VIP Overlap",
    description: "VIP overlap check (monitor/firewall/vip-overlap). Read-only.",
    promptSnippet: "FortiGate vip overlap",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/vip-overlap", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/firewall/vip-overlap" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_firewall_uuid_list",
    label: "FortiGate: Firewall UUID List",
    description:
      "Firewall UUID list (monitor/firewall/uuid-list). Filter with type= (e.g. firewall.policy, firewall.address). Read-only.",
    promptSnippet: "FortiGate firewall uuid list",
    parameters: Type.Object({
      ...deviceParam,
      type: Type.Optional(
        Type.String({
          description:
            "Substring on type (firewall.policy|firewall.address|firewall.service.custom|…)",
        }),
      ),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/firewall/uuid-list", dev, token, {}, signal));
        const typeQ = String(params.type || "").trim().toLowerCase();
        if (typeQ && Array.isArray(data)) {
          data = data.filter((row: any) => String(row?.type || "").toLowerCase().includes(typeQ));
        }
        data = bounded(
          data,
          "Filter with type= (firewall.policy, firewall.address, …).",
          getMaxResponseBytes(),
        );
        return textResult(data, { device: name, path: "monitor/firewall/uuid-list" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
