/** System / health tools (10). Full parity with upstream. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, runForti, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";
import { ENDPOINT_RELOCATIONS } from "../version.js";

/** Parse FortiOS "v7.6.7" / "7.6.7" → [7,6,7]. Numeric so 7.10 > 7.6. */
function parseFortiVersion(raw: unknown): number[] | null {
  if (typeof raw !== "string") return null;
  const m = raw.replace(/^v/i, "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3] || 0)];
}

function versionAtLeast(v: number[], major: number, minor: number): boolean {
  return v[0]! > major || (v[0] === major && v[1]! >= minor);
}

/**
 * One-shot advisory for triage: device ≥7.6, bundled docs are 7.4.12, list
 * confirmed REMOVED→replacement paths. Silent on 7.4 (docs match).
 * Key starts with `_` so filters keep it past allowlists (engine.ts).
 */
function fortiosNotes(payload: any): string | undefined {
  const raw =
    payload?.results?.version ?? payload?.version ?? payload?.results?.os_version;
  const v = parseFortiVersion(raw);
  if (!v || !versionAtLeast(v, 7, 6)) return undefined;

  // ponytail: only REMOVED+use entries — those are the confirmed 404→replacement pairs
  const moves = Object.entries(ENDPOINT_RELOCATIONS)
    .filter(([, r]) => r.kind === "REMOVED" && r.use)
    .map(([old, r]) => {
      const a = old.replace(/^monitor\//, "");
      const b = r.use!.replace(/^monitor\//, "");
      return r.note ? `${a}→${b} (${r.note})` : `${a}→${b}`;
    });

  const ver = String(raw).replace(/^v/i, "");
  return (
    `device ${ver} (≥7.6); bundled docs=7.4.12 (stale). ` +
    `relocations: ${moves.join("; ")}`
  );
}

export function registerSystemTools(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "get_system_status",
    label: "FortiGate: System Status",
    description:
      "Hostname/serial/model/FortiOS version + log_disk_status (monitor/system/status). " +
      "First call for any triage. log_disk_status=not_available ⇒ use source=memory for logs. Read-only.",
    promptSnippet: "FortiGate system status (hostname/serial/firmware)",
    parameters: Type.Object({ ...deviceParam }),
    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      try {
        const { name, device: dev } = resolveDevice(params.device);
        const token = getToken(dev);
        onUpdate?.({
          content: [{ type: "text", text: `*fg ${name} monitor/system/status*` }],
        });
        let data: any = await fortiGet("monitor/system/status", dev, token, {}, signal);
        const notes = fortiosNotes(data);
        if (notes && data && typeof data === "object" && !Array.isArray(data)) {
          data = { ...data, _fortios_notes: notes };
        }
        return textResult(
          bounded(
            data,
            "Narrow the query / lower count / use a single-object tool. Or set maxResponseBytes in fortigate.json.",
            getMaxResponseBytes(),
          ),
          { device: name, path: "monitor/system/status" },
        );
      } catch (e: any) {
        if (e?.name === "AbortError") throw e;
        return textResult(`Error: ${e?.message || String(e)}`);
      }
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
      // Field selection is config-driven (filters tools.get_interfaces_status);
      // only the name= search happens here.
      if (nameQ && data && typeof data === "object" && !Array.isArray(data)) {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(data as Record<string, any>)) {
          if (!k.toLowerCase().includes(nameQ) && !String(v?.name || "").toLowerCase().includes(nameQ)) {
            continue;
          }
          out[k] = v;
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
        // Health subset is config-driven (filters tools.get_available_licenses).
        const data = {
          ...raw,
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
