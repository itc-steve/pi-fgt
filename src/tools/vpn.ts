/** VPN tools (4). Full parity. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, runForti, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export function registerVpnTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_ipsec_phase1",
    label: "FortiGate: IPsec Phase1",
    description: "IPsec IKE phase1 (cmdb/vpn.ipsec/phase1-interface).",
    promptSnippet: "FortiGate ipsec phase1",
    parameters: Type.Object({ ...deviceParam, verbose: Type.Optional(Type.Boolean({ default: false })) }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data = fortiResults(await fortiGet("cmdb/vpn.ipsec/phase1-interface", dev, token, {}, signal));
      return textResult(bounded(data, "verbose=true for full fields.", getMaxResponseBytes()), { device: name });
    },
  });

  pi.registerTool({
    name: "get_ipsec_phase2",
    label: "FortiGate: IPsec Phase2",
    description: "IPsec phase2 (cmdb/vpn.ipsec/phase2-interface).",
    promptSnippet: "FortiGate ipsec phase2",
    parameters: Type.Object({ ...deviceParam, verbose: Type.Optional(Type.Boolean({ default: false })) }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data = fortiResults(await fortiGet("cmdb/vpn.ipsec/phase2-interface", dev, token, {}, signal));
      return textResult(bounded(data, "verbose=true for full.", getMaxResponseBytes()), { device: name });
    },
  });

  pi.registerTool({
    name: "get_ipsec_tunnels",
    label: "FortiGate: IPsec Tunnels",
    description:
      "Live IPsec tunnels (monitor/vpn/ipsec): name, remote gateway (rgwy), phase2 proxy selectors, up/down, bytes. " +
      "Pair with get_ipsec_phase1/phase2 for config. Empty [] = no tunnels.",
    promptSnippet: "FortiGate ipsec tunnels",
    parameters: Type.Object({
      ...deviceParam,
      name: Type.Optional(Type.String({ description: "Substring filter on tunnel name" })),
      verbose: Type.Optional(Type.Boolean({ description: "Full tunnel records (default: ops summary)" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data: any = fortiResults(await fortiGet("monitor/vpn/ipsec", dev, token, {}, signal));
      if (!Array.isArray(data)) data = [];
      const nameQ = String(params.name || "").trim().toLowerCase();
      if (nameQ) data = data.filter((t: any) => String(t?.name || "").toLowerCase().includes(nameQ));

      if (!params.verbose) {
        // Compact ops view — full proxyid trees are noisy
        data = data.map((t: any) => {
          const selectors = Array.isArray(t?.proxyid)
            ? t.proxyid.map((p: any) => ({
                p2name: p?.p2name,
                status: p?.status,
                src: p?.proxy_src?.[0]?.subnet,
                dst: p?.proxy_dst?.[0]?.subnet,
                incoming_bytes: p?.incoming_bytes,
                outgoing_bytes: p?.outgoing_bytes,
                expire: p?.expire,
              }))
            : [];
          const anyUp = selectors.some((s: any) => s.status === "up");
          return {
            name: t?.name,
            rgwy: t?.rgwy,
            type: t?.type,
            connection_count: t?.connection_count,
            incoming_bytes: t?.incoming_bytes,
            outgoing_bytes: t?.outgoing_bytes,
            comments: t?.comments || undefined,
            phase2: selectors,
            status: anyUp ? "up" : selectors.length ? "down" : "unknown",
          };
        });
      }

      if (data.length === 0) {
        data = {
          tunnels: [],
          _empty: true,
          _hint: "No IPsec tunnels returned. Check get_ipsec_phase1 for configured tunnels / bring-up state.",
        };
      }
      return textResult(
        bounded(data, "Filter with name=; verbose=true for full proxyid trees.", getMaxResponseBytes()),
        { device: name },
      );
    },
  });

  pi.registerTool({
    name: "get_ssl_vpn_sessions",
    label: "FortiGate: SSL VPN Sessions",
    description:
      "SSL-VPN sessions (monitor/vpn/ssl). Empty [] = no users connected (not an error). " +
      "For login failures see get_logs source=fortianalyzer|memory log_type=event (ssl-login-fail).",
    promptSnippet: "FortiGate ssl vpn sessions",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data: any = fortiResults(await fortiGet("monitor/vpn/ssl", dev, token, {}, signal));
      if (Array.isArray(data) && data.length === 0) {
        data = {
          sessions: [],
          _empty: true,
          _hint:
            "No active SSL-VPN sessions. For failed logins use get_logs(log_type=event) and look for action=ssl-login-fail.",
        };
      }
      return textResult(bounded(data, "Many users: filter client-side.", getMaxResponseBytes()), { device: name });
    },
  });
}
