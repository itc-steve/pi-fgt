/**
 * Known FortiOS 7.4 → 7.6 endpoint relocations.
 * Bundled docs describe 7.4.12; live devices may run 7.6.x where some paths
 * 404 with a bare body that looks identical to "wrong path" or "not licensed".
 * This table turns those 404s into an explicit "use X instead" message.
 */

import assert from "node:assert/strict";

export type ChangeKind = "REMOVED" | "DEPRECATED";

export interface EndpointRelocation {
  kind: ChangeKind;
  /** FortiOS version that removed or deprecated the path. */
  since: string;
  /** Replacement path (may include query-param hints). */
  use?: string;
  note?: string;
}

/** Bare monitor/... keys (no api/v2, no leading slash, no query). */
export const ENDPOINT_RELOCATIONS: Record<string, EndpointRelocation> = {
  "monitor/firewall/session": {
    kind: "REMOVED",
    since: "7.6.0",
    use: "monitor/firewall/sessions",
    note: "requires count=20..1000",
  },
  "monitor/system/fortimanager/status": {
    kind: "REMOVED",
    since: "7.6.0",
    use: "monitor/system/central-management/status",
  },
  "monitor/switch-controller/managed-switch/health": {
    kind: "REMOVED",
    since: "7.6.0",
    use: "monitor/switch-controller/managed-switch/health-status",
  },
  "monitor/fortiview/statistics": {
    kind: "REMOVED",
    since: "7.6.0",
    use: "monitor/fortiview/realtime-statistics",
  },
  // Still answers 200 with {} on 7.6.7 — table for proactive/escape-hatch use
  "monitor/virtual-wan/health-check": {
    kind: "DEPRECATED",
    since: "7.6.4",
    use: "monitor/virtual-wan/sla-log?latest=1&sla=NAME",
    note: "still returns 200 with {} on 7.6.7; prefer sla-log",
  },
  // Removed write/UI paths we never call (read-only tool set) — escape-hatch clarity
  "monitor/system/config/backup": {
    kind: "REMOVED",
    since: "7.6.0",
  },
  "monitor/user/device/remove": {
    kind: "REMOVED",
    since: "7.6.0",
  },
  "monitor/web-ui/language/import": {
    kind: "REMOVED",
    since: "7.6.0",
  },
  "monitor/telemetry-controller/agents": {
    kind: "REMOVED",
    since: "7.6.4",
  },
};

/** Strip api/v2 prefix, leading slash, query string. */
export function normalizeMonitorPath(path: string): string {
  return path
    .replace(/^\/+/, "")
    .replace(/^api\/v2\//i, "")
    .split("?")[0]!
    .replace(/\/+$/, "");
}

/**
 * Enriched 404 text when `path` is a known relocation, else undefined.
 * `deviceVersion` is the live FortiOS version when known (e.g. "7.6.7" or "v7.6.7").
 */
export function relocationMessage(
  path: string,
  deviceVersion?: string | null,
): string | undefined {
  const key = normalizeMonitorPath(path);
  const r = ENDPOINT_RELOCATIONS[key];
  if (!r) return undefined;

  const ver = deviceVersion?.replace(/^v/i, "") || undefined;
  let msg = `404: ${key} was ${r.kind} in FortiOS ${r.since}.`;
  if (ver) msg += ` This device runs ${ver}.`;
  if (r.use) {
    msg += ` Use ${r.use}`;
    if (r.note) msg += ` (${r.note})`;
    msg += ".";
  } else if (r.note) {
    msg += ` ${r.note}.`;
  }
  return msg;
}

// Self-check: fails if relocation-message enrichment regresses.
if (import.meta.main) {
  const msg = relocationMessage("monitor/firewall/session", "7.6.7");
  assert.ok(msg, "known removed path must enrich");
  assert.match(msg, /REMOVED/);
  assert.match(msg, /7\.6\.0/);
  assert.match(msg, /This device runs 7\.6\.7/);
  assert.match(msg, /monitor\/firewall\/sessions/);
  assert.match(msg, /count=20\.\.1000/);

  // path normalization
  assert.equal(
    relocationMessage("/api/v2/monitor/firewall/session?vdom=root", "v7.6.7"),
    msg,
  );

  assert.equal(
    relocationMessage("monitor/nope/nowhere", "7.6.7"),
    undefined,
    "unknown path must not enrich",
  );

  console.log("version ok", msg);
}
