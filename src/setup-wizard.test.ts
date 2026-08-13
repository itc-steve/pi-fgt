/**
 * Setup wizard contract tests. Run: npm run test:wizard
 * Assert-based; mocks connection via injectable fortiGet.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	addPersistentDevice,
	clearTemporaryState,
	credentialSource,
	deviceStorage,
	getToken,
	isDeviceEnabled,
	loadConfig,
	setDeviceEnabled,
	setSessionDevice,
	setSessionToken,
	useConfigDir,
} from "./config.js";
import {
	CONN_ERROR_MAX_LEN,
	formatDevicePickLabel,
	formatDeviceStatusLines,
	looksLikeTlsError,
	MASKED_TOKEN_DISPLAY,
	normalizeTextInputKey,
	persistVerifySsl,
	renderMaskedTokenPromptLines,
	resolveDevicePick,
	resolveTokenStorage,
	sanitizeConnError,
	saveEditedDevice,
	saveNewDevice,
	testConnectionWithTlsPrompt,
	testDeviceConnection,
	wizardUiBlockReason,
} from "./setup-wizard.js";

/** ASCII + simple ANSI strip — enough for plain test themes; mirrors visibleWidth contract. */
function testVisibleWidth(str: string): number {
	return str.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/** ANSI-aware-enough truncate for tests (maxWidth<=0 → ""). */
function testTruncateToWidth(text: string, maxWidth: number): string {
	if (maxWidth <= 0) return "";
	// Preserve leading ANSI, clip visible payload.
	let out = "";
	let vis = 0;
	let i = 0;
	while (i < text.length) {
		if (text[i] === "\x1b" && text[i + 1] === "[") {
			const m = text.slice(i).match(/^\x1b\[[0-9;]*m/);
			if (m) {
				out += m[0];
				i += m[0].length;
				continue;
			}
		}
		if (vis >= maxWidth) break;
		out += text[i];
		vis++;
		i++;
	}
	return out;
}

const plainTheme = {
	fg: (_c: string, t: string) => t,
	bold: (t: string) => t,
};

const ansiTheme = {
	fg: (c: string, t: string) => `\x1b[32m${t}\x1b[0m`,
	bold: (t: string) => `\x1b[1m${t}\x1b[0m`,
};

const root = mkdtempSync(join(tmpdir(), "pi-fgt-wiz-"));
useConfigDir(root);

function wipe(): void {
	clearTemporaryState();
	writeFileSync(
		join(root, "fortigate.json"),
		JSON.stringify({ sessionDefault: "off", maxResponseBytes: 24000, devices: {} }, null, 2),
	);
	writeFileSync(join(root, "fortigate.env"), "# keep\n", { mode: 0o600 });
	loadConfig(true);
}

let failures = 0;

async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
	wipe();
	try {
		await fn();
		console.log(`  ok  ${name}`);
	} catch (e: any) {
		failures++;
		console.error(`  FAIL ${name}: ${e.message}`);
	}
}

// --- Fail closed: mode must be exactly "tui" ---
await check("wizardUiBlockReason: undefined mode blocks", () => {
	assert.match(wizardUiBlockReason({ hasUI: true }) || "", /undefined|TUI/i);
	assert.match(wizardUiBlockReason({ hasUI: true, mode: undefined }) || "", /undefined|TUI/i);
});

await check("wizardUiBlockReason: rpc/print/json block", () => {
	assert.match(wizardUiBlockReason({ hasUI: true, mode: "rpc" }) || "", /TUI/i);
	assert.match(wizardUiBlockReason({ hasUI: true, mode: "print" }) || "", /TUI/i);
	assert.match(wizardUiBlockReason({ hasUI: true, mode: "json" }) || "", /TUI/i);
});

await check("wizardUiBlockReason: only tui passes", () => {
	assert.equal(wizardUiBlockReason({ hasUI: true, mode: "tui" }), null);
	assert.match(wizardUiBlockReason({ hasUI: false, mode: "tui" }) || "", /interactive|TUI/i);
});

// --- Text input key normalization ---
await check("shift+backspace is normalized before every wizard Input", () => {
	for (const sequence of ["\x1b[127;2u", "\x1b[127;2:2u"]) {
		assert.equal(normalizeTextInputKey(sequence, "shift+backspace"), "\x7f");
	}
	assert.equal(normalizeTextInputKey("x", "x"), "x");
});

// --- Fixed mask constant (no length encoding) ---
await check("MASKED_TOKEN_DISPLAY is fixed literal", () => {
	assert.equal(MASKED_TOKEN_DISPLAY, "[hidden]");
	assert.ok(!/\d/.test(MASKED_TOKEN_DISPLAY) || MASKED_TOKEN_DISPLAY === "[hidden]");
});

await check("masked prompt render: every line visibleWidth <= width (0,1,narrow,wide→narrow)", () => {
	const longTitle =
		"API token for " +
		"very-long-device-name-with-many-segments-that-would-overflow-narrow-terminals-xyz";

	const assertLines = (width: number, lines: string[]) => {
		for (const line of lines) {
			const vw = testVisibleWidth(line);
			assert.ok(
				vw <= width,
				`width=${width} line visibleWidth=${vw} > width: ${JSON.stringify(line)}`,
			);
		}
		if (width === 0) {
			for (const line of lines) {
				assert.equal(testVisibleWidth(line), 0);
				assert.equal(line, "");
			}
		}
	};

	for (const width of [0, 1, 5, 10, 20, 40, 80]) {
		const lines = renderMaskedTokenPromptLines(
			longTitle,
			plainTheme,
			width,
			testTruncateToWidth,
		);
		assertLines(width, lines);
		// Token value/length never appear
		const joined = lines.join("\n");
		assert.ok(!joined.includes("secret"));
		assert.ok(!/Bearer\s+\S{8,}/i.test(joined));
	}

	// ANSI theme still respects width
	const ansiLines = renderMaskedTokenPromptLines(longTitle, ansiTheme, 12, testTruncateToWidth);
	assertLines(12, ansiLines);

	// wide → narrow: recompute (no stale wide cache in pure helper)
	const wide = renderMaskedTokenPromptLines(longTitle, plainTheme, 80, testTruncateToWidth);
	const narrow = renderMaskedTokenPromptLines(longTitle, plainTheme, 8, testTruncateToWidth);
	assertLines(80, wide);
	assertLines(8, narrow);
	assert.ok(testVisibleWidth(wide[1]) > testVisibleWidth(narrow[1]) || wide[1] !== narrow[1]);
});

await check("masked prompt cache-by-width contract via dual renders", () => {
	// Simulate component cache: width-keyed map, not single stale buffer.
	const title = "API token for dc core fw with a long label";
	const cache = new Map<number, string[]>();
	const render = (width: number) => {
		const w = Math.max(0, Math.floor(width));
		if (cache.has(w)) return cache.get(w)!;
		const lines = renderMaskedTokenPromptLines(title, plainTheme, w, testTruncateToWidth);
		cache.set(w, lines);
		return lines;
	};
	const a = render(60);
	const b = render(4);
	const c = render(60);
	assert.strictEqual(a, c); // same cache entry
	assert.notStrictEqual(a, b);
	for (const line of b) assert.ok(testVisibleWidth(line) <= 4);
	for (const line of a) assert.ok(testVisibleWidth(line) <= 60);
});

// --- Device pick labels with spaces ---
await check("device pick labels round-trip names with spaces", () => {
	const names = ["dc core fw", "edge-fw", "a b c"];
	const labels = names.map((n) => formatDevicePickLabel(n, "persistent"));
	for (let i = 0; i < names.length; i++) {
		assert.equal(resolveDevicePick(labels[i], labels, names), names[i]);
	}
	// indexOf exact match preferred over parse
	assert.equal(resolveDevicePick(labels[0], labels, names), "dc core fw");
	// fallback parse when list miss
	assert.equal(
		resolveDevicePick(formatDevicePickLabel("solo name", "session"), [], []),
		"solo name",
	);
});

// --- Connection test ---
// --- Token redaction in connection errors ---
await check("sanitizeConnError redacts every exact token occurrence + bounds length", () => {
	const tok = "super-secret-token-ABC";
	const raw = `auth failed Bearer ${tok} then again ${tok} end`;
	const out = sanitizeConnError(raw, tok);
	assert.ok(!out.includes(tok));
	assert.ok(out.includes("[redacted]"));
	assert.equal((out.match(/\[redacted\]/g) || []).length, 2);
	const long = tok + "x".repeat(1000);
	const bounded = sanitizeConnError(long, tok);
	assert.ok(bounded.length <= CONN_ERROR_MAX_LEN);
	assert.ok(!bounded.includes(tok));
});

await check("testDeviceConnection never returns token in error", async () => {
	const tok = "leak-me-token-999";
	const bad = async () => {
		throw new Error(`Authorization: Bearer ${tok} rejected by peer`);
	};
	const r = await testDeviceConnection(
		{ url: "https://fw.example.com:443", verifySsl: true },
		tok,
		bad as any,
	);
	assert.equal(r.ok, false);
	if (!r.ok) {
		assert.ok(!r.error.includes(tok), `error leaked token: ${r.error}`);
		assert.ok(r.error.length <= CONN_ERROR_MAX_LEN);
		assert.ok(r.error.includes("[redacted]"));
	}
});

await check("TLS confirm path never surfaces token in UI message", async () => {
	const tok = "ui-leak-token-XYZ";
	let confirmMsg = "";
	const get = async () => {
		throw new Error(`TLS verification failed while using ${tok}`);
	};
	const ctx = {
		ui: {
			confirm: async (_title: string, message: string) => {
				confirmMsg = message;
				return false;
			},
		},
	} as any;
	const r = await testConnectionWithTlsPrompt(
		ctx,
		{ url: "https://fw:443", verifySsl: true },
		tok,
		get as any,
	);
	assert.equal("cancelled" in r, true);
	assert.ok(!confirmMsg.includes(tok), `confirm leaked token: ${confirmMsg}`);
	assert.ok(confirmMsg.includes("[redacted]") || /TLS/i.test(confirmMsg));
});

// --- Nested TLS / Undici shape ---
await check("looksLikeTlsError: Undici fetch failed + DEPTH_ZERO_SELF_SIGNED_CERT", () => {
	const err: any = new Error("fetch failed");
	err.cause = { code: "DEPTH_ZERO_SELF_SIGNED_CERT", message: "self-signed certificate" };
	assert.equal(looksLikeTlsError(err), true);
	assert.equal(looksLikeTlsError(new Error("fetch failed")), false);
});

await check("looksLikeTlsError: nested SELF_SIGNED / UNABLE_TO_VERIFY codes", () => {
	for (const code of [
		"SELF_SIGNED_CERT_IN_CHAIN",
		"UNABLE_TO_VERIFY_LEAF_SIGNATURE",
		"CERT_HAS_EXPIRED",
	]) {
		const err: any = new TypeError("fetch failed");
		err.cause = { code, message: "certificate problem" };
		assert.equal(looksLikeTlsError(err), true, code);
	}
});

// client.isTlsFailure: same cause-chain rules as looksLikeTlsError (pure; tested above).
// Full client.js import skipped in temp outDir — undici not resolvable without project root.

await check("testDeviceConnection: Undici-shaped TLS sets isTls and offers retry path", async () => {
	const undiciShape = async () => {
		const err: any = new TypeError("fetch failed");
		err.cause = {
			code: "DEPTH_ZERO_SELF_SIGNED_CERT",
			message: "self-signed certificate",
		};
		throw err;
	};
	const r = await testDeviceConnection(
		{ url: "https://fw.example.com:443", verifySsl: true },
		"tok",
		undiciShape as any,
	);
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.isTls, true);

	let confirmed = false;
	let calls = 0;
	const get = async (_p: string, dev: any) => {
		calls++;
		if (dev.verifySsl !== false) {
			const err: any = new TypeError("fetch failed");
			err.cause = { code: "SELF_SIGNED_CERT_IN_CHAIN", message: "self signed" };
			throw err;
		}
		return { ok: 1 };
	};
	const ok = await testConnectionWithTlsPrompt(
		{
			ui: {
				confirm: async () => {
					confirmed = true;
					return true;
				},
			},
		} as any,
		{ url: "https://fw:443", verifySsl: true },
		"t",
		get as any,
	);
	assert.equal(confirmed, true);
	assert.equal(ok.ok, true);
	if (ok.ok) assert.equal(ok.verifySsl, false);
	assert.equal(calls, 2);
});

