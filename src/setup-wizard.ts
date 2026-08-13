/**
 * Human-only FortiGate setup wizards (/fortigate add|token|edit|remove).
 * Tokens never enter command args, model messages, or TUI text (masked custom UI).
 * Fail closed unless ctx.mode === "tui" — no plaintext token fallback.
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	addPersistentDevice,
	clearSessionToken,
	credentialSource,
	deviceStorage,
	editPersistentDevice,
	getToken,
	listAllDevices,
	loadConfig,
	normalizeDeviceUrl,
	removePersistentDevice,
	removeSessionDevice,
	setDeviceEnabled,
	setPersistentToken,
	setSessionDevice,
	setSessionToken,
} from "./config.js";
import type { DeviceConfig, DeviceInput, DeviceStorage } from "./types.js";

/** Minimal device shape for connection test (mirrors client.DeviceLike). */
export interface DeviceLike {
	url: string;
	vdom?: string;
	verifySsl?: boolean;
}

/** Fixed mask — never value, never length. */
export const MASKED_TOKEN_DISPLAY = "[hidden]";

/** Bound for connection-test errors shown in TUI (never unbounded, never token). */
export const CONN_ERROR_MAX_LEN = 300;

/** Separator for device pick labels (name may contain spaces). */
const PICK_SEP = "  ·  ";

/** Known cert codes — same set client uses (kept local so tests skip undici). */
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
 * Redact every exact occurrence of `token` from a message; bound length.
 * Callers must only surface this sanitized string in notify/confirm.
 */
export function sanitizeConnError(
	message: string,
	token: string,
	maxLen: number = CONN_ERROR_MAX_LEN,
): string {
	let s = String(message ?? "");
	if (token) {
		// Split-join avoids regex metachar issues and replaces every exact occurrence.
		if (token.length > 0 && s.includes(token)) {
			s = s.split(token).join("[redacted]");
		}
	}
	if (s.length > maxLen) s = s.slice(0, maxLen);
	return s;
}

/**
 * True if error/cause chain looks like TLS/certificate failure.
 * Handles Undici `{ message: "fetch failed", cause: { code: "DEPTH_ZERO_SELF_SIGNED_CERT" } }`.
 */
export function looksLikeTlsError(err: unknown): boolean {
	let cur: any = err;
	const seen = new Set<any>();
	while (cur && typeof cur === "object" && !seen.has(cur)) {
		seen.add(cur);
		const code = cur.code != null ? String(cur.code) : "";
		if (code && TLS_CERT_CODES.has(code)) return true;
		if (code && /CERT|TLS|SSL|UNABLE_TO_VERIFY|DEPTH_ZERO/i.test(code)) return true;
		const msg = String(cur.message ?? cur.reason ?? "");
		if (
			/TLS|SSL|certificate|self[-\s]?signed|UNABLE_TO_VERIFY|DEPTH_ZERO|CERT_|hostname\/IP does not match|verification failed/i.test(
				msg,
			)
		) {
			return true;
		}
		cur = cur.cause;
	}
	if (typeof err === "string" && /TLS|certificate|SSL|self[-\s]?signed/i.test(err)) return true;
	return false;
}

export type FortiGetFn = (
	path: string,
	device: DeviceLike,
	token: string,
	params?: Record<string, any>,
	signal?: AbortSignal,
) => Promise<any>;

/** Lazy so unit tests never pull undici/client. */
async function defaultFortiGet(
	path: string,
	device: DeviceLike,
	token: string,
	params?: Record<string, any>,
	signal?: AbortSignal,
): Promise<any> {
	const { fortiGet } = await import("./client.js");
	return fortiGet(path, device, token, params, signal);
}

export type ConnOk = { ok: true; verifySsl: boolean };
export type ConnFail = { ok: false; error: string; isTls: boolean };
export type ConnResult = ConnOk | ConnFail;

export type WizardOk = { ok: true; name: string };
export type WizardFail = { ok: false };
export type WizardResult = WizardOk | WizardFail;

/** Fail closed: only real TUI mode. undefined mode blocks. */
export function wizardUiBlockReason(ctx: {
	hasUI?: boolean;
	mode?: string;
}): string | null {
	if (ctx.mode !== "tui") {
		const got = ctx.mode === undefined ? "undefined" : ctx.mode;
		return `FortiGate setup requires TUI mode (got ${got}). No non-interactive fallback.`;
	}
	if (ctx.hasUI === false) {
		return "FortiGate setup needs interactive TUI. No non-interactive fallback.";
	}
	return null;
}

