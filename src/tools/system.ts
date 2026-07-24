/** System / health tools (10). Full parity with upstream. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, runForti, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export function registerSystemTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_system_status",
    label: "FortiGate: System Status",
    description:
      "Hostname/serial/model/FortiOS version + log_disk_status (monitor/system/status). " +
      "First call for any triage. log_disk_status=not_available ⇒ use source=memory for logs. Read-only.",
    promptSnippet: "FortiGate system status (hostname/serial/firmware)",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runForti("monitor/system/status", params, signal, onUpdate, ctx);
    },
  });

  pi.registerTool({
    name: "get_system_resource_usage",
    label: "FortiGate: Resource Usage",
    description:
      "Live CPU/mem/sessions/disk (monitor/system/resource/usage). " +
      "Returns {metric: {current, latest}} only — multi-minute historical series stripped.",
    promptSnippet: "FortiGate resource usage (CPU/mem)",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runForti("monitor/system/resource/usage", params, signal, onUpdate, ctx, {
        summarizeResources: true,
        boundHint: "Resource history already reduced to latest sample.",
      });
    },
  });

  pi.registerTool({
    name: "get_system_performance",
    label: "FortiGate: Performance",
    description:
      "CPU/mem/disk/session counters (monitor/system/resource/usage). " +
      "Latest sample only — not full history series. " +
      "(resource= query is omitted: FortiOS 7.4 returns 400 for it.)",
    promptSnippet: "FortiGate performance counters",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      // ponytail: do not pass resource= — 7.4.12 returns 400
      return runForti("monitor/system/resource/usage", params, signal, onUpdate, ctx, {
        summarizeResources: true,
        boundHint: "Resource history already reduced to latest sample.",
      });
    },
  });

  pi.registerTool({
    name: "get_system_time",
    label: "FortiGate: System Time",
    description: "System time and tz (monitor/system/time).",
    promptSnippet: "FortiGate system time",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runForti("monitor/system/time", params, signal, onUpdate, ctx);
    },
  });

  pi.registerTool({
    name: "get_firmware_status",
    label: "FortiGate: Firmware Status",
    description: "Firmware (monitor/system/firmware).",
    promptSnippet: "FortiGate firmware",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runForti("monitor/system/firmware", params, signal, onUpdate, ctx);
    },
  });

  pi.registerTool({
    name: "get_system_sensors",
    label: "FortiGate: Sensors",
    description: "Hardware sensors (monitor/system/sensor-info). bounded.",
    promptSnippet: "FortiGate sensors",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      const data = await fortiGet("monitor/system/sensor-info", dev, token, {}, signal);
      return textResult(bounded(data, "Sensor lists are short on most models.", getMaxResponseBytes()), { device: name });
    },
  });

  pi.registerTool({
    name: "get_ha_status",
    label: "FortiGate: HA Status",
    description: "HA statistics (monitor/system/ha-statistics).",
    promptSnippet: "FortiGate HA status",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runForti("monitor/system/ha-statistics", params, signal, onUpdate, ctx);
    },
  });

  pi.registerTool({
    name: "get_ha_peers",
    label: "FortiGate: HA Peers",
    description: "HA peers (monitor/system/ha-peer).",
    promptSnippet: "FortiGate HA peers",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return runForti("monitor/system/ha-peer", params, signal, onUpdate, ctx);
    },
  });

  pi.registerTool({
    name: "get_interfaces_status",
    label: "FortiGate: Interfaces Status",
    description:
      "Live interface link/IP/counters (monitor/system/interface). " +
      "Optional name= substring (e.g. wan, vlan). Results are a name→stats map.",
    promptSnippet: "FortiGate interface status",
    parameters: Type.Object({
      ...deviceParam,
      name: Type.Optional(Type.String({ description: "Substring filter on interface name" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { name, device: dev } = resolveDevice(params.device);
      const token = getToken(dev);
      let data: any = fortiResults(await fortiGet("monitor/system/interface", dev, token, {}, signal));
      const nameQ = String(params.name || "").trim().toLowerCase();
      const KEEP = [
        "id", "name", "alias", "ip", "mask", "link", "speed", "duplex",
        "mac", "tx_bytes", "rx_bytes", "tx_packets", "rx_packets",
        "tx_errors", "rx_errors", "tx_dropped", "rx_dropped",
      ];
      if (data && typeof data === "object" && !Array.isArray(data)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(data as Record<string, any>)) {
          if (nameQ && !k.toLowerCase().includes(nameQ) && !String(v?.name || "").toLowerCase().includes(nameQ)) {
            continue;
          }
          if (v && typeof v === "object") {
            const slim: Record<string, unknown> = {};
            for (const f of KEEP) if (f in v) slim[f] = v[f];
            out[k] = slim;
          } else {
            out[k] = v;
          }
        }
        data = out;
      }
      return textResult(
        bounded(data, "Filter with name= (wan, vlan, …).", getMaxResponseBytes()),
        { device: name },
      );
    },
  });

  pi.registerTool({
    name: "get_available_licenses",
    label: "FortiGate: Licenses",
    description:
      "Available licenses (monitor/license/status). " +
      "Default = health subset (fortiguard/forticare/av/ips/webfilter/forticloud/vdom). " +
      "verbose=true for full entitlement dump (~40 keys).",
    promptSnippet: "FortiGate licenses",
    parameters: Type.Object({
      ...deviceParam,
      verbose: Type.Optional(Type.Boolean({ description: "Full entitlement dump" })),
    }),
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (params.verbose) {
        return runForti("monitor/license/status", params, signal, onUpdate, ctx);
      }
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        const raw: any = fortiResults(
          await fortiGet("monitor/license/status", dev, token, {}, signal),
        );
        // Health-check projection — drop no_license SaaS noise
        const pick = (obj: any, keys: string[]) => {
          if (!obj || typeof obj !== "object") return obj;
          const out: Record<string, unknown> = {};
          for (const k of keys) if (k in obj) out[k] = obj[k];
          return out;
        };
        const data = {
          fortiguard: pick(raw.fortiguard, ["status", "connected", "has_connected"]),
          forticare: pick(raw.forticare, ["status", "expires", "support_level"]),
          antivirus: pick(raw.antivirus, ["status", "expires", "version"]),
          ips: pick(raw.ips, ["status", "expires", "version"]),
          web_filtering: pick(raw.web_filtering, ["status", "expires"]),
          forticloud: pick(raw.forticloud, ["status"]),
          vdom: pick(raw.vdom, ["used", "max", "can_upgrade"]),
          _note: "health subset; pass verbose=true for full entitlement dump",
        };
        return textResult(bounded(data, "verbose=true for all entitlements.", getMaxResponseBytes()), {
          device: name,
          path: "monitor/license/status",
        });
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
    },
  });
}