await check("testDeviceConnection success + TLS flag", async () => {
	const okGet = async () => ({ status: "success" });
	const r = await testDeviceConnection(
		{ url: "https://fw.example.com:443", vdom: "root", verifySsl: true },
		"tok",
		okGet as any,
	);
	assert.equal(r.ok, true);
	if (r.ok) assert.equal(r.verifySsl, true);
});

await check("testDeviceConnection TLS fail detected", async () => {
	const bad = async () => {
		throw new Error("TLS verification failed. Set verifySsl:false");
	};
	const r = await testDeviceConnection(
		{ url: "https://fw.example.com:443", verifySsl: true },
		"tok",
		bad as any,
	);
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.isTls, true);
});

await check("testDeviceConnection 401 not TLS", async () => {
	const bad = async () => {
		throw new Error("401 Unauthorized — token rejected");
	};
	const r = await testDeviceConnection(
		{ url: "https://fw.example.com:443", verifySsl: true },
		"bad",
		bad as any,
	);
	assert.equal(r.ok, false);
	if (!r.ok) assert.equal(r.isTls, false);
});

await check("TLS retry only after explicit confirm; returns verifySsl=false", async () => {
	let calls = 0;
	const get = async (_p: string, dev: any) => {
		calls++;
		if (dev.verifySsl !== false) throw new Error("TLS verification failed");
		return { ok: 1 };
	};
	const declined = await testConnectionWithTlsPrompt(
		{ ui: { confirm: async () => false } } as any,
		{ url: "https://fw:443", verifySsl: true },
		"t",
		get as any,
	);
	assert.equal("cancelled" in declined, true);
	assert.equal(calls, 1);

	calls = 0;
	const ok = await testConnectionWithTlsPrompt(
		{ ui: { confirm: async () => true } } as any,
		{ url: "https://fw:443", verifySsl: true },
		"t",
		get as any,
	);
	assert.equal(ok.ok, true);
	if (ok.ok) assert.equal(ok.verifySsl, false);
	assert.equal(calls, 2);
});

