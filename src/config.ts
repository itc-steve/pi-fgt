/** Config loader + session/persistent device management for pi-fgt.
 *  JSON: ~/.pi/agent/fortigate.json  (device map, tokenEnv names — no secrets)
 *  ENV:  ~/.pi/agent/fortigate.env   (KEY=value secrets next to JSON)
 *  Token resolution: session token → process.env[tokenEnv] → fortigate.env.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type {
  CredentialSource,
  DeviceConfig,
  DeviceInput,
  DeviceStorage,
  FortiConfig,
} from "./types.js";

const DEFAULT_AGENT_DIR = join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".pi",
  "agent",
);

let agentDir = DEFAULT_AGENT_DIR;

function configFile(): string {
  return join(agentDir, "fortigate.json");
}
function envFile(): string {
  return join(agentDir, "fortigate.env");
}

export function configPath(): string {
  return configFile();
}

export function envPath(): string {
  return envFile();
}

/** Test/helper: redirect JSON+env paths. Pass null to restore default. */
export function useConfigDir(dir: string | null): void {
  agentDir = dir || DEFAULT_AGENT_DIR;
  cached = null;
  cacheTime = 0;
  envFileCache = null;
  envFileCacheTime = 0;
}

let cached: FortiConfig | null = null;
let cacheTime = 0;
let envFileCache: Record<string, string> | null = null;
let envFileCacheTime = 0;
const TTL_MS = 10_000;

// ---------------------------------------------------------------------------
// Session-local state — IN-MEMORY, NEVER PERSISTED.
// ---------------------------------------------------------------------------

const enabled = new Set<string>();
const sessionDevices = new Map<string, DeviceConfig>();
const sessionTokens = new Map<string, string>();

/** Drop visibility + session devices/tokens (session_start, /fortigate off). */
export function resetSessionVisibility(): void {
  enabled.clear();
  sessionDevices.clear();
  sessionTokens.clear();
}

/** Alias — clear all temporary session config state. */
export function clearTemporaryState(): void {
  resetSessionVisibility();
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

// ---------------------------------------------------------------------------
// Env file parse / atomic write
// ---------------------------------------------------------------------------

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
  const path = envFile();
  if (!existsSync(path)) {
    envFileCache = {};
    envFileCacheTime = now;
    return envFileCache;
  }
  try {
    envFileCache = parseEnvFile(readFileSync(path, "utf-8"));
  } catch {
    envFileCache = {};
  }
  envFileCacheTime = now;
  return envFileCache;
}

function assertSafeToken(token: string): void {
  if (/[\r\n\x00]/.test(token)) {
    throw new Error("Token must not contain CR, LF, or NUL (injection rejected)");
  }
}

