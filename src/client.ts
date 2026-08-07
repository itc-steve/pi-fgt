/** GET-only FortiOS client (undici). Multi-device. tokenEnv resolved by caller. vdom always pinned. */

import { fetch, Agent } from "undici";
import { relocationMessage } from "./version.js";

const DEFAULT_TIMEOUT_MS = 30_000;

/** Known Node/OpenSSL certificate failure codes (often on err.cause under Undici). */
const TLS_CERT_CODES = new Set([
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "ERR_SSL_WRONG_VERSION_NUMBER",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "CERT_UNTRUSTED",
  "HOSTNAME_MISMATCH",
]);

/**
 * True if error or any nested `.cause` looks like a TLS/certificate failure.
 * Undici often surfaces `TypeError: fetch failed` with cert detail only on `cause.code`.
 */
export function isTlsFailure(err: unknown): boolean {
  let cur: any = err;
  const seen = new Set<any>();
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const code = cur.code != null ? String(cur.code) : "";
    if (code && TLS_CERT_CODES.has(code)) return true;
    const msg = String(cur.message ?? cur.reason ?? "");
    if (
      /TLS|SSL|certificate|self[-\s]?signed|UNABLE_TO_VERIFY|DEPTH_ZERO|CERT_|hostname\/IP does not match/i.test(
        msg,
      )
    ) {
      return true;
    }
    // Also scan stringified cause fragments without assuming shape
    if (code && /CERT|TLS|SSL|UNABLE_TO_VERIFY|DEPTH_ZERO/i.test(code)) return true;
    cur = cur.cause;
  }
  // Bare string errors
  if (typeof err === "string" && /TLS|certificate|SSL|self[-\s]?signed/i.test(err)) return true;
  return false;
}

/** Reuse TLS agents per verifySsl setting (avoid new Agent per request). */
const agentCache = new Map<boolean, Agent>();

function getAgent(verifySsl: boolean): Agent {
  let agent = agentCache.get(verifySsl);
  if (!agent) {
    agent = new Agent({
      connect: { rejectUnauthorized: verifySsl },
    });
    agentCache.set(verifySsl, agent);
  }
  return agent;
}

function timeoutSignal(signal?: AbortSignal, timeoutMs = DEFAULT_TIMEOUT_MS): AbortSignal {
  const t = AbortSignal.timeout(timeoutMs);
  if (!signal) return t;
  return AbortSignal.any([signal, t]);
}

/** Short hints when escape-hatch paths miss (stop blind guessing). */
export const MONITOR_HINTS =
  "Bare path only (no api/v2). Common monitor paths: wifi/managed_ap, wifi/client, " +
  "switch-controller/managed-switch/status, network/arp, system/dhcp, router/ipv4, firewall/sessions. " +
  "Prefer typed tools: get_fortiaps, get_wifi_clients, get_fortiswitches, get_switch_port_status, get_arp_table.";

export const CMDB_HINTS =
  "Bare path only (no api/v2). Common cmdb tables: firewall/policy, firewall/address, " +
  "system/interface, system/zone, router/static, wireless-controller/wtp, switch-controller/managed-switch. " +
  "Live state (wifi/*, network/arp, firewall/sessions, router/ipv4) is NOT in cmdb — use get_monitor_resource. " +
  "Prefer typed tools: get_firewall_policies, get_address_objects, get_interfaces_config.";

/** Generic fallback; kept for callers without a namespaced path. */
export const PATH_HINTS = MONITOR_HINTS;

/** Pick hints matching the namespace actually requested (cmdb vs monitor). */
function hintsFor(path?: string): string {
  if (path && /^cmdb\//i.test(path)) return CMDB_HINTS;
  return MONITOR_HINTS;
}

/** FortiOS error bodies often include { version: "v7.6.7", ... }. */
function deviceVersionFromBody(text: string): string | undefined {
  if (!text) return undefined;
  try {
    const j = JSON.parse(text) as { version?: unknown };
    if (typeof j?.version === "string") return j.version.replace(/^v/i, "");
  } catch {
    /* bare 404 */
  }
  return undefined;
}

function sanitizeError(status: number, text: string, path?: string): string {
  const safe = text
    .replace(/(bearer|token)\s+[\w.\/-]{8,}/gi, "$1 [redacted]")
    .replace(
      /(api[-_]?key|bearer|token|authorization|secret|password)["']?\s*[:=]\s*["']?[\w.\/-]{8,}/gi,
      "[redacted]",
    )
    .slice(0, 300);
  if (status === 401) return `401 Unauthorized: token rejected for this device (check tokenEnv).`;
  if (status === 403) return `403 Forbidden: token lacks permission / trusthost / VDOM scope.`;
  if (status === 404) {
    // Known 7.4→7.6 relocations: name the replacement so the AI does not retry/guess
    if (path) {
      const enriched = relocationMessage(path, deviceVersionFromBody(text));
      if (enriched) return enriched;
    }
    return `404 Not found (check path and VDOM). ${hintsFor(path)}`;
  }
  if (status === 400 || status === 405) {
    const why = /^cmdb\//i.test(path || "")
      ? `no such cmdb table (a monitor-only resource returns ${status} here, not 404)`
      : "bad or non-GET path for this resource";
    return `FortiGate API error ${status}: ${why}. ${hintsFor(path)} Body: ${safe}`;
  }
  if (status === 424) {
    return (
      `424 Failed Dependency: the request is missing a required parameter, or a ` +
      `prerequisite feature/setting is not enabled on the device. This is NOT a ` +
      `licensing error. Check that all required query params are supplied (e.g. ` +
      `traffic-history/interface needs interface=), or that the related feature ` +
      `(e.g. FortiView app bandwidth tracking) is enabled. Body: ${safe}`
    );
  }
  if (status === 429) return `429 Rate limit. Retry later.`;
  return `FortiGate API error ${status}: ${safe}`;
}

export interface DeviceLike {
  url: string;
  vdom?: string;
  verifySsl?: boolean;
}

export async function fortiGet(
  path: string,
  device: DeviceLike,
  token: string,
  params: Record<string, any> = {},
  signal?: AbortSignal,
): Promise<any> {
  if (!device.url) throw new Error("device.url missing");
  const base = device.url.replace(/\/$/, "");
  const p = path.replace(/^\//, "");

  // Always pin device VDOM; never allow caller override via params.vdom
  const qs = new URLSearchParams();
  qs.set("vdom", device.vdom || "root");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (k === "vdom" || v === undefined || v === null) continue;
      qs.set(k, String(v));
    }
  }
  const url = `${base}/api/v2/${p}?${qs.toString()}`;

  const verifySsl = device.verifySsl !== false;
  const agent = getAgent(verifySsl);

  const s = timeoutSignal(signal);

  let res: any;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "pi-fgt/1.1 (read-only)",
      },
      dispatcher: agent,
      signal: s,
    });
  } catch (e: any) {
    if (e.name === "AbortError" || (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError")) {
      throw e;
    }
    // Walk cause chain — Undici "fetch failed" + DEPTH_ZERO_SELF_SIGNED_CERT etc.
    if (isTlsFailure(e)) {
      throw new Error("TLS verification failed. Set verifySsl:false for self-signed in config.");
    }
    throw new Error(`Network error contacting FortiGate: ${e.message || e}`);
  }

  const status = res.status;
  const text = await res.text().catch(() => "");
  if (status === 200) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("FortiGate returned a non-JSON 200 response.");
    }
  }

  throw new Error(sanitizeError(status, text, p));
}

export function fortiResults(data: any): any {
  if (data && typeof data === "object" && "results" in data) {
    return data.results;
  }
  return data;
}
