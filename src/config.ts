/** Config loader for pi-fgt.
 *  JSON: ~/.pi/agent/fortigate.json  (device map, tokenEnv names — no secrets)
 *  ENV:  ~/.pi/agent/fortigate.env   (KEY=value secrets next to JSON)
 *  Resolution order for tokens: process.env[tokenEnv] first, then fortigate.env.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DeviceConfig, FortiConfig } from "./types.js";

const AGENT_DIR = join(process.env.HOME || process.env.USERPROFILE || "~", ".pi", "agent");
const CONFIG_PATH = join(AGENT_DIR, "fortigate.json");
const ENV_PATH = join(AGENT_DIR, "fortigate.env");

let cached: FortiConfig | null = null;
let cacheTime = 0;
let envFileCache: Record<string, string> | null = null;
let envFileCacheTime = 0;
const TTL_MS = 10_000;

export function configPath(): string {
  return CONFIG_PATH;
}

export function envPath(): string {
  return ENV_PATH;
}

// ---------------------------------------------------------------------------
// Device exposure — SESSION-LOCAL, IN-MEMORY, NEVER PERSISTED.
//
// Every device starts hidden from the AI. The human selects which ones this
// session may see via /fortigate (the picker). One pi process = one session,
// so this Set is the isolation boundary: other terminals are untouched, and
// nothing on disk (fortigate.json included) can pre-enable a device.
//
// "Hidden" means hidden from the MODEL: not listed, not resolvable. The human
// always sees every configured device in the picker.
// ---------------------------------------------------------------------------

const enabled = new Set<string>();

/** Drop all selections (call on session_start — back to all-hidden). */
export function resetSessionVisibility(): void {
  enabled.clear();
}

/** Device keys the AI may see this session. */
export function enabledDevices(): Set<string> {
  return new Set(enabled);
}

export function isDeviceEnabled(name: string): boolean {
  return enabled.has(name);
}

/** Expose/hide a device from the AI for this session only. */
export function setDeviceEnabled(name: string, on: boolean): void {
  if (on) enabled.add(name);
  else enabled.delete(name);
}

/** Parse KEY=VALUE dotenv (no export keyword required). Quotes stripped. # comments ok. */
export function parseEnvFile(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    // Allow hyphens (e.g. edge-fw) — not pure shell export names but fine for fortigate.env keys
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) continue;
    let val = body.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEnvFile(force = false): Record<string, string> {
  const now = Date.now();
  if (!force && envFileCache && now - envFileCacheTime < TTL_MS) {
    return envFileCache;
  }
  if (!existsSync(ENV_PATH)) {
    envFileCache = {};
    envFileCacheTime = now;
    return envFileCache;
  }
  try {
    const raw = readFileSync(ENV_PATH, "utf-8");
    envFileCache = parseEnvFile(raw);
  } catch {
    envFileCache = {};
  }
  envFileCacheTime = now;
  return envFileCache;
}

function applyDefaults(dev: Partial<DeviceConfig>): DeviceConfig {
  return {
    url: dev.url || "",
    tokenEnv: dev.tokenEnv || "",
    vdom: dev.vdom ?? "root",
    verifySsl: dev.verifySsl ?? true,
  };
}