export async function testDeviceConnection(
	draft: DeviceLike,
	token: string,
	get: FortiGetFn = defaultFortiGet,
): Promise<ConnResult> {
	const verifySsl = draft.verifySsl !== false;
	try {
		await get("monitor/system/status", { ...draft, verifySsl }, token);
		return { ok: true, verifySsl };
	} catch (e: any) {
		const raw = String(e?.message ?? e ?? "connection failed");
		// Never return/display the supplied token — redact every exact occurrence, bound length.
		const error = sanitizeConnError(raw, token);
		const isTls = looksLikeTlsError(e) || /TLS|certificate|SSL|verify/i.test(error);
		return { ok: false, error, isTls };
	}
}

/**
 * Connection test with explicit TLS-insecure retry confirm.
 * Never silently disables verification. Starts from draft.verifySsl (add always true).
 */
export async function testConnectionWithTlsPrompt(
	ctx: ExtensionContext,
	draft: DeviceLike,
	token: string,
	get: FortiGetFn = defaultFortiGet,
): Promise<ConnResult | { ok: false; cancelled: true }> {
	let result = await testDeviceConnection(draft, token, get);
	if (result.ok) return result;

	if (result.isTls && draft.verifySsl !== false) {
		const retry = await ctx.ui.confirm(
			"TLS verification failed",
			`${result.error}\n\nRetry with verifySsl=false (INSECURE)?`,
		);
		if (!retry) return { ok: false, cancelled: true };
		result = await testDeviceConnection({ ...draft, verifySsl: false }, token, get);
		if (result.ok) return { ok: true, verifySsl: false };
	}
	return result;
}

export function formatDeviceStatusLines(): string[] {
	const devices = listAllDevices();
	if (devices.length === 0) return ["(no devices configured)"];
	return devices.map((d) => {
		const storage = deviceStorage(d.name) ?? "unknown";
		const cred = credentialSource(d.name);
		const sel = d.enabled ? "selected" : "hidden";
		return `${d.name}: storage=${storage} credential=${cred} ${sel}`;
	});
}

/** Label for select lists — name may contain spaces. */
export function formatDevicePickLabel(name: string, storage: string): string {
	return `${name}${PICK_SEP}${storage}`;
}

/** Resolve pick label → device name (spaces-safe). Prefer exact list index when provided. */
export function resolveDevicePick(
	picked: string,
	labels: string[],
	names: string[],
): string | undefined {
	const idx = labels.indexOf(picked);
	if (idx >= 0 && idx < names.length) return names[idx];
	const i = picked.lastIndexOf(PICK_SEP);
	if (i > 0) return picked.slice(0, i);
	return undefined;
}

/**
 * Resolve where the token lives for a new device.
 * Device session → token always session.
 * Device persistent → tokenStorage arg (wizard defaults session first).
 */
export function resolveTokenStorage(
	deviceStorageKind: DeviceStorage,
	tokenStorage?: DeviceStorage,
): DeviceStorage {
	if (deviceStorageKind === "session") return "session";
	return tokenStorage === "persistent" ? "persistent" : "session";
}

/**
 * Add device. Device storage and credential storage are independent when device is persistent:
 * - session device → session token only (no files)
 * - persistent device + session token → JSON only; token in memory (env untouched)
 * - persistent device + persistent token → JSON + fortigate.env
 */
export function saveNewDevice(
	deviceStorageKind: DeviceStorage,
	name: string,
	input: DeviceInput,
	tokenStorage?: DeviceStorage,
): DeviceConfig {
	const n = name.trim();
	if (!n) throw new Error("device name required");
	const cfg = loadConfig();
	if (cfg.devices[n]) {
		throw new Error(`Device "${n}" already exists`);
	}
	const cred = resolveTokenStorage(deviceStorageKind, tokenStorage);

	if (deviceStorageKind === "session") {
		return setSessionDevice(n, input);
	}

	// Persistent device record — never put session-only token into env.
	// Validate/set session token BEFORE JSON write so CR/LF/NUL rejection
	// cannot leave a committed device. If add then fails, clear staged token.
	if (cred === "session") {
		if (input.token !== undefined) {
			// setSessionToken uses same assertSafeToken (untrimmed) as config API.
			setSessionToken(n, input.token);
		}
		try {
			return addPersistentDevice(n, {
				url: input.url,
				vdom: input.vdom,
				verifySsl: input.verifySsl,
				// omit token → fortigate.env unchanged
			});
		} catch (e) {
			clearSessionToken(n);
			throw e;
		}
	}

	return addPersistentDevice(n, input);
}

