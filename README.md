# pi-fgt

Pi extension: read-only FortiGate tools (191) via FortiOS REST. Multi-device. **No writes ever.** No MCP.

> **Not affiliated with Fortinet.** This is an independent open-source project. FortiGate, FortiOS, FortiAP, FortiSwitch, FortiGuard, and related names are trademarks of Fortinet, Inc.

## Install

```bash
pi install npm:@itc-steve/pi-fgt
```

From a local checkout:

```bash
pi install /path/to/pi-fgt
```

Then `/reload`.

## Enable / disable tools (per session)

FortiGate tools register at load but stay **inactive by default** each new session.

| Command | Effect |
|---------|--------|
| `/fortigate` or `/fortigate on` | Enable tools **and open the device picker** for this session |
| `/fortigate off` | Disable tools and clear the device selection |
| `/fortigate toggle` | Off → on+picker, on → off |
| `/fortigate status` | Show on/off + which devices the AI can see |
| `/fortigate filters` | Show which response fields are excluded, and from which config |

## Device selection (the picker)

**Every FortiGate is hidden from the AI by default, every session.** `/fortigate`
and `/fortigate on` open a picker (↑↓ move, enter/space toggle, `/` search, esc
done) where you turn on just the devices this session should expose.

Unselected devices are invisible to the *model*: not listed by
`list_fortigate_devices`, not resolvable by any tool. You still see all of them
in the picker — it hides them from the AI, not from you. The point is to stop
the model getting confused when it has to match your loose wording ("the edge
one") against a long list of FortiGates.

Selection is **in-memory and per pi session**:

- Nothing is written to disk — there is no state file and no save command.
- Other pi terminals are unaffected; each session picks its own devices.
- `/new`, restart, or `/fortigate off` → back to all-hidden.
- **No config setting can pre-select a device.** `fortigate.json` defines what
  *exists*; only the picker decides what the AI *sees*.

Config knob (tools only — does not affect device visibility):

```json
"sessionDefault": "off"
```

Set `"on"` to auto-activate the tools each session; devices still start hidden
until you run `/fortigate`.

## Config (three files side by side)

| File | Purpose |
|------|---------|
| `~/.pi/agent/fortigate.json` | Device names, URL, VDOM, `tokenEnv` **name**, `sessionDefault` (no secrets) |
| `~/.pi/agent/fortigate.env` | Actual tokens as `KEY=value` |
| `~/.pi/agent/fortigate-filters.json` | Which response fields reach the AI (optional — defaults apply if absent) |

```bash
# after pi install, examples live under the package install path, or copy from a checkout:
cp /path/to/pi-fgt/fortigate.json.example ~/.pi/agent/fortigate.json
cp /path/to/pi-fgt/fortigate.env.example  ~/.pi/agent/fortigate.env
chmod 600 ~/.pi/agent/fortigate.env
# optional — only if you want to change what gets filtered out:
cp /path/to/pi-fgt/fortigate-filters.example.json ~/.pi/agent/fortigate-filters.json
# edit as needed
```

### `fortigate.json`

```json
{
  "sessionDefault": "off",
  "maxResponseBytes": 24000,
  "devices": {
    "edge": {
      "url": "https://fw01.example.com:443",
      "tokenEnv": "FORTIGATE_EDGE_TOKEN",
      "vdom": "root",
      "verifySsl": false
    }
  }
}
```

### `fortigate.env` (secrets)

```bash
FORTIGATE_EDGE_TOKEN=your-rest-api-token-here
```

Token resolve order:

1. `process.env[tokenEnv]` (shell export wins if set)
2. `~/.pi/agent/fortigate.env` key matching `tokenEnv`

Never put the token string in the JSON.

Every tool accepts optional `device` (name key). Omit only when exactly one
device is selected for the session; otherwise pass `device=`.
Devices not selected in `/fortigate` are not resolvable at all. Device names are matched
case-insensitively, by unique substring, and by word tokens (e.g. `edge`
or `edge fw` → `edge-fw`; `dc core` → `dc-core-fw`).
Ambiguous input lists the candidates instead of guessing.
Use `list_fortigate_devices` if unsure — do not read `fortigate.json` for secrets.

## Guarantees

- GET only
- `attempt_write_operation` refuses, no network I/O
- VDOM pinned from device config; caller cannot override
- Path/name validation on escape hatches + ids
- Response size cap + configurable field filtering
- Tokens only via env / fortigate.env
- Device exposure is opt-in per session, in-memory, never persisted

## Session-scoped device exposure (v1.2)

Device visibility used to live in `~/.pi/agent/fortigate.state.json`, which was
read and rewritten globally — toggling a device in one terminal silently changed
every other running pi session. That file is gone. Selection is now in-memory,
per session, all-hidden until you pick. Safe to delete any leftover
`~/.pi/agent/fortigate.state.json`; it is no longer read.

## Configurable response filters (v1.3)

Field filtering used to be hardcoded across `src/types.ts` and `bounds.ts`, so
users could not see or change what was being removed. It now lives in one
config file.

```bash
cp fortigate-filters.example.json ~/.pi/agent/fortigate-filters.json
```

Run `/fortigate filters` to see what is currently excluded and from where.
Responses that lost fields carry a `_filtered` stamp naming the groups, so the
model can tell you what it did not receive.

**Measured on a live FGT70F (v7.4.12), defaults, 8 common tools: 434KB → 45KB (90%).**

| tool | raw | filtered | cut |
|------|-----|----------|-----|
| `get_interfaces_config` | 178.9 KB | 3.9 KB | 98% |
| `get_firewall_policies` | 41.0 KB | 2.7 KB | 93% |
| `get_address_objects` | 168.5 KB | 17.7 KB | 89% |
| `get_fortiaps` | 9.0 KB | 1.6 KB | 82% |
| `get_firewall_sessions` | 14.5 KB | 6.5 KB | 55% |

### How it works

Precedence, first match wins:

1. `tools.<name>.keep[]` — always survives
2. `tools.<name>.allowlist[]` — ONLY these fields are returned (strongest)
3. `dropKeys` / `dropPrefixes` / `dropSuffixes` — explicit + group rules
4. `dropValues` — `byValue` placeholders, `disableDefaults`
5. `dropEmpty` — empty string / array / object / null

A field in an `allowlist` is immune to rule 4, so a meaningful default like
`logtraffic: "disable"` is never silently dropped.

### Getting data back

Every noise family is a named group with a `why`. Flip one boolean:

```jsonc
{ "groups": { "uuid": { "exclude": false } } }   // UUIDs return everywhere
```

Re-enabling a group also re-admits its fields past a tool allowlist, so this
works even for tools with a strict allowlist. To lift an allowlist entirely:

```jsonc
{ "tools": { "get_firewall_policies": { "allowlist": null } } }
```

Your file is deep-merged over the defaults — only specify what you change.
Invalid JSON falls back to defaults with a warning rather than breaking tools.

### Defaults worth knowing

- **Excluded:** `uuid`, ZTNA, IPv6 blocks, DiffServ/ToS, PPTP/L2TP, `*-negate`,
  duplicate identity fields (`wtp_name` = `wtp_id`), FortiOS internal indexes,
  `switch-controller-*`, WiFi MCS/rate-score telemetry
- **Kept on purpose:** `country`/`srcmac` on sessions (geo + MAC correlation),
  `noise` on WiFi clients (RF floor) — both were dropped before v1.3
- **`verbose=true` still filters** by default; set
  `audit.verboseBypassesFilters: true` for a true raw escape hatch

Still prefer query filters (`source_ip`, `name=`, `up_only=true`) before
dumping catalogs.

## Tools

191 read-only tools. GET only. Grouped by `src/tools/*.ts`:

| Area | File | Coverage |
|------|------|----------|
| System / health | `system.ts`, `system_health.ts` | status, resources, performance, storage, VM, vdom/global resources, processes, NTP, PoE, transceivers, traffic history, FQDN resolve, ipconf |
| System / fabric | `system_fabric.ts` | Security Fabric (CSF), HA checksums/history, cluster/SLBC, central-mgmt, FortiManager, sandbox, security-rating, SDN, botnet, config revisions |
| Network | `network.ts`, `misc.ts` | routing, ARP, DHCP, sessions, policy hits, LLDP, DNS latency, DDNS, reverse-IP |
| Router | `router.ts` | IPv6 RIB, BGP neighbors/paths, OSPF, policy routes, SD-WAN routes, route lookup |
| Firewall (config) | `firewall.ts` | policies, addresses, services, VIPs, ippools, routes, interfaces, zones |
| Firewall (live) | `firewall_monitor.ts` | ACL/DNAT/SNAT stats, proxy sessions, local-in, shapers, internet-service lookup, LB health, UUID list |
| VPN / SD-WAN | `vpn.ts`, `sdwan_vpn.ts` | IPsec p1/p2/tunnels, SSL-VPN sessions+stats, SD-WAN health/members/SLA |
| Wireless | `wireless.ts`, `wifi.ts` | FortiAPs, clients, rogue/interfering APs, stats, firmware, NAC |
| Switch | `switch.ts`, `switch_monitor.ts` | FortiSwitch status/ports, health, transceivers, PoE, detected/NAC devices |
| Users | `users.ts` | firewall/proxy users, banned, device store, FSSO, FortiToken |
| UTM / endpoint | `security.ts`, `utm_endpoint.ts` | UTM profiles, AV/IPS/webfilter stats, endpoint-control/EMS, wanopt, webcache |
| Admin / logs / misc | `admin.ts`, `logs.ts`, `misc.ts` | admins, profiles, `list_fortigate_devices`, logs, license/registration/FortiGuard, extenders, FortiView |
| Escape | `escape.ts` | generic cmdb/monitor GET + write refusal |

Prefer typed tools over guessing escape-hatch paths. All 288 documented FortiOS
7.4 GET endpoints are either wrapped as a typed tool or reachable via the
`get_config_object` / `get_monitor_resource` escape hatches.
