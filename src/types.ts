/** Shared types for pi-fgt. */

export interface DeviceConfig {
  url: string;
  tokenEnv: string;
  vdom?: string;
  verifySsl?: boolean;
}

/** Fields accepted when creating/editing a device (token never stored in DeviceConfig). */
export interface DeviceInput {
  url: string;
  vdom?: string;
  verifySsl?: boolean;
  /**
   * Edit only: change key only if it matches ^FORTIGATE_[A-Z0-9_]+_TOKEN$.
   * Add always auto-generates; legacy weak keys kept when already in JSON.
   */
  tokenEnv?: string;
  /** Optional token to store (session memory or fortigate.env). Never written to JSON. */
  token?: string;
}

/** Where the device record lives. */
export type DeviceStorage = "session" | "persistent";

/**
 * Which source would supply the token right now (never the value).
 * Resolution order: session → process.env → fortigate.env.
 */
export type CredentialSource = "session" | "process" | "env-file" | "none";

/** Session start default for FortiGate tools. "off" = must /fortigate on each new session. */
export type SessionDefault = "on" | "off";

export interface FortiConfig {
  maxResponseBytes?: number;
  /**
   * Whether FortiGate tools are active at session_start.
   * Default: "off" — use `/fortigate on` each new session.
   */
  sessionDefault?: SessionDefault;
  devices: Record<string, DeviceConfig>;
}

export interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details?: Record<string, unknown>;
}

export interface BoundedEnvelope {
  _truncated?: boolean;
  _returned?: number;
  _total?: number;
  _bytes_cap?: number;
  _hint?: string;
  _original_bytes?: number;
  preview?: string;
  data?: any;
}

// *_KEEP field allowlists moved to src/filters/defaults.ts in v1.3.0 so users
// can see and change them via ~/.pi/agent/fortigate-filters.json.

export const ALLOWED_PROFILE_TYPES: Record<string, string> = {
  "antivirus": "antivirus/profile",
  "ips": "ips/sensor",
  "webfilter": "webfilter/profile",
  "application": "application/list",
  "dnsfilter": "dnsfilter/profile",
  "ssl-ssh": "firewall/ssl-ssh-profile",
  "file-filter": "file-filter/profile",
  "emailfilter": "emailfilter/profile",
};

export const ALLOWED_LOG_SOURCES = new Set(["memory", "disk", "fortianalyzer", "forticloud"]);
export const ALLOWED_LOG_TYPES = new Set([
  "traffic", "event", "utm", "virus", "webfilter", "ips",
  "anomaly", "app-ctrl", "dlp", "emailfilter",
]);

export const PER_PAGE_CAP = 50;
/** Default tool output cap (~6–8k tokens). Was 120k and blew model context. */
export const DEFAULT_MAX_RESPONSE_BYTES = 24000;