export function saveEditedDevice(
	storage: DeviceStorage,
	name: string,
	input: Partial<DeviceInput>,
): DeviceConfig {
	if (storage === "session") {
		const cfg = loadConfig();
		const prev = cfg.devices[name];
		if (!prev) throw new Error(`Session device "${name}" not found`);
		return setSessionDevice(name, {
			url: input.url ?? prev.url,
			vdom: input.vdom !== undefined ? input.vdom : prev.vdom,
			verifySsl: input.verifySsl !== undefined ? input.verifySsl : prev.verifySsl,
		});
	}
	return editPersistentDevice(name, input);
}

/** Persist verifySsl into the device's current storage (no token write). */
export function persistVerifySsl(
	storage: DeviceStorage,
	name: string,
	verifySsl: boolean,
): void {
	saveEditedDevice(storage, name, { verifySsl });
}

/** Theme bits used by masked prompt render (matches pi TUI theme helpers). */
export type MaskedPromptTheme = {
	fg: (color: string, text: string) => string;
	bold: (text: string) => string;
};

export type TruncateToWidthFn = (
	text: string,
	maxWidth: number,
	ellipsis?: string,
	pad?: boolean,
) => string;

/**
 * Build masked-token prompt lines for a given terminal width.
 * Every line is ANSI-aware truncated to `Math.max(0, width)` so visible width never exceeds width.
 * width=0 → all lines empty (visible width 0).
 */
export function renderMaskedTokenPromptLines(
	title: string,
	theme: MaskedPromptTheme,
	width: number,
	truncateToWidth: TruncateToWidthFn,
): string[] {
	const w = Math.max(0, Math.floor(Number(width) || 0));
	// Never call Input.render — mask only. Border uses w dashes (0 when width=0).
	const barRaw = theme.fg("accent", w > 0 ? "─".repeat(w) : "");
	const raw = [
		barRaw,
		theme.fg("accent", theme.bold(` ${title}`)),
		theme.fg("muted", " Token is never shown (value and length hidden)."),
		"",
		theme.fg("text", ` Input: ${MASKED_TOKEN_DISPLAY}`),
		"",
		theme.fg("dim", " Type/paste token • Enter submit • Esc cancel"),
		barRaw,
	];
	// Truncate every line — including themed ANSI — to exact nonnegative width.
	return raw.map((line) => truncateToWidth(line, w));
}

/** Work around pi-tui Input treating Kitty Shift+Backspace as printable DEL. */
export function normalizeTextInputKey(data: string, keyId?: string): string {
	return keyId === "shift+backspace" ? "\x7f" : data;
}

async function promptTextInput(
	ctx: ExtensionContext,
	title: string,
	placeholder?: string,
): Promise<string | undefined> {
	const codingAgent: any = await import("@earendil-works/pi-coding-agent");
	const tui: any = await import("@earendil-works/pi-tui");
	return ctx.ui.custom<string | undefined>((_tui, _theme, _kb, done) => {
		const component = new codingAgent.ExtensionInputComponent(
			title,
			placeholder,
			done,
			() => done(undefined),
		);
		const handleInput = component.handleInput.bind(component);
		component.handleInput = (data: string) =>
			handleInput(normalizeTextInputKey(data, tui.parseKey(data)));
		return component;
	});
}

/**
 * Masked token via pi-tui Input (Kitty printable + bracketed paste).
 * Render is always fixed MASKED_TOKEN_DISPLAY — never value or length.
 * Every render line is width-clipped via pi-tui truncateToWidth.
 * Input/utils lazy-imported so unit tests need no pi-tui install.
 */
export async function promptMaskedToken(
	ctx: ExtensionContext,
	title: string,
): Promise<string | undefined> {
	const tuiModule: any = await import("@earendil-works/pi-tui");
	const { Input, parseKey, truncateToWidth } = tuiModule;
	return ctx.ui.custom<string | undefined>((tui, theme, _kb, done) => {
		const input = new Input();
		// Cache keyed by width — never reuse wider lines after a narrower render.
		let cache: { width: number; lines: string[] } | undefined;
		let finished = false;

		const finish = (value: string | undefined) => {
			if (finished) return;
			finished = true;
			input.setValue("");
			done(value);
		};

		input.onSubmit = (value: string) => {
			const v = value.trim();
			finish(v || undefined);
		};
		input.onEscape = () => finish(undefined);

		return {
			render: (width: number) => {
				const w = Math.max(0, Math.floor(Number(width) || 0));
				if (cache && cache.width === w) return cache.lines;
				const lines = renderMaskedTokenPromptLines(title, theme, w, truncateToWidth);
				cache = { width: w, lines };
				return lines;
			},
			invalidate: () => {
				cache = undefined;
				input.invalidate();
			},
			handleInput: (data: string) => {
				if (finished) return;
				input.handleInput(normalizeTextInputKey(data, parseKey(data)));
				// Display is fixed — no visual change; still allow Input to process Kitty/paste.
				tui.requestRender();
			},
		};
	});
}