/** Atomic write: temp in same dir → rename. Optional mode (env uses 0600). */
function atomicWrite(path: string, content: string, mode?: number): void {
  mkdirSync(dirname(path), { recursive: true });
  // If path is a directory (test fault / corruption), refuse — caller rollback handles restore.
  if (existsSync(path) && statSync(path).isDirectory()) {
    throw new Error(`EISDIR: ${path} is a directory`);
  }
  const tmp = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`,
  );
  try {
    writeFileSync(tmp, content, { encoding: "utf-8", mode: mode ?? 0o644 });
    if (mode != null) chmodSync(tmp, mode);
    renameSync(tmp, path);
    if (mode != null) {
      try {
        chmodSync(path, mode);
      } catch {
        /* best-effort after rename */
      }
    }
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/** In-memory snapshot of config files (no on-disk secret backups). */
type FileSnap = { json: string | null; env: string | null };

function snapshotConfigFiles(): FileSnap {
  const jp = configFile();
  const ep = envFile();
  return {
    json: existsSync(jp) && statSync(jp).isFile() ? readFileSync(jp, "utf-8") : null,
    env: existsSync(ep) && statSync(ep).isFile() ? readFileSync(ep, "utf-8") : null,
  };
}

function restoreConfigFiles(snap: FileSnap): void {
  const jp = configFile();
  const ep = envFile();
  try {
    if (snap.json === null) {
      if (existsSync(jp) && statSync(jp).isFile()) unlinkSync(jp);
    } else {
      if (existsSync(jp) && statSync(jp).isDirectory()) rmSync(jp, { recursive: true, force: true });
      atomicWrite(jp, snap.json);
    }
    if (snap.env === null) {
      if (existsSync(ep) && statSync(ep).isFile()) unlinkSync(ep);
      else if (existsSync(ep) && statSync(ep).isDirectory()) rmSync(ep, { recursive: true, force: true });
    } else {
      if (existsSync(ep) && statSync(ep).isDirectory()) rmSync(ep, { recursive: true, force: true });
      atomicWrite(ep, snap.env, 0o600);
    }
  } finally {
    cached = null;
    cacheTime = 0;
    envFileCache = null;
    envFileCacheTime = 0;
  }
}

/** Run JSON+env mutation with in-memory rollback if the second step fails. */
function withConfigFileRollback(mutate: () => void): void {
  const snap = snapshotConfigFiles();
  try {
    mutate();
  } catch (e) {
    try {
      restoreConfigFiles(snap);
    } catch {
      /* still rethrow original */
    }
    throw e;
  }
}

function readEnvRaw(): string {
  const path = envFile();
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

/** Upsert KEY=value preserving comments/unrelated lines. Forces 0600. */
function upsertEnvKey(key: string, value: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(key)) {
    throw new Error(`Invalid env key: ${key}`);
  }
  assertSafeToken(value);
  const raw = readEnvRaw();
  const lines = raw.length ? raw.split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const exported = trimmed.startsWith("export ");
    const body = exported ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq <= 0) return line;
    if (body.slice(0, eq).trim() !== key) return line;
    found = true;
    return `${exported ? "export " : ""}${key}=${value}`;
  });
  if (!found) {
    if (next.length === 1 && next[0] === "") next[0] = `${key}=${value}`;
    else next.push(`${key}=${value}`);
  }
  let out = next.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  atomicWrite(envFile(), out, 0o600);
  envFileCache = null;
  envFileCacheTime = 0;
}

function deleteEnvKey(key: string): void {
  const raw = readEnvRaw();
  if (!raw) return;
  const lines = raw.split(/\r?\n/);
  const next = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const body = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const eq = body.indexOf("=");
    if (eq <= 0) return true;
    return body.slice(0, eq).trim() !== key;
  });
  let out = next.join("\n");
  if (!out.endsWith("\n")) out += "\n";
  atomicWrite(envFile(), out, 0o600);
  envFileCache = null;
  envFileCacheTime = 0;
}

// ---------------------------------------------------------------------------
// URL / defaults / tokenEnv names
// ---------------------------------------------------------------------------

/** Default HTTPS + port 443 when omitted. Explicit http:// rejected (bearer must be HTTPS). */
export function normalizeDeviceUrl(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) throw new Error("url required");
  // Reject non-https schemes with explicit scheme:// (not host:port like fw.example.com:8443)
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https:\/\//i.test(s)) {
    throw new Error("url must be https (bearer token transport rejects http://)");
  }
  if (!/^https:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`invalid url: ${raw}`);
  }
  if (u.protocol !== "https:") {
    throw new Error("url must be https (bearer token transport rejects http://)");
  }
  if (!u.hostname) throw new Error("url missing hostname");
  const port = u.port || "443";
  return `https://${u.hostname}:${port}`;
}

function applyDefaults(dev: Partial<DeviceConfig>): DeviceConfig {
  return {
    url: dev.url || "",
    tokenEnv: dev.tokenEnv || "",
    vdom: dev.vdom ?? "root",
    verifySsl: dev.verifySsl ?? true,
  };
}

function safeDevicePart(name: string): string {
  const s = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "DEVICE";
}

/** Strict generated key shape: FORTIGATE_<SAFE>_TOKEN or FORTIGATE_<SAFE>_<N>_TOKEN. */
export const GENERATED_TOKEN_ENV_RE = /^FORTIGATE_[A-Z0-9_]+_TOKEN$/;

/** FORTIGATE_<SAFE>_TOKEN; collision → FORTIGATE_<SAFE>_2_TOKEN (still matches strict regex). */
export function generateTokenEnvName(
  deviceName: string,
  taken: Iterable<string> = [],
): string {
  const used = new Set(taken);
  const part = safeDevicePart(deviceName);
  const base = `FORTIGATE_${part}_TOKEN`;
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`FORTIGATE_${part}_${i}_TOKEN`)) i++;
  return `FORTIGATE_${part}_${i}_TOKEN`;
}

