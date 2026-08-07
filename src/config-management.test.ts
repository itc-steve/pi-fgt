/**
 * Config management contract (session + persistent). Run: npm run test:config
 * ponytail: assert-based, no framework. Uses temp agent dir — never real ~/.pi/agent.
 */

import assert from "node:assert/strict";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  addPersistentDevice,
  clearSessionToken,
  clearTemporaryState,
  configPath,
  credentialSource,
  deviceStorage,
  editPersistentDevice,
  generateTokenEnvName,
  getToken,
  listAllDevices,
  listDevices,
  loadConfig,
  normalizeDeviceUrl,
  parseEnvFile,
  removePersistentDevice,
  resetSessionVisibility,
  resolveDevice,
  setDeviceEnabled,
  setPersistentToken,
  setSessionDevice,
  setSessionToken,
  useConfigDir,
  isDeviceEnabled,
} from "./config.js";

const STRICT_TOKEN_ENV = /^FORTIGATE_[A-Z0-9_]+_TOKEN$/;

const root = mkdtempSync(join(tmpdir(), "pi-fgt-cfg-"));
useConfigDir(root);

function wipe(): void {
  clearTemporaryState();
  try {
    chmodSync(root, 0o700);
  } catch {
    /* ignore */
  }
  writeFileSync(
    join(root, "fortigate.json"),
    JSON.stringify(
      {
        sessionDefault: "off",
        maxResponseBytes: 24000,
        devices: {},
      },
      null,
      2,
    ),
  );
  writeFileSync(join(root, "fortigate.env"), "# keep me\nOTHER=stay\n", { mode: 0o600 });
  loadConfig(true);
}

function snapshotFiles(): { json: string; env: string } {
  return {
    json: readFileSync(join(root, "fortigate.json"), "utf-8"),
    env: readFileSync(join(root, "fortigate.env"), "utf-8"),
  };
}

let failures = 0;
function check(name: string, fn: () => void): void {
  wipe();
  try {
    fn();
    console.log(`  ok  ${name}`);
  } catch (e: any) {
    failures++;
    console.error(`  FAIL ${name}: ${e.message}`);
  }
}

// --- URL / defaults ---
check("normalizeDeviceUrl defaults https + 443", () => {
  assert.equal(normalizeDeviceUrl("fw.example.com"), "https://fw.example.com:443");
  assert.equal(normalizeDeviceUrl("https://fw.example.com"), "https://fw.example.com:443");
  assert.equal(normalizeDeviceUrl("http://fw.example.com:8080"), "http://fw.example.com:8080");
});

check("normalizeDeviceUrl rejects empty / bad scheme", () => {
  assert.throws(() => normalizeDeviceUrl(""), /url/i);
  assert.throws(() => normalizeDeviceUrl("ftp://x"), /http/i);
});

check("normalizeDeviceUrl host:port, IPv4, IPv6", () => {
  assert.equal(normalizeDeviceUrl("fw.example.com:8443"), "https://fw.example.com:8443");
  assert.equal(normalizeDeviceUrl("edge-fw:8443"), "https://edge-fw:8443");
  assert.equal(normalizeDeviceUrl("192.168.1.1:8443"), "https://192.168.1.1:8443");
  assert.equal(normalizeDeviceUrl("[::1]:8443"), "https://[::1]:8443");
  assert.equal(normalizeDeviceUrl("https://[2001:db8::1]"), "https://[2001:db8::1]:443");
});

check("generateTokenEnvName safe + collision (strict suffix)", () => {
  assert.equal(generateTokenEnvName("edge-fw"), "FORTIGATE_EDGE_FW_TOKEN");
  assert.match(generateTokenEnvName("edge-fw"), STRICT_TOKEN_ENV);
  const coll = generateTokenEnvName("edge-fw", ["FORTIGATE_EDGE_FW_TOKEN"]);
  assert.equal(coll, "FORTIGATE_EDGE_FW_2_TOKEN");
  assert.match(coll, STRICT_TOKEN_ENV);
  const coll2 = generateTokenEnvName("edge-fw", [
    "FORTIGATE_EDGE_FW_TOKEN",
    "FORTIGATE_EDGE_FW_2_TOKEN",
  ]);
  assert.equal(coll2, "FORTIGATE_EDGE_FW_3_TOKEN");
});

