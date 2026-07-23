/** Router read-only tools (15). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";
import { clampPerPage } from "../validate.js";

export const ROUTER_TOOL_NAMES = [
  "get_routing_table_ipv6",
  "get_bgp_neighbors",
  "get_bgp_neighbors_ipv6",
  "get_bgp_neighbors_stats",
  "get_bgp_paths",
  "get_bgp_paths_ipv6",
  "get_ospf_neighbors",
  "get_policy_routes",
  "get_policy_routes_ipv6",
  "get_sdwan_routes",
  "get_sdwan_routes_ipv6",
  "get_sdwan_routes_stats",
  "get_router_statistics",
  "get_route_lookup",
  "get_route_lookup_policy",
] as const;

export function registerRouterTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_routing_table_ipv6",
    label: "FortiGate: Routing Table IPv6",
    description: "Routing table IPv6 (monitor/router/ipv6). count=50 default, clamped. Read-only.",
    promptSnippet: "FortiGate routing table ipv6",
    parameters: Type.Object({ ...deviceParam, count: Type.Optional(Type.Number({ default: 50 })) }),
    async execute(_id, params, signal) {
      try {
        const count = clampPerPage(params.count);
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/ipv6", dev, token, { count }, signal));
        data = bounded(data, "Lower count for large tables.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/ipv6" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_bgp_neighbors",
    label: "FortiGate: BGP Neighbors",
    description: "BGP neighbors (monitor/router/bgp/neighbors). Read-only.",
    promptSnippet: "FortiGate BGP neighbors",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/bgp/neighbors", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/bgp/neighbors" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_bgp_neighbors_ipv6",
    label: "FortiGate: BGP Neighbors IPv6",
    description: "BGP neighbors IPv6 (monitor/router/bgp/neighbors6). Read-only.",
    promptSnippet: "FortiGate BGP neighbors ipv6",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/bgp/neighbors6", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/bgp/neighbors6" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_bgp_neighbors_stats",
    label: "FortiGate: BGP Neighbors Stats",
    description: "BGP neighbors statistics (monitor/router/bgp/neighbors-statistics). Read-only.",
    promptSnippet: "FortiGate BGP neighbors stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/bgp/neighbors-statistics", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/bgp/neighbors-statistics" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_bgp_paths",
    label: "FortiGate: BGP Paths",
    description: "BGP paths (monitor/router/bgp/paths). Can be large. Read-only.",
    promptSnippet: "FortiGate BGP paths",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/bgp/paths", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/bgp/paths" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_bgp_paths_ipv6",
    label: "FortiGate: BGP Paths IPv6",
    description: "BGP paths IPv6 (monitor/router/bgp/paths6). Can be large. Read-only.",
    promptSnippet: "FortiGate BGP paths ipv6",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/bgp/paths6", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/bgp/paths6" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ospf_neighbors",
    label: "FortiGate: OSPF Neighbors",
    description: "OSPF neighbors (monitor/router/ospf/neighbors). Read-only.",
    promptSnippet: "FortiGate OSPF neighbors",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/ospf/neighbors", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/ospf/neighbors" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_policy_routes",
    label: "FortiGate: Policy Routes",
    description: "Policy routes (monitor/router/policy). Read-only.",
    promptSnippet: "FortiGate policy routes",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/policy", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/policy" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_policy_routes_ipv6",
    label: "FortiGate: Policy Routes IPv6",
    description: "Policy routes IPv6 (monitor/router/policy6). Read-only.",
    promptSnippet: "FortiGate policy routes ipv6",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/policy6", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/policy6" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sdwan_routes",
    label: "FortiGate: SD-WAN Routes",
    description: "SD-WAN routes (monitor/router/sdwan/routes). Read-only.",
    promptSnippet: "FortiGate SD-WAN routes",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/sdwan/routes", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/sdwan/routes" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sdwan_routes_ipv6",
    label: "FortiGate: SD-WAN Routes IPv6",
    description: "SD-WAN routes IPv6 (monitor/router/sdwan/routes6). Read-only.",
    promptSnippet: "FortiGate SD-WAN routes ipv6",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/sdwan/routes6", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/sdwan/routes6" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sdwan_routes_stats",
    label: "FortiGate: SD-WAN Routes Stats",
    description: "SD-WAN routes statistics (monitor/router/sdwan/routes-statistics). Read-only.",
    promptSnippet: "FortiGate SD-WAN routes stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/sdwan/routes-statistics", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/sdwan/routes-statistics" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_router_statistics",
    label: "FortiGate: Router Statistics",
    description: "Router statistics (monitor/router/statistics). Read-only.",
    promptSnippet: "FortiGate router statistics",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/statistics", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/statistics" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_route_lookup",
    label: "FortiGate: Route Lookup",
    description: "Route lookup (monitor/router/lookup). destination required. Read-only.",
    promptSnippet: "FortiGate route lookup",
    parameters: Type.Object({
      ...deviceParam,
      destination: Type.String({ description: "Destination IP or prefix to lookup" }),
      interface: Type.Optional(Type.String({ description: "Optional interface name" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const q: Record<string, unknown> = { destination: params.destination };
        if (params.interface) q.interface = params.interface;
        let data = fortiResults(await fortiGet("monitor/router/lookup", dev, token, q, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/lookup" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_route_lookup_policy",
    label: "FortiGate: Route Lookup Policy",
    description: "Route lookup policy (monitor/router/lookup-policy). destination required. Read-only.",
    promptSnippet: "FortiGate route lookup policy",
    parameters: Type.Object({
      ...deviceParam,
      destination: Type.String({ description: "Destination IP or prefix to lookup" }),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/router/lookup-policy", dev, token, { destination: params.destination }, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/router/lookup-policy" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