// Add path always tests with verifySsl=true first
await check("add-path conn test starts verifySsl=true (no silent insecure)", async () => {
	const seen: boolean[] = [];
	const get = async (_p: string, dev: any) => {
		seen.push(dev.verifySsl !== false);
		if (dev.verifySsl !== false) throw new Error("TLS verification failed");
		return { ok: 1 };
	};
	const r = await testConnectionWithTlsPrompt(
		{ ui: { confirm: async () => true } } as any,
		{ url: "https://fw:443", verifySsl: true },
		"t",
		get as any,
	);
	assert.equal(seen[0], true); // first attempt verified
	assert.equal(r.ok, true);
	if (r.ok) assert.equal(r.verifySsl, false);
});

// --- Save / duplicate ---
await check("saveNewDevice session leaves files alone + enables", () => {
	saveNewDevice("session", "edge", {
		url: "https://fw.example.com:443",
		vdom: "root",
		verifySsl: true,
		token: "session-secret",
	});
	setDeviceEnabled("edge", true);
	assert.equal(deviceStorage("edge"), "session");
	assert.equal(isDeviceEnabled("edge"), true);
	assert.equal(credentialSource("edge"), "session");
	const disk = JSON.parse(readFileSync(join(root, "fortigate.json"), "utf8"));
	assert.deepEqual(disk.devices, {});
});