async function pickDeviceStorage(ctx: ExtensionContext): Promise<DeviceStorage | undefined> {
	const choice = await ctx.ui.select("Store device settings where?", [
		"session (memory only, cleared on /fortigate off / new session)",
		"persistent (~/.pi/agent/fortigate.json)",
	]);
	if (!choice) return undefined;
	return choice.startsWith("session") ? "session" : "persistent";
}

/** Only when device is persistent. Session first/default. */
async function pickTokenStorage(ctx: ExtensionContext): Promise<DeviceStorage | undefined> {
	const choice = await ctx.ui.select("Store API token where?", [
		"session (temporary — default, not written to fortigate.env)",
		"persistent (fortigate.env)",
	]);
	if (!choice) return undefined;
	return choice.startsWith("session") ? "session" : "persistent";
}

async function pickDevice(ctx: ExtensionContext, label: string): Promise<string | undefined> {
	const devices = listAllDevices();
	if (devices.length === 0) {
		ctx.ui.notify("No devices configured. Use /fortigate add first.", "warn");
		return undefined;
	}
	const names = devices.map((d) => d.name);
	const labels = devices.map((d) =>
		formatDevicePickLabel(d.name, deviceStorage(d.name) ?? "?"),
	);
	const picked = await ctx.ui.select(label, labels);
	if (!picked) return undefined;
	return resolveDevicePick(picked, labels, names);
}

function ensureWizardUi(ctx: ExtensionContext): boolean {
	const reason = wizardUiBlockReason(ctx);
	if (reason) {
		ctx.ui.notify(reason, "error");
		return false;
	}
	return true;
}

export async function runAddWizard(ctx: ExtensionContext): Promise<WizardResult> {
	if (!ensureWizardUi(ctx)) return { ok: false };

	const deviceStorageKind = await pickDeviceStorage(ctx);
	if (!deviceStorageKind) {
		ctx.ui.notify("Add cancelled", "info");
		return { ok: false };
	}

	// Token storage: session device forces session; persistent device prompts (session first).
	let tokenStorage: DeviceStorage = "session";
	if (deviceStorageKind === "persistent") {
		const picked = await pickTokenStorage(ctx);
		if (!picked) {
			ctx.ui.notify("Add cancelled", "info");
			return { ok: false };
		}
		tokenStorage = picked;
	}

	const nameRaw = await promptTextInput(ctx, "Device name", "edge-fw");
	if (!nameRaw?.trim()) {
		ctx.ui.notify("Add cancelled — name required", "warn");
		return { ok: false };
	}
	const name = nameRaw.trim();

	// Reject early if already known (session or persistent).
	if (loadConfig().devices[name]) {
		ctx.ui.notify(`Device "${name}" already exists`, "error");
		return { ok: false };
	}

	const urlRaw = await promptTextInput(ctx, "FortiGate host or URL", "fw.example.com");
	if (!urlRaw?.trim()) {
		ctx.ui.notify("Add cancelled — URL required", "warn");
		return { ok: false };
	}

	let url: string;
	try {
		url = normalizeDeviceUrl(urlRaw.trim());
	} catch (e: any) {
		ctx.ui.notify(String(e?.message || e), "error");
		return { ok: false };
	}

	const vdomRaw = await promptTextInput(ctx, "VDOM", "root");
	const vdom = (vdomRaw ?? "root").trim() || "root";

	// Always start with verifySsl=true. Insecure only after TLS-failure confirm.
	let verifySsl = true;

	const token = await promptMaskedToken(ctx, `API token for ${name}`);
	if (!token) {
		ctx.ui.notify("Add cancelled — token required", "warn");
		return { ok: false };
	}

	// Connection test before any save.
	const draft: DeviceLike = { url, vdom, verifySsl: true };
	const conn = await testConnectionWithTlsPrompt(ctx, draft, token);
	if ("cancelled" in conn) {
		ctx.ui.notify("Add cancelled — TLS retry declined", "warn");
		return { ok: false };
	}
	if (!conn.ok) {
		ctx.ui.notify(`Connection test failed — not saved. ${conn.error}`, "error");
		return { ok: false };
	}
	verifySsl = conn.verifySsl;

	try {
		saveNewDevice(
			deviceStorageKind,
			name,
			{ url, vdom, verifySsl, token },
			tokenStorage,
		);
		setDeviceEnabled(name, true);
		ctx.ui.notify(
			`Added ${name} (device=${deviceStorageKind}, token=${tokenStorage}, verifySsl=${verifySsl}). Selected this session.`,
			"success",
		);
		return { ok: true, name };
	} catch (e: any) {
		ctx.ui.notify(`Save failed: ${e?.message || e}`, "error");
		return { ok: false };
	}
}