// --- session devices / tokens ---
check("session device lives only in memory", () => {
  setSessionDevice("tmp", { url: "https://tmp.example:443", token: "sess-secret" });
  assert.equal(deviceStorage("tmp"), "session");
  const cfg = loadConfig();
  assert.ok(cfg.devices.tmp);
  assert.equal(cfg.devices.tmp.vdom, "root");
  assert.equal(cfg.devices.tmp.verifySsl, true);
  const disk = JSON.parse(readFileSync(join(root, "fortigate.json"), "utf-8"));
  assert.equal(disk.devices.tmp, undefined);
  assert.equal(getToken(cfg.devices.tmp), "sess-secret");
  assert.equal(credentialSource("tmp"), "session");
});

check("session token overrides process env and env-file", () => {
  addPersistentDevice("edge", {
    url: "https://edge.example:443",
    token: "file-token",
  });
  const envName = loadConfig(true).devices.edge.tokenEnv;
  process.env[envName] = "process-token";
  try {
    assert.equal(credentialSource("edge"), "process");
    assert.equal(getToken(loadConfig().devices.edge), "process-token");
    setSessionToken("edge", "session-wins");
    assert.equal(credentialSource("edge"), "session");
    assert.equal(getToken(loadConfig().devices.edge), "session-wins");
    clearSessionToken("edge");
    assert.equal(getToken(loadConfig().devices.edge), "process-token");
  } finally {
    delete process.env[envName];
  }
});

check("resetSessionVisibility / clearTemporaryState drop session token+device", () => {
  setSessionDevice("tmp", { url: "tmp.example", token: "x" });
  setDeviceEnabled("tmp", true);
  assert.equal(isDeviceEnabled("tmp"), true);
  resetSessionVisibility();
  assert.equal(isDeviceEnabled("tmp"), false);
  assert.equal(loadConfig().devices.tmp, undefined);
  assert.equal(credentialSource("tmp"), "none");

  setSessionDevice("tmp", { url: "tmp.example", token: "y" });
  clearTemporaryState();
  assert.equal(loadConfig().devices.tmp, undefined);
});

// #8 visibility / resolve isolation
check("listDevices/resolveDevice disabled → enabled → reset", () => {
  setSessionDevice("tmp", { url: "https://tmp.example:443", token: "t" });
  assert.deepEqual(listDevices(), []);
  assert.throws(() => resolveDevice("tmp"), /not selected|not found/i);

  setDeviceEnabled("tmp", true);
  assert.deepEqual(
    listDevices().map((d) => d.name),
    ["tmp"],
  );
  assert.equal(resolveDevice("tmp").name, "tmp");
  assert.equal(resolveDevice().name, "tmp");

  resetSessionVisibility();
  assert.deepEqual(listDevices(), []);
  assert.throws(() => resolveDevice("tmp"), /not found|not selected/i);
});

// #1 fail-closed token validation — no partial state
check("bad tokens rejected before mutation (session + persistent)", () => {
  const bad = ["\nfoo", "foo\r", "\0foo", "bad\n", "bad\rtok", "x\0y"];
  for (const tok of bad) {
    const before = snapshotFiles();
    assert.throws(() => setSessionDevice("s", { url: "https://s.example:443", token: tok }), /CR|LF|NUL|inject/i);
    assert.equal(loadConfig().devices.s, undefined, `session device after bad token ${JSON.stringify(tok)}`);
    assert.equal(credentialSource("s"), "none");
    assert.deepEqual(snapshotFiles(), before);

    assert.throws(() => setSessionToken("ghost", tok), /CR|LF|NUL|inject/i);
    assert.equal(credentialSource("ghost"), "none");
  }

  addPersistentDevice("edge", { url: "https://e.example:443", token: "good" });
  const mid = snapshotFiles();
  for (const tok of bad) {
    assert.throws(() => addPersistentDevice("other", { url: "https://o.example:443", token: tok }), /CR|LF|NUL|inject/i);
    assert.equal(loadConfig(true).devices.other, undefined);
    assert.throws(() => editPersistentDevice("edge", { token: tok }), /CR|LF|NUL|inject/i);
    assert.throws(() => setPersistentToken("edge", tok), /CR|LF|NUL|inject/i);
    assert.equal(getToken(loadConfig(true).devices.edge), "good");
    assert.deepEqual(snapshotFiles(), mid, `files unchanged after bad ${JSON.stringify(tok)}`);
  }
});