await check("saveNewDevice rejects duplicate name (session or persistent)", () => {
	saveNewDevice("session", "edge", {
		url: "https://fw.example.com:443",
		token: "a",
	});
	assert.throws(
		() =>
			saveNewDevice("session", "edge", {
				url: "https://other.example.com:443",
				token: "b",
			}),
		/already exists/i,
	);
	assert.throws(
		() =>
			saveNewDevice("persistent", "edge", {
				url: "https://other.example.com:443",
				token: "b",
			}),
		/already exists/i,
	);
	// disk still empty (session only)
	const disk = JSON.parse(readFileSync(join(root, "fortigate.json"), "utf8"));
	assert.deepEqual(disk.devices, {});
});

await check("resolveTokenStorage: session device forces session token", () => {
	assert.equal(resolveTokenStorage("session"), "session");
	assert.equal(resolveTokenStorage("session", "persistent"), "session");
	assert.equal(resolveTokenStorage("persistent", "session"), "session");
	assert.equal(resolveTokenStorage("persistent", "persistent"), "persistent");
	// default for persistent device when token choice omitted → session
	assert.equal(resolveTokenStorage("persistent"), "session");
});

await check("persistent+session: CR/LF/NUL token leaves JSON, env, session unchanged", () => {
	const envBefore = readFileSync(join(root, "fortigate.env"), "utf8");
	const jsonBefore = readFileSync(join(root, "fortigate.json"), "utf8");
	for (const bad of ["bad\n", "bad\r", "bad\x00tok", "\nfoo", "foo\r"]) {
		wipe();
		writeFileSync(join(root, "fortigate.env"), envBefore, { mode: 0o600 });
		writeFileSync(join(root, "fortigate.json"), jsonBefore);
		loadConfig(true);
		assert.throws(
			() =>
				saveNewDevice(
					"persistent",
					"edge",
					{ url: "https://fw.example.com:443", token: bad },
					"session",
				),
			/CR|LF|NUL|Token/i,
		);
		assert.equal(readFileSync(join(root, "fortigate.env"), "utf8"), envBefore);
		assert.equal(readFileSync(join(root, "fortigate.json"), "utf8"), jsonBefore);
		assert.equal(deviceStorage("edge"), undefined);
		assert.equal(credentialSource("edge"), "none");
		assert.deepEqual(loadConfig(true).devices, {});
	}
});