export async function runTokenWizard(ctx: ExtensionContext): Promise<WizardResult> {
	if (!ensureWizardUi(ctx)) return { ok: false };

	const name = await pickDevice(ctx, "Device for token action");
	if (!name) return { ok: false };

	const action = await ctx.ui.select(`Token for ${name}`, [
		"set session token (memory only)",
		"set persistent token (fortigate.env)",
		"clear temporary session token",
	]);
	if (!action) {
		ctx.ui.notify("Token action cancelled", "info");
		return { ok: false };
	}

	if (action.startsWith("clear")) {
		clearSessionToken(name);
		ctx.ui.notify(`Cleared session token for ${name} (falls back to env if set)`, "info");
		return { ok: true, name };
	}

	const persistent = action.includes("persistent");
	const storage: DeviceStorage = persistent ? "persistent" : "session";
	if (persistent && deviceStorage(name) !== "persistent") {
		ctx.ui.notify(
			`"${name}" is not persistent — use session token, or /fortigate add as persistent first.`,
			"warn",
		);
		return { ok: false };
	}

	const token = await promptMaskedToken(ctx, `New token for ${name}`);
	if (!token) {
		ctx.ui.notify("Token update cancelled", "info");
		return { ok: false };
	}

	const cfg = loadConfig();
	const dev = cfg.devices[name];
	if (!dev) {
		ctx.ui.notify(`Device "${name}" not found`, "error");
		return { ok: false };
	}

	// Test against current device settings; TLS fallback may force verifySsl=false.
	const conn = await testConnectionWithTlsPrompt(
		ctx,
		{ url: dev.url, vdom: dev.vdom, verifySsl: dev.verifySsl !== false },
		token,
	);
	if ("cancelled" in conn) {
		ctx.ui.notify("Token update cancelled — TLS retry declined", "warn");
		return { ok: false };
	}
	if (!conn.ok) {
		ctx.ui.notify(`Connection test failed — token not saved. ${conn.error}`, "error");
		return { ok: false };
	}

	try {
		if (persistent) setPersistentToken(name, token);
		else setSessionToken(name, token);

		// Explicit TLS-insecure retry → persist verifySsl=false on the device record
		// so later calls don't re-fail with verification still on.
		if (conn.verifySsl === false && dev.verifySsl !== false) {
			const st = deviceStorage(name) ?? storage;
			persistVerifySsl(st, name, false);
		}

		ctx.ui.notify(
			`Token updated for ${name} (${persistent ? "persistent env" : "session"}${conn.verifySsl === false ? ", verifySsl=false" : ""}).`,
			"success",
		);
		return { ok: true, name };
	} catch (e: any) {
		ctx.ui.notify(`Token save failed: ${e?.message || e}`, "error");
		return { ok: false };
	}
}