export function loadConfig(force = false): FortiConfig {
  // Keep fortigate.env in sync with config force-reload (session_start)
  loadEnvFile(force);

  const now = Date.now();
  if (!force && cached && now - cacheTime < TTL_MS) {
    return cached;
  }

  if (!existsSync(CONFIG_PATH)) {
    const empty: FortiConfig = {
      maxResponseBytes: 120000,
      sessionDefault: "off",
      devices: {},
    };
    cached = empty;
    cacheTime = now;
    return empty;
  }

  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, "utf-8");
  } catch (e: any) {
    throw new Error(`Failed to read fortigate.json: ${e.message}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`fortigate.json is not valid JSON: ${e.message}`);
  }

  const devices: Record<string, DeviceConfig> = {};
  if (parsed.devices && typeof parsed.devices === "object") {
    for (const [name, d] of Object.entries(parsed.devices)) {
      if (typeof d === "object" && d !== null) {
        const dev = d as Partial<DeviceConfig>;
        if (!dev.url || !dev.tokenEnv) {
          throw new Error(`Device "${name}" missing required url or tokenEnv`);
        }
        devices[name] = applyDefaults(dev);
      }
    }
  }

  const sessionRaw = String(parsed.sessionDefault ?? "off").trim().toLowerCase();
  const sessionDefault: FortiConfig["sessionDefault"] =
    sessionRaw === "on" ? "on" : "off";

  const cfg: FortiConfig = {
    // Floor 4k, default 24k — 120k used to flood model context
    maxResponseBytes: Math.max(4000, parsed.maxResponseBytes ?? 24000),
    sessionDefault,
    devices,
  };

  cached = cfg;
  cacheTime = now;
  return cfg;
}

/** Device keys selected for the AI this session, in config order. */
function visibleKeys(cfg: FortiConfig): string[] {
  return Object.keys(cfg.devices).filter((k) => enabled.has(k));
}

function deviceListHint(cfg: FortiConfig): string {
  const keys = visibleKeys(cfg);
  return keys.length
    ? `Selected devices: [${keys.join(", ")}]. Use list_fortigate_devices; pass device= (omit only if exactly one is selected).`
    : `No FortiGate devices selected for this session. The user must run /fortigate and pick one — ask them to.`;
}

/** Tokenize a device key into lowercase word parts (split on non-alphanumeric). */
function tokens(key: string): string[] {
  return key.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Resolve a VISIBLE device by exact key, case-insensitive key, unique
 * substring, or unique word-token match (e.g. "edge" → "edge-fw",
 * "dc core" → "dc-core-fw"). Hidden devices are never resolvable.
 * Omitting the name only works when exactly one device is visible.
 */
export function resolveDevice(name?: string): { name: string; device: DeviceConfig } {
  const cfg = loadConfig();
  const keys = visibleKeys(cfg);

  const raw = (name ?? "").trim();
  if (!raw) {
    if (keys.length === 0) throw new Error(deviceListHint(cfg));
    if (keys.length > 1) {
      throw new Error(`Multiple devices visible; pass device=. ${deviceListHint(cfg)}`);
    }
    return { name: keys[0], device: cfg.devices[keys[0]] };
  }

  // 1) Exact key (only if visible)
  if (cfg.devices[raw] && keys.includes(raw)) {
    return { name: raw, device: cfg.devices[raw] };
  }

  const lower = raw.toLowerCase();

  // 2) Case-insensitive exact
  const ci = keys.filter((k) => k.toLowerCase() === lower);
  if (ci.length === 1) return { name: ci[0], device: cfg.devices[ci[0]] };

  // 3) Unique substring either way (edge ↔ edge-fw)
  const sub = keys.filter((k) => {
    const kl = k.toLowerCase();
    return kl.includes(lower) || lower.includes(kl);
  });
  if (sub.length === 1) return { name: sub[0], device: cfg.devices[sub[0]] };

  // 4) Word-token match: every query word appears as a key token
  //    ("edge" / "dc core" all resolve). Ignore separators.
  const queryWords = tokens(raw);
  if (queryWords.length > 0) {
    const tok = keys.filter((k) => {
      const kt = new Set(tokens(k));
      return queryWords.every((w) => kt.has(w) || [...kt].some((t) => t.includes(w)));
    });
    if (tok.length === 1) return { name: tok[0], device: cfg.devices[tok[0]] };
    if (tok.length > 1) {
      throw new Error(
        `Device "${raw}" is ambiguous; matches: [${tok.join(", ")}]. Use list_fortigate_devices and pass a more specific name.`,
      );
    }
  }

  if (sub.length > 1) {
    throw new Error(
      `Device "${raw}" is ambiguous; matches: [${sub.join(", ")}]. Pass a more specific name.`,
    );
  }

  // Configured but not selected: tell the model to ask, don't silently 404
  if (cfg.devices[raw] || Object.keys(cfg.devices).some((k) => k.toLowerCase() === lower)) {
    throw new Error(
      `Device "${raw}" is not selected for this session. Ask the user to run /fortigate and select it. ${deviceListHint(cfg)}`,
    );
  }

  throw new Error(`Device "${raw}" not found. ${deviceListHint(cfg)}`);
}

/** Device names the AI may see (no URLs/tokens). Unselected devices excluded. */
export function listDevices(): Array<{ name: string; vdom: string }> {
  const cfg = loadConfig();
  return visibleKeys(cfg).map((name) => ({
    name,
    vdom: cfg.devices[name].vdom || "root",
  }));
}

/** All configured devices with selection flag — for the picker/status only. */
export function listAllDevices(): Array<{ name: string; vdom: string; enabled: boolean; url: string }> {
  const cfg = loadConfig();
  return Object.keys(cfg.devices).map((name) => ({
    name,
    vdom: cfg.devices[name].vdom || "root",
    enabled: enabled.has(name),
    url: cfg.devices[name].url,
  }));
}


export function getToken(device: DeviceConfig): string {
  const envName = device.tokenEnv;
  // 1) real process env (shell / systemd) wins
  // 2) else ~/.pi/agent/fortigate.env next to fortigate.json
  const fromProcess = process.env[envName];
  const fromFile = loadEnvFile()[envName];
  const token = (fromProcess && fromProcess.trim() !== "" ? fromProcess : fromFile) || "";
  if (!token.trim()) {
    throw new Error(
      `Token "${envName}" not set. Put it in ~/.pi/agent/fortigate.env as ${envName}=... ` +
        `or export ${envName} in the shell. Never put the token value in fortigate.json.`,
    );
  }
  return token.trim();
}

export function getMaxResponseBytes(): number {
  const cfg = loadConfig();
  return cfg.maxResponseBytes || 24000;
}