await check("persistent+session: add failure clears staged session token", () => {
	// Good token stages in session; bad URL fails addPersistentDevice → token must not linger.
	assert.throws(
		() =>
			saveNewDevice(
				"persistent",
				"edge",
				{ url: "ftp://not-allowed.example", token: "good-session-token" },
				"session",
			),
		/http/i,
	);
	assert.equal(deviceStorage("edge"), undefined);
	assert.equal(credentialSource("edge"), "none");
	assert.deepEqual(loadConfig(true).devices, {});
	assert.equal(readFileSync(join(root, "fortigate.env"), "utf8"), "# keep\n");
});

await check("persistent+session: JSON written, env unchanged, token from session", () => {
	const envBefore = readFileSync(join(root, "fortigate.env"), "utf8");
	saveNewDevice(
		"persistent",
		"edge",
		{
			url: "https://fw.example.com:443",
			vdom: "root",
			verifySsl: true,
			token: "session-only-secret-xyz",
		},
		"session",
	);
	setDeviceEnabled("edge", true);
	assert.equal(deviceStorage("edge"), "persistent");
	assert.equal(credentialSource("edge"), "session");
	const cfg = loadConfig(true);
	assert.ok(cfg.devices.edge);
	assert.equal(cfg.devices.edge.url, "https://fw.example.com:443");
	assert.match(cfg.devices.edge.tokenEnv, /^FORTIGATE_/);
	// fortigate.env untouched (no token line written)
	const envAfter = readFileSync(join(root, "fortigate.env"), "utf8");
	assert.equal(envAfter, envBefore);
	assert.ok(!envAfter.includes("session-only-secret"));
	// token resolves from session memory
	assert.equal(getToken(cfg.devices.edge), "session-only-secret-xyz");
	// status labels
	const status = formatDeviceStatusLines().join("\n");
	assert.ok(status.includes("storage=persistent"));
	assert.ok(status.includes("credential=session"));
	assert.ok(!status.includes("session-only-secret"));
});

