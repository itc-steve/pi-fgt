/** Users read-only tools (13). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export const USER_TOOL_NAMES = [
  "get_firewall_users",
  "get_firewall_user_count",
  "get_proxy_users",
  "get_proxy_user_count",
  "get_banned_users",
  "get_banned_check",
  "get_user_devices",
  "get_user_device_stats",
  "get_fsso_status",
  "get_fortitokens",
  "get_fortitoken_cloud_status",
  "get_collected_emails",
  "get_user_info_query",
] as const;

export function registerUserTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_firewall_users",
    label: "FortiGate: Firewall Users",
    description: "Authenticated firewall users (monitor/user/firewall). Read-only.",
    promptSnippet: "FortiGate firewall users",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/firewall", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/firewall" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_firewall_user_count",
    label: "FortiGate: Firewall User Count",
    description: "Firewall user count (monitor/user/firewall/count). Read-only.",
    promptSnippet: "FortiGate firewall user count",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/firewall/count", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/firewall/count" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_proxy_users",
    label: "FortiGate: Proxy Users",
    description: "Proxy users (monitor/user/proxy). Read-only.",
    promptSnippet: "FortiGate proxy users",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/proxy", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/proxy" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_proxy_user_count",
    label: "FortiGate: Proxy User Count",
    description: "Proxy user count (monitor/user/proxy/count). Read-only.",
    promptSnippet: "FortiGate proxy user count",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/proxy/count", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/proxy/count" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_banned_users",
    label: "FortiGate: Banned Users",
    description: "Banned users by IP (monitor/user/banned). Read-only.",
    promptSnippet: "FortiGate banned users",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/banned", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/banned" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_banned_check",
    label: "FortiGate: Banned Check",
    description: "Banned user check by IP (monitor/user/banned/check). ip_address required. Read-only.",
    promptSnippet: "FortiGate banned check",
    parameters: Type.Object({
      ...deviceParam,
      ip_address: Type.String({ description: "IP address to check" }),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/banned/check", dev, token, { ip_address: params.ip_address }, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/banned/check" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_user_devices",
    label: "FortiGate: User Devices",
    description: "User devices query (monitor/user/device/query). Device store can be large. Read-only.",
    promptSnippet: "FortiGate user devices",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/device/query", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated. Device store can be large.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/device/query" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_user_device_stats",
    label: "FortiGate: User Device Stats",
    description: "User device stats (monitor/user/device/stats). Optional key. Read-only.",
    promptSnippet: "FortiGate user device stats",
    parameters: Type.Object({
      ...deviceParam,
      key: Type.Optional(Type.String({ description: "Optional stats key" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const q: Record<string, unknown> = {};
        if (params.key) q.key = params.key;
        let data = fortiResults(await fortiGet("monitor/user/device/stats", dev, token, q, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/device/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fsso_status",
    label: "FortiGate: FSSO Status",
    description: "FSSO + polling status (monitor/user/fsso). Read-only.",
    promptSnippet: "FortiGate FSSO status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/fsso", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/fsso" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fortitokens",
    label: "FortiGate: FortiTokens",
    description: "FortiToken map + status (monitor/user/fortitoken). Read-only.",
    promptSnippet: "FortiGate fortitokens",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/fortitoken", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/fortitoken" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fortitoken_cloud_status",
    label: "FortiGate: FortiToken Cloud Status",
    description: "FortiToken cloud status (monitor/user/fortitoken-cloud/status). Read-only.",
    promptSnippet: "FortiGate fortitoken cloud status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/fortitoken-cloud/status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/fortitoken-cloud/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_collected_emails",
    label: "FortiGate: Collected Emails",
    description: "Collected captive portal emails (monitor/user/collected-email). Read-only.",
    promptSnippet: "FortiGate collected emails",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/collected-email", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/collected-email" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_user_info_query",
    label: "FortiGate: User Info Query",
    description: "User info query (monitor/user/info/query). Can be large. Read-only.",
    promptSnippet: "FortiGate user info query",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/user/info/query", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated. Can be large.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/user/info/query" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
