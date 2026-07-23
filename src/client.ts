/** GET-only FortiOS client (undici). Multi-device. tokenEnv resolved by caller. vdom always pinned. */

import { fetch, Agent } from "undici";

const DEFAULT_TIMEOUT_MS = 30_000;

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
export const PATH_HINTS =
  "Bare path only (no api/v2). Common monitors: wifi/managed_ap, wifi/client, " +
  "switch-controller/managed-switch/status, network/arp, system/dhcp, router/ipv4, firewall/session. " +
  "Prefer typed tools: get_fortiaps, get_wifi_clients, get_fortiswitches, get_switch_port_status, get_arp_table.";

function sanitizeError(status: number, text: string): string {
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
    return `404 Not found (check path and VDOM). ${PATH_HINTS}`;
  }
  if (status === 400 || status === 405) {
    return `FortiGate API error ${status}: bad or non-GET path for this resource. ${PATH_HINTS} Body: ${safe}`;
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
    if (/certificate|tls|verify/i.test(String(e))) {
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

  throw new Error(sanitizeError(status, text));
}

export function fortiResults(data: any): any {
  if (data && typeof data === "object" && "results" in data) {
    return data.results;
  }
  return data;
}