await check("persistent+persistent: JSON + env written", () => {
	const envBefore = readFileSync(join(root, "fortigate.env"), "utf8");
	saveNewDevice(
		"persistent",
		"edge",
		{
			url: "https://fw.example.com:443",
			vdom: "root",
			verifySsl: true,
			token: "persist-secret",
		},
		"persistent",
	);
	setDeviceEnabled("edge", true);
	assert.equal(deviceStorage("edge"), "persistent");
	assert.equal(credentialSource("edge"), "env-file");
	const cfg = loadConfig(true);
	assert.equal(cfg.devices.edge.verifySsl, true);
	assert.match(cfg.devices.edge.tokenEnv, /^FORTIGATE_/);
	const envAfter = readFileSync(join(root, "fortigate.env"), "utf8");
	assert.notEqual(envAfter, envBefore);
	assert.ok(envAfter.includes("persist-secret"));
	assert.ok(!readFileSync(join(root, "fortigate.json"), "utf8").includes("persist-secret"));
	const status = formatDeviceStatusLines().join("\n");
	assert.ok(status.includes("storage=persistent"));
	assert.ok(status.includes("credential=env-file"));
});

await check("saveNewDevice persistent default token storage is session (env untouched)", () => {
	const envBefore = readFileSync(join(root, "fortigate.env"), "utf8");
	// omit tokenStorage → resolveTokenStorage defaults to session for persistent device
	saveNewDevice("persistent", "edge", {
		url: "https://fw.example.com:443",
		token: "default-session-tok",
	});
	assert.equal(credentialSource("edge"), "session");
	assert.equal(readFileSync(join(root, "fortigate.env"), "utf8"), envBefore);
});

await check("saveEditedDevice keeps session token", () => {
	setSessionDevice("edge", {
		url: "https://fw.example.com:443",
		vdom: "root",
		token: "keep-me",
	});
	saveEditedDevice("session", "edge", {
		url: "https://other.example.com:443",
		vdom: "vdom1",
		verifySsl: false,
	});
	const cfg = loadConfig();
	assert.equal(cfg.devices.edge.url, "https://other.example.com:443");
	assert.equal(cfg.devices.edge.verifySsl, false);
	assert.equal(credentialSource("edge"), "session");
});

// Token-update TLS fallback must persist verifySsl=false
await check("persistVerifySsl writes false into persistent storage", () => {
	addPersistentDevice("edge", {
		url: "https://fw.example.com:443",
		verifySsl: true,
		token: "tok",
	});
	assert.equal(loadConfig(true).devices.edge.verifySsl, true);
	persistVerifySsl("persistent", "edge", false);
	assert.equal(loadConfig(true).devices.edge.verifySsl, false);
	// token still present
	assert.equal(credentialSource("edge"), "env-file");
});

await check("persistVerifySsl writes false into session storage", () => {
	setSessionDevice("edge", {
		url: "https://fw.example.com:443",
		verifySsl: true,
		token: "tok",
	});
	persistVerifySsl("session", "edge", false);
	assert.equal(loadConfig().devices.edge.verifySsl, false);
	assert.equal(credentialSource("edge"), "session");
});

await check("status lines are labels only", () => {
	addPersistentDevice("edge", {
		url: "https://fw.example.com:443",
		token: "super-secret-token-xyz",
	});
	setSessionToken("edge", "session-override");
	setDeviceEnabled("edge", true);
	const joined = formatDeviceStatusLines().join("\n");
	assert.ok(joined.includes("edge"));
	assert.ok(joined.includes("storage="));
	assert.ok(joined.includes("credential=session"));
	assert.ok(!joined.includes("super-secret"));
	assert.ok(!joined.includes("session-override"));
	assert.ok(!joined.includes("https://"));
});

await check("defaults applied on save (vdom root, verifySsl true)", () => {
	saveNewDevice("persistent", "core", {
		url: "https://core.example.com:443",
		token: "t",
	});
	const d = loadConfig(true).devices.core;
	assert.equal(d.vdom, "root");
	assert.equal(d.verifySsl, true);
});

try {
	rmSync(root, { recursive: true, force: true });
} catch {
	/* ignore */
}

if (failures) {
	console.error(`\nsetup-wizard: ${failures} failed`);
	process.exit(1);
}
console.log("\nsetup-wizard ok");
