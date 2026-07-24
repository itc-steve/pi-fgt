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
| `/fortigate on` | Enable all tools **this session** |
| `/fortigate off` | Disable for this session |
| `/fortigate` or `/fortigate toggle` | Flip on/off |
| `/fortigate status` | Show on/off + visible/hidden devices |
| `/fortigate devices` | **Interactive picker** — toggle each FortiGate visible/hidden |

## Device visibility (`/fortigate devices`)

Opens a checkbox picker (↑↓ move, enter/space toggle, `/` search, esc close).
Hidden devices are **invisible to the AI**: not listed by `list_fortigate_devices`,
not resolvable by any tool. This stops the model getting confused by FortiGates
you don't want it touching — **without editing `fortigate.json`**.

Visibility is **persistent** across sessions/restarts, stored in
`~/.pi/agent/fortigate.state.json` (`{ "hidden": ["device-key", …] }`).
Unhide any time via the picker.

`/new` or new session → back to `sessionDefault` (default **off**). Must `/fortigate on` again.

Config knob:

```json
"sessionDefault": "off"
```

Set `"on"` only if you want tools auto-enabled every session (not recommended).

## Config (two files side by side)

| File | Purpose |
|------|---------|
| `~/.pi/agent/fortigate.json` | Device names, URL, VDOM, `tokenEnv` **name**, `sessionDefault` (no secrets) |
| `~/.pi/agent/fortigate.env` | Actual tokens as `KEY=value` |

```bash
# after pi install, examples live under the package install path, or copy from a checkout:
cp /path/to/pi-fgt/fortigate.json.example ~/.pi/agent/fortigate.json
cp /path/to/pi-fgt/fortigate.env.example  ~/.pi/agent/fortigate.env
chmod 600 ~/.pi/agent/fortigate.env
# edit both
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
device is visible; otherwise pass `device=`. Device names are matched
case-insensitively, by unique substring, and by word tokens (e.g. `edge`
or `edge fw` → `edge-fw`; `dc core` → `dc-core-fw`).
Ambiguous input lists the candidates instead of guessing.
Use `list_fortigate_devices` if unsure — do not read `fortigate.json` for secrets.

## Guarantees

- GET only
- `attempt_write_operation` refuses, no network I/O
- VDOM pinned from device config; caller cannot override
- Path/name validation on escape hatches + ids
- Response size cap + field projection
- Tokens only via env / fortigate.env

## Token-conscious responses (v1.1)

Default tool output is projected for network-engineering triage:

- Global strip of `q_origin_key` and empty-string keys
- Sessions / FortiView / policy hits / DHCP / licenses / rogue APs / traffic logs → ops fields only
- Pass `verbose=true` when you need full FortiOS rows
- Prefer filters (`source_ip`, `name=`, `up_only=true`, `live_only=true`) before dumping catalogs

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