// --- persistent add/edit/remove/token ---
check("addPersistentDevice writes json + env, mode 0600, preserves comments", () => {
  const dev = addPersistentDevice("edge", {
    url: "edge.example.com",
    vdom: "root",
    token: "tok-one",
  });
  assert.equal(dev.url, "https://edge.example.com:443");
  assert.equal(dev.tokenEnv, "FORTIGATE_EDGE_TOKEN");
  assert.match(dev.tokenEnv, STRICT_TOKEN_ENV);
  assert.equal(deviceStorage("edge"), "persistent");

  const json = JSON.parse(readFileSync(join(root, "fortigate.json"), "utf-8"));
  assert.equal(json.devices.edge.url, "https://edge.example.com:443");
  assert.equal(json.devices.edge.tokenEnv, "FORTIGATE_EDGE_TOKEN");
  assert.ok(!JSON.stringify(json).includes("tok-one"), "token never in json");

  const envRaw = readFileSync(join(root, "fortigate.env"), "utf-8");
  assert.match(envRaw, /# keep me/);
  assert.match(envRaw, /OTHER=stay/);
  assert.match(envRaw, /FORTIGATE_EDGE_TOKEN=tok-one/);
  assert.equal(statSync(join(root, "fortigate.env")).mode & 0o777, 0o600);
  assert.equal(credentialSource("edge"), "env-file");
  assert.equal(getToken(loadConfig(true).devices.edge), "tok-one");
});

// #2 strict key on add; ignore caller custom; legacy preserved on edit
check("add always auto-generates strict tokenEnv; edit preserves legacy", () => {
  const a = addPersistentDevice("edge-fw", {
    url: "https://a.example:443",
    tokenEnv: "lowercase-bad",
    token: "t1",
  });
  assert.equal(a.tokenEnv, "FORTIGATE_EDGE_FW_TOKEN");
  assert.match(a.tokenEnv, STRICT_TOKEN_ENV);

  // collision gets _N_ before _TOKEN
  const b = addPersistentDevice("edge_fw", { url: "https://b.example:443", token: "t2" });
  // edge_fw and edge-fw both SAFE to EDGE_FW — second collides
  assert.equal(b.tokenEnv, "FORTIGATE_EDGE_FW_2_TOKEN");
  assert.match(b.tokenEnv, STRICT_TOKEN_ENV);

  // legacy custom key via manual JSON only
  writeFileSync(
    join(root, "fortigate.json"),
    JSON.stringify({
      sessionDefault: "off",
      maxResponseBytes: 24000,
      devices: {
        dc: {
          url: "https://dc.example:443",
          tokenEnv: "CUSTOM_DC_KEY",
          vdom: "root",
          verifySsl: true,
        },
      },
    }, null, 2),
  );
  writeFileSync(join(root, "fortigate.env"), "CUSTOM_DC_KEY=dc-tok\n", { mode: 0o600 });
  loadConfig(true);
  editPersistentDevice("dc", { url: "https://dc2.example:8443", vdom: "vsys1", verifySsl: false });
  const d = loadConfig(true).devices.dc;
  assert.equal(d.tokenEnv, "CUSTOM_DC_KEY", "legacy key preserved");
  assert.equal(d.url, "https://dc2.example:8443");
  assert.equal(getToken(d), "dc-tok");

  // changing to non-strict key rejected; files unchanged for that field
  assert.throws(
    () => editPersistentDevice("dc", { tokenEnv: "not-strict" }),
    /FORTIGATE_|tokenEnv|strict/i,
  );
  assert.equal(loadConfig(true).devices.dc.tokenEnv, "CUSTOM_DC_KEY");

  // changing to strict generated form allowed
  editPersistentDevice("dc", { tokenEnv: "FORTIGATE_DC_TOKEN" });
  assert.equal(loadConfig(true).devices.dc.tokenEnv, "FORTIGATE_DC_TOKEN");
});

check("setPersistentToken replaces env value, rejects CR/LF/NUL", () => {
  addPersistentDevice("edge", { url: "https://e.example:443", token: "old" });
  setPersistentToken("edge", "new-tok");
  assert.equal(getToken(loadConfig(true).devices.edge), "new-tok");
  assert.throws(() => setPersistentToken("edge", "bad\ntok"), /CR|LF|NUL|newline|inject/i);
  assert.throws(() => setPersistentToken("edge", "bad\0tok"), /CR|LF|NUL|null|inject/i);
  assert.throws(() => setPersistentToken("edge", "bad\rtok"), /CR|LF|NUL|inject/i);
});

// #4 duplicate add rejected
check("addPersistentDevice rejects duplicate name (no json/env change)", () => {
  addPersistentDevice("edge", { url: "https://e.example:443", token: "first" });
  const before = snapshotFiles();
  const beforeKey = loadConfig(true).devices.edge.tokenEnv;
  assert.throws(
    () => addPersistentDevice("edge", { url: "https://other.example:443", token: "second" }),
    /exists|already|edit/i,
  );
  assert.deepEqual(snapshotFiles(), before);
  assert.equal(loadConfig(true).devices.edge.tokenEnv, beforeKey);
  assert.equal(getToken(loadConfig().devices.edge), "first");
});

// #5 remove clears session shadow
check("removePersistentDevice drops session shadow too", () => {
  addPersistentDevice("edge", { url: "https://e.example:443", token: "p" });
  setSessionDevice("edge", { url: "https://session.example:443", token: "s" });
  setDeviceEnabled("edge", true);
  assert.ok(listAllDevices().some((d) => d.name === "edge"));
  assert.equal(resolveDevice("edge").device.url, "https://session.example:443");

  removePersistentDevice("edge");
  assert.equal(
    listAllDevices().find((d) => d.name === "edge"),
    undefined,
  );
  assert.deepEqual(listDevices(), []);
  assert.throws(() => resolveDevice("edge"), /not found|not selected/i);
  assert.equal(deviceStorage("edge"), undefined);
});

check("removePersistentDevice keeps shared env key; optional unused delete", () => {
  // seed legacy shared key (add no longer accepts arbitrary tokenEnv)
  writeFileSync(
    join(root, "fortigate.json"),
    JSON.stringify({
      sessionDefault: "off",
      maxResponseBytes: 24000,
      devices: {
        a: { url: "https://a.example:443", tokenEnv: "SHARED_TOK", vdom: "root", verifySsl: true },
        b: { url: "https://b.example:443", tokenEnv: "SHARED_TOK", vdom: "root", verifySsl: true },
      },
    }, null, 2),
  );
  writeFileSync(join(root, "fortigate.env"), "# keep me\nSHARED_TOK=shared\n", { mode: 0o600 });
  loadConfig(true);

  removePersistentDevice("a", { removeEnvKey: true });
  assert.equal(loadConfig(true).devices.a, undefined);
  assert.ok(loadConfig().devices.b);
  const env1 = parseEnvFile(readFileSync(join(root, "fortigate.env"), "utf-8"));
  assert.equal(env1.SHARED_TOK, "shared", "shared key kept while b references it");

  removePersistentDevice("b", { removeEnvKey: true });
  const env2 = parseEnvFile(readFileSync(join(root, "fortigate.env"), "utf-8"));
  assert.equal(env2.SHARED_TOK, undefined, "unused key removed when requested");
  assert.match(readFileSync(join(root, "fortigate.env"), "utf-8"), /# keep me/);
});

check("remove without removeEnvKey leaves key", () => {
  addPersistentDevice("solo", { url: "https://s.example:443", token: "s" });
  const key = loadConfig(true).devices.solo.tokenEnv;
  removePersistentDevice("solo");
  const env = parseEnvFile(readFileSync(join(root, "fortigate.env"), "utf-8"));
  assert.equal(env[key], "s");
});

check("cache refresh after disk write", () => {
  addPersistentDevice("edge", { url: "https://e.example:443", token: "t" });
  assert.ok(loadConfig().devices.edge);
  writeFileSync(
    join(root, "fortigate.json"),
    JSON.stringify({
      sessionDefault: "off",
      devices: { other: { url: "https://o.example:443", tokenEnv: "X" } },
    }),
  );
  assert.ok(loadConfig().devices.edge, "stale cache without force");
  assert.equal(loadConfig(true).devices.edge, undefined);
  assert.ok(loadConfig().devices.other);
});

// #3 failed write does not leak into cache
check("failed atomic JSON write leaves cache and disk unchanged", () => {
  addPersistentDevice("edge", { url: "https://e.example:443", token: "t" });
  const before = snapshotFiles();
  const beforeNames = Object.keys(loadConfig(true).devices).sort();

  chmodSync(root, 0o500); // no write
  try {
    assert.throws(
      () => addPersistentDevice("newdev", { url: "https://n.example:443", token: "x" }),
      /EACCES|EPERM|permission|read-only|EROFS|ENOENT/i,
    );
    // no force — phantom mutation would still be in TTL cache
    assert.equal(loadConfig().devices.newdev, undefined);
    assert.deepEqual(Object.keys(loadConfig().devices).sort(), beforeNames);
  } finally {
    chmodSync(root, 0o700);
  }

  assert.equal(loadConfig(true).devices.newdev, undefined);
  assert.deepEqual(snapshotFiles(), before);
});

check("listAllDevices still works for picker (session+persistent)", () => {
  addPersistentDevice("edge", { url: "https://e.example:443", token: "t" });
  setSessionDevice("tmp", { url: "https://t.example:443" });
  setDeviceEnabled("edge", true);
  const all = listAllDevices();
  const names = all.map((d) => d.name).sort();
  assert.deepEqual(names, ["edge", "tmp"]);
  const edge = all.find((d) => d.name === "edge")!;
  assert.equal(edge.enabled, true);
  assert.equal(typeof edge.url, "string");
  assert.equal(typeof edge.vdom, "string");
});

check("manual fortigate.json still loads (compat)", () => {
  writeFileSync(
    join(root, "fortigate.json"),
    JSON.stringify(
      {
        sessionDefault: "off",
        maxResponseBytes: 12000,
        devices: {
          edge: {
            url: "https://fw01.example.com:443",
            tokenEnv: "FORTIGATE_EDGE_TOKEN",
            vdom: "root",
            verifySsl: false,
          },
        },
      },
      null,
      2,
    ),
  );
  writeFileSync(join(root, "fortigate.env"), "FORTIGATE_EDGE_TOKEN=manual\n", { mode: 0o600 });
  const cfg = loadConfig(true);
  assert.equal(cfg.maxResponseBytes, 12000);
  assert.equal(cfg.devices.edge.verifySsl, false);
  assert.equal(getToken(cfg.devices.edge), "manual");
  assert.equal(credentialSource("edge"), "env-file");
});

// #7 corrupt config diagnostics
check("corrupt / non-object JSON errors include config path; no writes", () => {
  const beforeEnv = readFileSync(join(root, "fortigate.env"), "utf-8");
  writeFileSync(join(root, "fortigate.json"), "{not-json", { mode: 0o600 });
  assert.throws(() => loadConfig(true), new RegExp(configPath().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.throws(() => loadConfig(true), /valid JSON|not valid JSON|parse/i);

  writeFileSync(join(root, "fortigate.json"), "null", { mode: 0o600 });
  assert.throws(() => loadConfig(true), new RegExp(configPath().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.throws(() => loadConfig(true), /object|invalid/i);

  writeFileSync(join(root, "fortigate.json"), "[]", { mode: 0o600 });
  assert.throws(() => loadConfig(true), /object|invalid/i);

  assert.equal(readFileSync(join(root, "fortigate.env"), "utf-8"), beforeEnv);
});

// cleanup
useConfigDir(null);
rmSync(root, { recursive: true, force: true });

if (failures) {
  console.error(`\nconfig-management: ${failures} failed`);
  process.exit(1);
}
console.log("config-management ok");
