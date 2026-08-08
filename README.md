<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="pi-fgt — 191 read-only FortiGate tools for the pi coding agent. Multi-device, session-gated, never writes.">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@itc-steve/pi-fgt"><img alt="npm" src="https://img.shields.io/npm/v/@itc-steve/pi-fgt?style=flat-square&color=3ecf8e&labelColor=0a0c0f"></a>
  <a href="./LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-8a9099?style=flat-square&labelColor=0a0c0f"></a>
  <img alt="GET only" src="https://img.shields.io/badge/writes-never-3ecf8e?style=flat-square&labelColor=0a0c0f">
  <img alt="tools" src="https://img.shields.io/badge/tools-191-f4f1ea?style=flat-square&labelColor=0a0c0f">
</p>

> **Not affiliated with Fortinet.** Independent open-source project. FortiGate, FortiOS, FortiAP, FortiSwitch, and related names are trademarks of Fortinet, Inc.

**pi-fgt** is a [pi](https://github.com/badlogic/pi-mono) extension that turns FortiOS REST into 191 typed, read-only tools. Ask your agent about a firewall instead of clicking through the GUI.

No MCP server. No write verbs. Tokens stay in env files. Every device is hidden from the model until you pick it, every session.

## Install

```bash
pi install npm:@itc-steve/pi-fgt
```

Then `/reload`.

## Setup

Run `/fortigate add` — an interactive wizard asks where to store the device (session or `fortigate.json`), where to store the token (session memory or `fortigate.env`), then name, host/URL, VDOM, and the token in a masked prompt. It connection-tests before writing anything; a failed test saves nothing. The env key name (`FORTIGATE_<NAME>_TOKEN`) is generated for you. Private `fortigate.env` is written `0600`; shared config uses `0660`.

The wizard is TUI-only by design: tokens never pass through command args or model-visible text, and there is no non-interactive fallback.

| Command | Effect |
|---------|--------|
| `/fortigate add` | Add a device (session or persistent) + token |
| `/fortigate token` | Set session/persistent token, or clear the session token |
| `/fortigate edit` | Change url / vdom / TLS verification (token untouched) |
| `/fortigate remove` | Remove a device, optionally delete its unused env key |

TLS starts at `verifySsl: true`. Only after a certificate failure does the wizard offer an explicit insecure retry.

### Manual files

Or write the two files yourself. `fortigate.json` says which devices *exist*; `fortigate.env` holds the tokens.

```bash
cp /path/to/pi-fgt/fortigate.json.example ~/.pi/agent/fortigate.json
cp /path/to/pi-fgt/fortigate.env.example  ~/.pi/agent/fortigate.env
chmod 600 ~/.pi/agent/fortigate.env
```

`~/.pi/agent/fortigate.json`:

```json
{
  "sessionDefault": "off",
  "maxResponseBytes": 24000,
  "devices": {
    "edge": {
      "url": "https://fw01.example.com:443",
      "tokenEnv": "FORTIGATE_EDGE_TOKEN",
      "vdom": "root",
      "verifySsl": true
    }
  }
}
```

`~/.pi/agent/fortigate.env`:

```bash
FORTIGATE_EDGE_TOKEN=your-api-token
```

Token resolves from a session token first, then `process.env[tokenEnv]`, then `fortigate.env`. Never put the token in the JSON.

For multiple Unix users sharing one writable device map and token file, point every Pi process at a group-writable directory:

```bash
export PI_FORTIGATE_CONFIG_DIR=/data/fortigate
```

Persistent mutations are locked across processes (`.fortigate.lock` in the config dir). Shared writes keep `fortigate.json` at `0664` and `fortigate.env` at `0660`; directory access still controls which users can read tokens.

Shared mode is stricter than private mode: tokens resolve from `fortigate.env` only — `process.env` is ignored, so one user's shell cannot supply another's token — and any device whose `tokenEnv` is outside `FORTIGATE_<NAME>_TOKEN` is rejected at load, so a writable shared config cannot point the extension at an unrelated secret.

## Use

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="Session flow: install, configure json+env+filters, pick devices with /fortigate, then run GET-only tools.">
</p>

Run `/fortigate` — a picker opens (↑↓ move, enter/space toggle, `/` search, esc done). Devices you don't select stay invisible to the model: not listed, not resolvable, not reachable.

| Command | Effect |
|---------|--------|
| `/fortigate` / `on` / `devices` | Enable tools + open picker |
| `/fortigate off` | Disable tools, clear all temporary state |
| `/fortigate toggle` | Off → on+picker, on → off |
| `/fortigate status` | On/off, per-device storage and credential source (never values) |
| `/fortigate filters` | Which response fields are excluded |
| `/fortigate add` / `token` / `edit` / `remove` | Setup wizards (see [Setup](#setup)) |

Selection is in-memory and per session: nothing on disk, other pi terminals unaffected, `/new` or restart resets to all-hidden. No config setting can pre-select a device — except a device you just added with `/fortigate add`, which is selected for the rest of that session.

Session devices and session tokens are memory-only too: `/fortigate off` or a new session drops them.

Every tool takes an optional `device` name — omit it when only one device is selected. Names match case-insensitively and by unique substring (`edge` → `edge-fw`); ambiguous input lists candidates instead of guessing.

## Safety

<p align="center">
  <img src="./assets/readme/guarantees.svg" width="100%" alt="Safety boundaries: GET only, write refusal, VDOM pinned, env-only tokens, path validation, session opt-in devices.">
</p>

- GET only — `attempt_write_operation` refuses with no network I/O
- VDOM pinned from device config; caller cannot override
- Path/name validation on escape hatches and ids
- Tokens only via env / `fortigate.env` / session memory — never in JSON, never in command args, masked in the wizard prompt
- Shared config dir: `process.env` tokens ignored, `tokenEnv` namespace enforced
- Setup wizards refuse to run outside TUI mode; connection errors are redacted and length-bounded
- Device exposure opt-in per session, in-memory, never persisted

## Tools

191 read-only tools covering system health, fabric/HA, routing, firewall config and live stats, VPN/SD-WAN, wireless, FortiSwitch, users, UTM, admin and logs. All 288 documented FortiOS 7.4 GET endpoints are either a typed tool or reachable via the `get_config_object` / `get_monitor_resource` escape hatches — prefer the typed tools, they carry paging and filter hints the raw paths don't.

## Response filters

FortiOS responses are enormous. Default filters strip noise fields before anything reaches the model — on a live FGT70F (v7.4.12), 434 KB of raw responses became 45 KB:

| tool | raw | filtered | cut |
|------|-----|----------|-----|
| `get_interfaces_config` | 178.9 KB | 3.9 KB | 98% |
| `get_firewall_policies` | 41.0 KB | 2.7 KB | 93% |
| `get_address_objects` | 168.5 KB | 17.7 KB | 89% |
| `get_fortiaps` | 9.0 KB | 1.6 KB | 82% |
| `get_firewall_sessions` | 14.5 KB | 6.5 KB | 55% |

Filtered responses carry a `_filtered` stamp naming what was dropped. `verbose=true` returns raw records. To change the rules permanently:

```bash
cp /path/to/pi-fgt/fortigate-filters.example.json ~/.pi/agent/fortigate-filters.json
```

Filters shrink what you fetch; they don't replace fetching less. Narrow at the source first — `source_ip`, `name=`, `up_only=true` — before dumping a whole catalog.

<details>
<summary><strong>Filter reference — precedence, groups, limits</strong></summary>

Precedence, first match wins:

1. `tools.<name>.keep[]` — always survives
2. `tools.<name>.allowlist[]` — ONLY these fields are returned (strongest)
3. `dropKeys` / `dropPrefixes` / `dropSuffixes` — explicit + group rules
4. `dropValues` — `byValue` placeholders, `disableDefaults`
5. `dropEmpty` — empty string / array / object / null

A field in an `allowlist` is immune to rule 4, so a meaningful default like `logtraffic: "disable"` is never silently dropped.

**Structural groups** reshape a payload rather than drop keys:

| group | what it does | tools |
|-------|--------------|-------|
| `apps_compact` | `apps:[{id,name,protocol,port}]` → `["udp/53"]` | sessions, fortiview |
| `resource_history` | CPU/mem time series → `current` + one sample | resource usage, performance |
| `switch_port_counts` | `ports[]` → `port_count` / `ports_up` | `get_fortiswitches` |
| `ipsec_compact` | `proxyid[]` trees → `phase2[]` + derived status | `get_ipsec_tunnels` |

**Limits:**

```jsonc
"limits": {
  "maxResponseBytes": null,   // null = defer to fortigate.json
  "maxArrayItems": 20,        // array trim size when a payload is over budget
  "maxExpandRequests": 40     // fan-out cap for get_fqdn_addresses
}
```

**Getting data back** — every noise family is a named group; flip one boolean:

```jsonc
{ "groups": { "uuid": { "exclude": false } } }   // UUIDs return everywhere
```

Re-enabling a group also re-admits its fields past a tool allowlist. To lift an allowlist entirely:

```jsonc
{ "tools": { "get_firewall_policies": { "allowlist": null } } }
```

Your file is deep-merged over the defaults — only specify what you change. Invalid JSON falls back to defaults with a warning rather than breaking tools.

**Defaults worth knowing:**

- Excluded: `uuid`, ZTNA, IPv6 blocks, DiffServ/ToS, PPTP/L2TP, `*-negate`, duplicate identity fields, FortiOS internal indexes, `switch-controller-*`, WiFi MCS/rate-score telemetry
- Kept on purpose: `country`/`srcmac` on sessions, `noise` on WiFi clients
- Set `audit.verboseBypassesFilters: false` to keep filtering even on `verbose=true` calls

</details>

## Notes

**FortiOS 7.6** relocated some monitor endpoints; the client surfaces relocation hints on 404.

**v1.2+** device selection is session-scoped and in-memory. Safe to delete any leftover `~/.pi/agent/fortigate.state.json`.

## License

[MIT](./LICENSE) © [itc-steve](https://github.com/itc-steve)
