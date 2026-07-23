/** UTM / endpoint / wanopt read-only tools (18). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export const UTM_ENDPOINT_TOOL_NAMES = [
  "get_antivirus_stats",
  "get_app_categories",
  "get_blacklisted_certs",
  "get_ips_anomalies",
  "get_ips_hold_signatures",
  "get_ips_rate_based",
  "get_ips_session_performance",
  "get_webfilter_categories",
  "get_webfilter_category_quota",
  "get_webfilter_overrides",
  "get_videofilter_categories",
  "get_endpoint_summary",
  "get_endpoint_records",
  "get_ems_status_summary",
  "get_ems_status",
  "get_wanopt_history",
  "get_wanopt_peer_stats",
  "get_webcache_stats",
] as const;

export function registerUtmEndpointTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_antivirus_stats",
    label: "FortiGate: Antivirus Stats",
    description: "Antivirus stats (monitor/utm/antivirus/stats). Read-only.",
    promptSnippet: "FortiGate antivirus stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/utm/antivirus/stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/utm/antivirus/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_app_categories",
    label: "FortiGate: App Categories",
    description: "Application categories (monitor/utm/application-categories). Read-only.",
    promptSnippet: "FortiGate application categories",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/utm/application-categories", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/utm/application-categories" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_blacklisted_certs",
    label: "FortiGate: Blacklisted Certs",
    description: "Blacklisted certificates (monitor/utm/blacklisted-certificates). Read-only. Bounded.",
    promptSnippet: "FortiGate blacklisted certificates",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/utm/blacklisted-certificates", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/utm/blacklisted-certificates" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ips_anomalies",
    label: "FortiGate: IPS Anomalies",
    description: "IPS anomalies (monitor/ips/anomaly). Read-only.",
    promptSnippet: "FortiGate IPS anomalies",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/ips/anomaly", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/ips/anomaly" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ips_hold_signatures",
    label: "FortiGate: IPS Hold Signatures",
    description: "IPS hold signatures (monitor/ips/hold-signatures). Read-only.",
    promptSnippet: "FortiGate IPS hold signatures",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/ips/hold-signatures", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/ips/hold-signatures" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ips_rate_based",
    label: "FortiGate: IPS Rate Based",
    description: "IPS rate-based (monitor/ips/rate-based). Read-only.",
    promptSnippet: "FortiGate IPS rate based",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/ips/rate-based", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/ips/rate-based" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ips_session_performance",
    label: "FortiGate: IPS Session Performance",
    description: "IPS session performance (monitor/ips/session/performance). Read-only.",
    promptSnippet: "FortiGate IPS session performance",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/ips/session/performance", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/ips/session/performance" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_webfilter_categories",
    label: "FortiGate: Webfilter Categories",
    description: "Webfilter FortiGuard categories (monitor/webfilter/fortiguard-categories). Read-only.",
    promptSnippet: "FortiGate webfilter categories",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/webfilter/fortiguard-categories", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/webfilter/fortiguard-categories" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_webfilter_category_quota",
    label: "FortiGate: Webfilter Category Quota",
    description: "Webfilter category quota (monitor/webfilter/category-quota). Read-only.",
    promptSnippet: "FortiGate webfilter category quota",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/webfilter/category-quota", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/webfilter/category-quota" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_webfilter_overrides",
    label: "FortiGate: Webfilter Overrides",
    description: "Webfilter overrides (monitor/webfilter/override). Read-only.",
    promptSnippet: "FortiGate webfilter overrides",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/webfilter/override", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/webfilter/override" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_videofilter_categories",
    label: "FortiGate: Videofilter Categories",
    description: "Videofilter FortiGuard categories (monitor/videofilter/fortiguard-categories). Read-only.",
    promptSnippet: "FortiGate videofilter categories",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/videofilter/fortiguard-categories", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/videofilter/fortiguard-categories" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_endpoint_summary",
    label: "FortiGate: Endpoint Summary",
    description: "FortiClient endpoint summary (monitor/endpoint-control/summary). Read-only.",
    promptSnippet: "FortiGate endpoint summary",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/endpoint-control/summary", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/endpoint-control/summary" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_endpoint_records",
    label: "FortiGate: Endpoint Records",
    description: "Endpoint control record list (monitor/endpoint-control/record-list). Read-only. Bounded — large.",
    promptSnippet: "FortiGate endpoint records",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/endpoint-control/record-list", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/endpoint-control/record-list" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ems_status_summary",
    label: "FortiGate: EMS Status Summary",
    description: "EMS status summary (monitor/endpoint-control/ems/status-summary). Read-only.",
    promptSnippet: "FortiGate EMS status summary",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/endpoint-control/ems/status-summary", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/endpoint-control/ems/status-summary" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ems_status",
    label: "FortiGate: EMS Status",
    description: "EMS status (monitor/endpoint-control/ems/status). Optional ems_name. Read-only.",
    promptSnippet: "FortiGate EMS status",
    parameters: Type.Object({
      ...deviceParam,
      ems_name: Type.Optional(Type.String({ description: "EMS name" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const q: Record<string, unknown> = {};
        if (params.ems_name) q.ems_name = params.ems_name;
        let data = fortiResults(await fortiGet("monitor/endpoint-control/ems/status", dev, token, q, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/endpoint-control/ems/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wanopt_history",
    label: "FortiGate: WANopt History",
    description: "WAN optimization history (monitor/wanopt/history). Read-only.",
    promptSnippet: "FortiGate WANopt history",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wanopt/history", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wanopt/history" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_wanopt_peer_stats",
    label: "FortiGate: WANopt Peer Stats",
    description: "WAN optimization peer stats (monitor/wanopt/peer_stats). Read-only.",
    promptSnippet: "FortiGate WANopt peer stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/wanopt/peer_stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/wanopt/peer_stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_webcache_stats",
    label: "FortiGate: Webcache Stats",
    description: "Web cache stats (monitor/webcache/stats). Read-only.",
    promptSnippet: "FortiGate webcache stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/webcache/stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/webcache/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