/**
 * Union of configured device tokenEnv names, fortigate.env keys, and process.env
 * keys that match generated/strict token shape or FORTIGATE_* prefix.
 */
export function collectTakenTokenEnvs(
  devices: Record<string, DeviceConfig>,
  except?: string,
): string[] {
  const used = new Set(takenTokenEnvs(devices, except));
  for (const k of Object.keys(loadEnvFile(true))) used.add(k);
  for (const k of Object.keys(process.env)) {
    if (GENERATED_TOKEN_ENV_RE.test(k) || k.startsWith("FORTIGATE_")) used.add(k);
  }
  return [...used];
}

// ---------------------------------------------------------------------------
// Disk config load / write
// ---------------------------------------------------------------------------

function emptyConfig(): FortiConfig {
  return {
    maxResponseBytes: 24000,
    sessionDefault: "off",
    devices: {},
  };
}

function loadDiskConfig(force = false): FortiConfig {
  loadEnvFile(force);

  const now = Date.now();
  if (!force && cached && now - cacheTime < TTL_MS) {
    return cached;
  }

  const path = configFile();
  if (!existsSync(path)) {
    const empty = emptyConfig();
    cached = empty;
    cacheTime = now;
    return empty;
  }

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (e: any) {
    throw new Error(`Failed to read ${path}: ${e.message}`);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (e: any) {
    throw new Error(`${path} is not valid JSON: ${e.message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid fortigate.json at ${path}: expected a JSON object`);
  }

  const devices: Record<string, DeviceConfig> = {};
  if (parsed.devices && typeof parsed.devices === "object" && !Array.isArray(parsed.devices)) {
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

function cloneConfig(cfg: FortiConfig): FortiConfig {
  const devices: Record<string, DeviceConfig> = {};
  for (const [k, v] of Object.entries(cfg.devices)) {
    devices[k] = { ...v };
  }
  return {
    maxResponseBytes: cfg.maxResponseBytes,
    sessionDefault: cfg.sessionDefault,
    devices,
  };
}

function writeDiskConfig(cfg: FortiConfig): void {
  const payload = {
    sessionDefault: cfg.sessionDefault ?? "off",
    maxResponseBytes: cfg.maxResponseBytes ?? 24000,
    devices: cfg.devices,
  };
  atomicWrite(configFile(), `${JSON.stringify(payload, null, 2)}\n`);
  // publish only after rename succeeds
  cached = cloneConfig({
    sessionDefault: payload.sessionDefault,
    maxResponseBytes: payload.maxResponseBytes,
    devices: payload.devices,
  });
  cacheTime = Date.now();
}

/** Merge disk + session devices (session shadows same name). */
export function loadConfig(force = false): FortiConfig {
  const base = loadDiskConfig(force);
  if (sessionDevices.size === 0) return base;
  const devices = { ...base.devices };
  for (const [name, dev] of sessionDevices) {
    devices[name] = dev;
  }
  return {
    ...base,
    devices,
  };
}

// ---------------------------------------------------------------------------
// Session device / token API
// ---------------------------------------------------------------------------

export function setSessionDevice(name: string, input: DeviceInput): DeviceConfig {
  const n = name.trim();
  if (!n) throw new Error("device name required");
  // Validate token before any map mutation (fail-closed, untrimmed).
  if (input.token !== undefined) assertSafeToken(input.token);
  const dev = applyDefaults({
    url: normalizeDeviceUrl(input.url),
    tokenEnv: "",
    vdom: input.vdom,
    verifySsl: input.verifySsl,
  });
  sessionDevices.set(n, dev);
  if (input.token !== undefined) {
    const t = input.token.trim();
    if (t) sessionTokens.set(n, t);
    else sessionTokens.delete(n);
  }
  return dev;
}

export function removeSessionDevice(name: string): void {
  sessionDevices.delete(name);
  sessionTokens.delete(name);
  enabled.delete(name);
}

export function setSessionToken(name: string, token: string): void {
  assertSafeToken(token); // untrimmed — reject boundary CR/LF/NUL
  const t = token.trim();
  if (!t) {
    sessionTokens.delete(name);
    return;
  }
  sessionTokens.set(name, t);
}

export function clearSessionToken(name: string): void {
  sessionTokens.delete(name);
}

// ---------------------------------------------------------------------------
// Persistent device / token API
// ---------------------------------------------------------------------------

function takenTokenEnvs(devices: Record<string, DeviceConfig>, except?: string): string[] {
  return Object.entries(devices)
    .filter(([n]) => n !== except)
    .map(([, d]) => d.tokenEnv)
    .filter(Boolean);
}

function assertDeviceName(name: string): string {
  const n = name.trim();
  if (!n) throw new Error("device name required");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(n)) {
    throw new Error(`invalid device name: ${name}`);
  }
  return n;
}

/** Add a new persistent device. Always auto-generates tokenEnv. Token → fortigate.env only. */
export function addPersistentDevice(name: string, input: DeviceInput): DeviceConfig {
  const n = assertDeviceName(name);
  if (input.token !== undefined) assertSafeToken(input.token);
  const url = normalizeDeviceUrl(input.url);
  // Clone so a failed write cannot poison the in-memory cache.
  const disk = cloneConfig(loadDiskConfig(true));
  if (disk.devices[n]) {
    throw new Error(`Device "${n}" already exists; use editPersistentDevice`);
  }
  // Always auto-generate — collide with JSON + env-file + process.env names.
  const tokenEnv = generateTokenEnvName(n, collectTakenTokenEnvs(disk.devices));
  const dev = applyDefaults({
    url,
    tokenEnv,
    vdom: input.vdom,
    verifySsl: input.verifySsl,
  });
  const token =
    input.token !== undefined && input.token.trim() ? input.token.trim() : undefined;

  if (token) {
    withConfigFileRollback(() => {
      disk.devices[n] = dev;
      writeDiskConfig(disk);
      upsertEnvKey(tokenEnv, token);
    });
  } else {
    disk.devices[n] = dev;
    writeDiskConfig(disk);
  }
  return { ...dev };
}

/**
 * Edit fields of an existing persistent device.
 * Preserves tokenEnv by default (including legacy weak keys already in config).
 * A changed tokenEnv is accepted only when it matches GENERATED_TOKEN_ENV_RE.
 */
export function editPersistentDevice(
  name: string,
  input: Partial<DeviceInput>,
): DeviceConfig {
  const n = assertDeviceName(name);
  if (input.token !== undefined) assertSafeToken(input.token);
  const disk = cloneConfig(loadDiskConfig(true));
  const prev = disk.devices[n];
  if (!prev) throw new Error(`Device "${n}" not found in fortigate.json`);

  let tokenEnv = prev.tokenEnv;
  if (input.tokenEnv !== undefined && input.tokenEnv.trim()) {
    const next = input.tokenEnv.trim();
    if (next !== prev.tokenEnv) {
      if (!GENERATED_TOKEN_ENV_RE.test(next)) {
        throw new Error(
          `tokenEnv must match ^FORTIGATE_[A-Z0-9_]+_TOKEN$ (got "${next}"); legacy keys are preserved only when already configured`,
        );
      }
      tokenEnv = next;
    }
  }

  const dev = applyDefaults({
    url: input.url !== undefined ? normalizeDeviceUrl(input.url) : prev.url,
    tokenEnv,
    vdom: input.vdom !== undefined ? input.vdom : prev.vdom,
    verifySsl: input.verifySsl !== undefined ? input.verifySsl : prev.verifySsl,
  });
  const token =
    input.token !== undefined && input.token.trim() ? input.token.trim() : undefined;

  if (token) {
    withConfigFileRollback(() => {
      disk.devices[n] = dev;
      writeDiskConfig(disk);
      upsertEnvKey(dev.tokenEnv, token);
    });
  } else {
    disk.devices[n] = dev;
    writeDiskConfig(disk);
  }
  return { ...dev };
}

export function setPersistentToken(name: string, token: string): void {
  assertSafeToken(token); // untrimmed first
  const n = assertDeviceName(name);
  const disk = loadDiskConfig(true);
  const dev = disk.devices[n];
  if (!dev) throw new Error(`Device "${n}" not found in fortigate.json`);
  if (!dev.tokenEnv) throw new Error(`Device "${n}" has no tokenEnv`);
  upsertEnvKey(dev.tokenEnv, token.trim());
  // Persistent replacement wins — drop same-name session override.
  clearSessionToken(n);
}

/**
 * Remove persistent device. If removeEnvKey and no other device references
 * tokenEnv, delete that key from fortigate.env (preserves comments otherwise).
 * Also drops any session shadow of the same name.
 */
export function removePersistentDevice(
  name: string,
  opts?: { removeEnvKey?: boolean },
): void {
  const n = assertDeviceName(name);
  const disk = cloneConfig(loadDiskConfig(true));
  const prev = disk.devices[n];
  if (!prev) throw new Error(`Device "${n}" not found in fortigate.json`);

  const stillUsed =
    !!prev.tokenEnv &&
    Object.entries(disk.devices).some(([k, d]) => k !== n && d.tokenEnv === prev.tokenEnv);
  const deleteEnv = !!(opts?.removeEnvKey && prev.tokenEnv && !stillUsed);

  const sessDev = sessionDevices.get(n);
  const sessTok = sessionTokens.get(n);
  const wasEnabled = enabled.has(n);

  const applyMemoryClear = () => {
    enabled.delete(n);
    sessionDevices.delete(n);
    sessionTokens.delete(n);
  };
  const restoreMemory = () => {
    if (sessDev) sessionDevices.set(n, sessDev);
    if (sessTok !== undefined) sessionTokens.set(n, sessTok);
    if (wasEnabled) enabled.add(n);
  };

  if (deleteEnv) {
    const snap = snapshotConfigFiles();
    try {
      delete disk.devices[n];
      writeDiskConfig(disk);
      applyMemoryClear();
      deleteEnvKey(prev.tokenEnv);
    } catch (e) {
      try {
        restoreConfigFiles(snap);
      } catch {
        /* still rethrow */
      }
      restoreMemory();
      throw e;
    }
  } else {
    delete disk.devices[n];
    writeDiskConfig(disk);
    applyMemoryClear();
  }
}

// ---------------------------------------------------------------------------
// Credential source / storage reporting (values never returned)
// ---------------------------------------------------------------------------

export function deviceStorage(name: string): DeviceStorage | undefined {
  if (sessionDevices.has(name)) return "session";
  const disk = loadDiskConfig();
  if (disk.devices[name]) return "persistent";
  return undefined;
}

/** Resolve name only by object identity — never by URL/tokenEnv shape (session tokens must not cross devices). */
function findDeviceName(device: DeviceConfig): string | undefined {
  for (const [n, d] of sessionDevices) {
    if (d === device) return n;
  }
  const cfg = loadConfig();
  for (const [n, d] of Object.entries(cfg.devices)) {
    if (d === device) return n;
  }
  return undefined;
}

export function credentialSource(name: string): CredentialSource {
  const st = sessionTokens.get(name);
  if (st && st.trim()) return "session";

  const cfg = loadConfig();
  const dev = cfg.devices[name];
  if (!dev) return "none";
  const envName = dev.tokenEnv;
  if (envName) {
    const fromProcess = process.env[envName];
    if (fromProcess && fromProcess.trim() !== "") return "process";
    const fromFile = loadEnvFile()[envName];
    if (fromFile && fromFile.trim() !== "") return "env-file";
  }
  return "none";
}

// ---------------------------------------------------------------------------
// Resolve / list / token (existing callers)
// ---------------------------------------------------------------------------

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
export function listAllDevices(): Array<{
  name: string;
  vdom: string;
  enabled: boolean;
  url: string;
}> {
  const cfg = loadConfig();
  return Object.keys(cfg.devices).map((name) => ({
    name,
    vdom: cfg.devices[name].vdom || "root",
    enabled: enabled.has(name),
    url: cfg.devices[name].url,
  }));
}

export function getToken(device: DeviceConfig): string {
  const name = findDeviceName(device);
  if (name) {
    const st = sessionTokens.get(name);
    if (st && st.trim()) return st.trim();
  }

  const envName = device.tokenEnv;
  if (!envName) {
    throw new Error(
      `No token configured for this device. Set a session token or add tokenEnv + fortigate.env entry.`,
    );
  }
  // 1) real process env (shell / systemd)
  // 2) else ~/.pi/agent/fortigate.env next to fortigate.json
  const fromProcess = process.env[envName];
  const fromFile = loadEnvFile()[envName];
  const token =
    (fromProcess && fromProcess.trim() !== "" ? fromProcess : fromFile) || "";
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
