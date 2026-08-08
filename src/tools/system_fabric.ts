/** Security Fabric, HA detail, central mgmt, sandbox, security-rating, SDN, botnet tools (21). FortiOS monitor GETs. Read-only. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export const SYSTEM_FABRIC_TOOL_NAMES = [
  "get_security_fabric",
  "get_fabric_pending_auth",
  "get_ha_checksums",
  "get_ha_nonsync_checksums",
  "get_ha_table_checksums",
  "get_ha_history",
  "get_ha_hw_interface",
  "get_cluster_state",
  "get_config_sync_status",
  "get_central_management_status",
  "get_fortimanager_status",
  "get_fortiguard_server_info",
  "get_sdn_connector_status",
  "get_sandbox_status",
  "get_sandbox_stats",
  "get_security_rating",
  "get_security_rating_status",
  "get_botnet_stat",
  "get_botnet_domains_stat",
  "get_config_revisions",
  "get_object_usage",
] as const;

export function registerSystemFabricTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_security_fabric",
    label: "FortiGate: Security Fabric",
    description: "Downstream fabric tree (monitor/system/csf). Read-only. Bounded.",
    promptSnippet: "FortiGate security fabric",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/csf", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/csf" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fabric_pending_auth",
    label: "FortiGate: Fabric Pending Auth",
    description: "Pending authorizations (monitor/system/csf/pending-authorizations). Read-only.",
    promptSnippet: "FortiGate fabric pending auth",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/csf/pending-authorizations", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/csf/pending-authorizations" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ha_checksums",
    label: "FortiGate: HA Checksums",
    description: "HA checksums (monitor/system/ha-checksums). Read-only.",
    promptSnippet: "FortiGate HA checksums",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/ha-checksums", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/ha-checksums" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ha_nonsync_checksums",
    label: "FortiGate: HA Nonsync Checksums",
    description: "HA nonsync checksums (monitor/system/ha-nonsync-checksums). Read-only.",
    promptSnippet: "FortiGate HA nonsync checksums",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/ha-nonsync-checksums", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/ha-nonsync-checksums" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ha_table_checksums",
    label: "FortiGate: HA Table Checksums",
    description: "HA table checksums (monitor/system/ha-table-checksums). Read-only.",
    promptSnippet: "FortiGate HA table checksums",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/ha-table-checksums", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/ha-table-checksums" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ha_history",
    label: "FortiGate: HA History",
    description: "HA history (monitor/system/ha-history). Read-only.",
    promptSnippet: "FortiGate HA history",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/ha-history", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/ha-history" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_ha_hw_interface",
    label: "FortiGate: HA HW Interface",
    description: "HA hardware interface (monitor/system/ha-hw-interface). Read-only.",
    promptSnippet: "FortiGate HA HW interface",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/ha-hw-interface", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/ha-hw-interface" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_cluster_state",
    label: "FortiGate: Cluster State",
    description: "SLBC cluster state (monitor/system/cluster/state). Read-only.",
    promptSnippet: "FortiGate cluster state",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/cluster/state", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/cluster/state" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_config_sync_status",
    label: "FortiGate: Config Sync Status",
    description: "Config sync status (monitor/system/config-sync/status). Read-only.",
    promptSnippet: "FortiGate config sync status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/config-sync/status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/config-sync/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_central_management_status",
    label: "FortiGate: Central Management Status",
    description: "Central management status (monitor/system/central-management/status). Read-only.",
    promptSnippet: "FortiGate central management status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/central-management/status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/central-management/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fortimanager_status",
    label: "FortiGate: FortiManager Status",
    description: "FortiManager status. On FortiOS 7.6+ the legacy endpoint (monitor/system/fortimanager/status) was removed; falls back to monitor/system/central-management/status with a note. Read-only.",
    promptSnippet: "FortiGate FortiManager status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        // Try legacy path first (pre-7.6 devices)
        let data: any;
        let path = "monitor/system/fortimanager/status";
        try {
          data = fortiResults(await fortiGet(path, dev, token, {}, signal));
        } catch (e: any) {
          if (e?.name === "AbortError") throw e;
          // 404 on FortiOS 7.6+ is expected — fall back to the replacement endpoint.
          if (e?.message?.startsWith("404")) {
            path = "monitor/system/central-management/status";
            data = fortiResults(await fortiGet(path, dev, token, {}, signal));
            data = { ...data, _note: "FortiOS 7.6+ removed monitor/system/fortimanager/status. This tool uses the replacement endpoint monitor/system/central-management/status. Data format may differ from pre-7.6." };
          } else {
            throw e;
          }
        }
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_fortiguard_server_info",
    label: "FortiGate: FortiGuard Server Info",
    description: "FortiGuard server info (monitor/system/fortiguard/server-info). Read-only.",
    promptSnippet: "FortiGate FortiGuard server info",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/fortiguard/server-info", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/fortiguard/server-info" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sdn_connector_status",
    label: "FortiGate: SDN Connector Status",
    description: "SDN connector status (monitor/system/sdn-connector/status). Read-only.",
    promptSnippet: "FortiGate SDN connector status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/sdn-connector/status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/sdn-connector/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sandbox_status",
    label: "FortiGate: Sandbox Status",
    description: "Sandbox status (monitor/system/sandbox/status). Read-only.",
    promptSnippet: "FortiGate sandbox status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/sandbox/status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/sandbox/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_sandbox_stats",
    label: "FortiGate: Sandbox Stats",
    description: "Sandbox stats (monitor/system/sandbox/stats). Read-only.",
    promptSnippet: "FortiGate sandbox stats",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/sandbox/stats", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/sandbox/stats" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_security_rating",
    label: "FortiGate: Security Rating",
    description: "Security rating (monitor/system/security-rating). Optional report_type query. Read-only.",
    promptSnippet: "FortiGate security rating",
    parameters: Type.Object({
      ...deviceParam,
      report_type: Type.Optional(Type.String({ description: "Report type" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const query: Record<string, unknown> = {};
        if (params.report_type != null) query.report_type = params.report_type;
        let data = fortiResults(await fortiGet("monitor/system/security-rating", dev, token, query, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/security-rating" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_security_rating_status",
    label: "FortiGate: Security Rating Status",
    description: "Security rating status (monitor/system/security-rating/status). Read-only.",
    promptSnippet: "FortiGate security rating status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/security-rating/status", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/security-rating/status" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_botnet_stat",
    label: "FortiGate: Botnet Stat",
    description: "Botnet stat (monitor/system/botnet/stat). Read-only.",
    promptSnippet: "FortiGate botnet stat",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/botnet/stat", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/botnet/stat" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_botnet_domains_stat",
    label: "FortiGate: Botnet Domains Stat",
    description: "Botnet domains stat (monitor/system/botnet-domains/stat). Read-only.",
    promptSnippet: "FortiGate botnet domains stat",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/botnet-domains/stat", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/botnet-domains/stat" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_config_revisions",
    label: "FortiGate: Config Revisions",
    description: "Config revisions (monitor/system/config-revision). Read-only.",
    promptSnippet: "FortiGate config revisions",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        let data = fortiResults(await fortiGet("monitor/system/config-revision", dev, token, {}, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/config-revision" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });

  pi.registerTool({
    name: "get_object_usage",
    label: "FortiGate: Object Usage",
    description: "Object usage (monitor/system/object/usage). Optional q_path, q_name query. Read-only.",
    promptSnippet: "FortiGate object usage",
    parameters: Type.Object({
      ...deviceParam,
      q_path: Type.Optional(Type.String({ description: "Query path" })),
      q_name: Type.Optional(Type.String({ description: "Query name" })),
    }),
    async execute(_id, params, signal) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const query: Record<string, unknown> = {};
        if (params.q_path != null) query.q_path = params.q_path;
        if (params.q_name != null) query.q_name = params.q_name;
        let data = fortiResults(await fortiGet("monitor/system/object/usage", dev, token, query, signal));
        data = bounded(data, "Narrow the query if truncated.", getMaxResponseBytes());
        return textResult(data, { device: name, path: "monitor/system/object/usage" });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