export async function runEditWizard(ctx: ExtensionContext): Promise<WizardResult> {
	if (!ensureWizardUi(ctx)) return { ok: false };

	const name = await pickDevice(ctx, "Device to edit");
	if (!name) return { ok: false };

	const storage = deviceStorage(name);
	if (!storage) {
		ctx.ui.notify(`Device "${name}" not found`, "error");
		return { ok: false };
	}

	const cfg = loadConfig();
	const prev = cfg.devices[name];
	if (!prev) {
		ctx.ui.notify(`Device "${name}" not found`, "error");
		return { ok: false };
	}

	ctx.ui.notify(
		`Editing ${name} [${storage}] url=${prev.url} vdom=${prev.vdom ?? "root"} verifySsl=${prev.verifySsl !== false}`,
		"info",
	);

	const urlRaw = await promptTextInput(ctx, "URL (empty = keep)", prev.url);
	const vdomRaw = await promptTextInput(ctx, "VDOM (empty = keep)", prev.vdom ?? "root");
	const sslChoice = await ctx.ui.select("TLS verification", [
		`keep (${prev.verifySsl !== false ? "verify" : "insecure"})`,
		"verify (verifySsl=true)",
		"insecure (verifySsl=false)",
	]);
	if (!sslChoice) {
		ctx.ui.notify("Edit cancelled", "info");
		return { ok: false };
	}

	let url = prev.url;
	if (urlRaw?.trim()) {
		try {
			url = normalizeDeviceUrl(urlRaw.trim());
		} catch (e: any) {
			ctx.ui.notify(String(e?.message || e), "error");
			return { ok: false };
		}
	}

	const vdom = (vdomRaw?.trim() || prev.vdom || "root");

	let verifySsl = prev.verifySsl !== false;
	if (sslChoice.startsWith("verify")) verifySsl = true;
	else if (sslChoice.startsWith("insecure")) verifySsl = false;
	// "keep" → unchanged

	// Explicit confirm when newly choosing insecure (was verifying before).
	if (verifySsl === false && prev.verifySsl !== false && sslChoice.startsWith("insecure")) {
		const ok = await ctx.ui.confirm(
			"Disable TLS verification?",
			"This stores verifySsl=false (INSECURE). Continue?",
		);
		if (!ok) {
			ctx.ui.notify("Edit cancelled", "info");
			return { ok: false };
		}
	}

	// Obtain existing token locally for connection test (never shown).
	let token: string;
	try {
		token = getToken(prev);
	} catch (e: any) {
		ctx.ui.notify(
			`Cannot connection-test edit — no token available: ${e?.message || e}. Use /fortigate token first.`,
			"error",
		);
		return { ok: false };
	}

	const draft: DeviceLike = { url, vdom, verifySsl };
	const conn = await testConnectionWithTlsPrompt(ctx, draft, token);
	if ("cancelled" in conn) {
		ctx.ui.notify("Edit cancelled — TLS retry declined", "warn");
		return { ok: false };
	}
	if (!conn.ok) {
		ctx.ui.notify(`Connection test failed — not saved. ${conn.error}`, "error");
		return { ok: false };
	}

	try {
		saveEditedDevice(storage, name, {
			url,
			vdom,
			verifySsl: conn.verifySsl,
		});
		ctx.ui.notify(
			`Updated ${name} (${storage}, verifySsl=${conn.verifySsl}). Token unchanged.`,
			"success",
		);
		return { ok: true, name };
	} catch (e: any) {
		ctx.ui.notify(`Edit failed: ${e?.message || e}`, "error");
		return { ok: false };
	}
}

export async function runRemoveWizard(ctx: ExtensionContext): Promise<WizardResult> {
	if (!ensureWizardUi(ctx)) return { ok: false };

	const name = await pickDevice(ctx, "Device to remove");
	if (!name) return { ok: false };

	const storage = deviceStorage(name);
	if (!storage) {
		ctx.ui.notify(`Device "${name}" not found`, "error");
		return { ok: false };
	}

	const ok = await ctx.ui.confirm(
		"Remove device",
		`Remove "${name}" from ${storage} storage? This cannot be undone.`,
	);
	if (!ok) {
		ctx.ui.notify("Remove cancelled", "info");
		return { ok: false };
	}

	try {
		if (storage === "session") {
			removeSessionDevice(name);
			ctx.ui.notify(`Removed session device ${name}`, "success");
			return { ok: true, name };
		}

		let removeEnvKey = false;
		const cfg = loadConfig();
		const tokenEnv = cfg.devices[name]?.tokenEnv;
		if (tokenEnv) {
			const others = Object.entries(cfg.devices).filter(
				([n, d]) => n !== name && d.tokenEnv === tokenEnv,
			);
			if (others.length === 0) {
				removeEnvKey = await ctx.ui.confirm(
					"Delete env key?",
					`No other device uses ${tokenEnv}. Delete it from fortigate.env?`,
				);
			} else {
				ctx.ui.notify(
					`${tokenEnv} still referenced by other devices — env line kept.`,
					"info",
				);
			}
		}

		removePersistentDevice(name, { removeEnvKey });
		ctx.ui.notify(
			`Removed persistent device ${name}${removeEnvKey ? " (env key deleted)" : ""}`,
			"success",
		);
		return { ok: true, name };
	} catch (e: any) {
		ctx.ui.notify(`Remove failed: ${e?.message || e}`, "error");
		return { ok: false };
	}
}
