# FortiOS 7.6.x endpoint audit (pi-fgt)

Audit date: 2026-07-29  
Live device: ITC-SD-FGT (FGT70F, FortiOS **v7.6.7** build 3704)  
Changelog: `~/vault/Fortinet/fortinet-restapi/fortios-rest-api-7.6.7-changelog.md`  
Live key trees: `live-schemas-767.json` (14 endpoints)  
Codebase: every `fortiGet(...)` / `runForti(...)` path under `src/tools/*.ts`

## Inventory

| Metric | Count |
|---|---|
| Unique concrete API paths called by tools | **~176** (plus escape-hatch dynamic `cmdb/*` / `monitor/*`) |
| `fortiGet` / `runForti` call sites | **~182** |
| Paths with a tool-level allowlist in `src/filters/defaults.ts` | **22 tools** |
| Live schema captures available | **14** endpoints |

Classification legend:

| Class | Meaning |
|---|---|
| **BROKEN** | Changelog removed the path (or live 404 proves gone) and we still call it as primary |
| **SCHEMA-DRIFT** | Still exists; 7.6.x marked "Response schema updated", and/or live keys disagree with our allowlist |
| **PARAM-DRIFT** | New/changed request params we should expose, use, or guard |
| **OK** | Path still valid; no material 7.6 issue for our usage |
| **UNVERIFIABLE ON THIS DEVICE** | Feature absent on FGT70F (no BGP, no EMS, no IPsec, no 5G/LTE); cannot prove schema |

---

## Fix these first (priority)

| # | Severity | Item | Why |
|---|---|---|---|
| 1 | **P0** | `get_fortiaps` allowlist uses `local_ipv4_addr` | Live 7.6.7 field is `local_addr`. Allowlist silently drops the AP IP. Tool description still documents the dead name (`src/tools/wireless.ts:17`). |
| 2 | **P0** | `get_wifi_clients` allowlist uses `hostname` | Live field is `host`. Client hostname never reaches the model. |
| 3 | **P0** | `get_policy_hit_counts` allowlist keeps `last_used` | Live schema has **no** `last_used`. Dead field. Also drops useful 7.6 counters (`software_*`, `asic_*`, `nturbo_*`, `uuid`, `creation_time`). |
| 4 | **P1** | `get_fortimanager_status` still hits removed path first | `monitor/system/fortimanager/status` removed in **7.6.0**. Fallback works (`central-management/status`) but every call pays a guaranteed 404 on 7.6+. Prefer version-aware primary. |
| 5 | **P1** | `get_sdwan_health_check` uses changelog-removed path | `monitor/virtual-wan/health-check` removed in **7.6.4**. Live still returns `{}` (PRESENT-but-empty). Prefer `sla-log?latest=1` as primary. Tool already hints this. |
| 6 | **P1** | `get_proxy_sessions` never sends `count` | 7.6.1 added `count` (range 20..1000), same family as sessions which later **requires** it. Risk of 424 / unbounded dump. |
| 7 | **P2** | Exploit new filter params | `wifi/client?mac=`, `firewall/policy?policyid=`, `virtual-wan/members?interface|sla|zone`, `bgp/paths?vrf=`, `blacklisted-certificates?start&count`, `managed_ap?skip_eos=` — all server-side wins we currently ignore. |
| 8 | **P2** | Allowlist misses high-value 7.6 fields | FortiAP `eos` (end-of-support), wifi `wtp_name` / `association_time` / `tx_retry_percentage`, license new categories (`genai_app`, `fortitelemetry`, `iot_detection`, …). |

---

## BROKEN

| Endpoint | Changelog | Call site | Tool | Live 7.6.7 | Notes |
|---|---|---|---|---|---|
| `monitor/system/fortimanager/status` | **Removed 7.6.0** (replacement: `monitor/system/central-management/status`) | `src/tools/system_fabric.ts:248` (primary try); fallback `:255` | `get_fortimanager_status` | Primary **404 GONE**; fallback **200** (`status`, `registration_status`, `sn`, `server`, `mgmt_ip`, `mgmt_port`) | Mitigated: catch 404 → central-management + `_note`. Still BROKEN as first hop. Dedicated tool `get_central_management_status` already uses the good path at `:226`. |
| `monitor/virtual-wan/health-check` | **Removed 7.6.4** (replacement: `virtual-wan/sla-log?latest=1&sla=…`) | `src/tools/sdwan_vpn.ts:32` | `get_sdwan_health_check` | **200** with `{}` (PRESENT-but-empty per CONTEXT) | Soft-broken / deprecated. Tool already returns `_empty` + hint to `get_sdwan_sla_log`. Do not treat empty as "healthy". |

### Removed in 7.6.x that we do **not** call (good)

| Removed path | Version | What we call instead |
|---|---|---|
| `monitor/firewall/session` (singular) | 7.6.0 | `monitor/firewall/sessions` — `src/tools/network.ts:147` (fixed; `count` always ≥ 20) |
| `monitor/fortiview/statistics` | 7.6.0 | `monitor/fortiview/realtime-statistics` — `src/tools/misc.ts:431` |
| `monitor/switch-controller/managed-switch/health` | 7.6.0 | `…/health-status` — `src/tools/switch_monitor.ts:36` |

### Not broken (reclassified)

| Path | Why not BROKEN |
|---|---|
| `monitor/system/security-rating` (+ `/status`) | Listed removed **and** re-added in 7.6.3 (moved around docs); **7.6.5** still has "Access group Updated" on the monitor paths. We call them at `system_fabric.ts:366` / `:386`. Treat as **OK**. |
| `monitor/system/5g-modem/*`, `monitor/system/lte-modem/status` | We do not call these. Live 404 is **UNVERIFIABLE ON THIS DEVICE** (no modem HW). |

---

## SCHEMA-DRIFT (allowlist vs live)

Allowlists live in `src/filters/defaults.ts` under `tools.<name>.allowlist`. Missing live fields are **silently dropped** before the model sees them.

### Proven against `live-schemas-767.json`

#### 1. `get_fortiaps` → `monitor/wifi/managed_ap`

| | |
|---|---|
| Call site | `src/tools/wireless.ts:27` |
| Allowlist | `defaults.ts:348-356` |
| Changelog | Response schema updated: **7.6.0, 7.6.1, 7.6.3, 7.6.4, 7.6.5, 7.6.7** |

| Allowlist entry | Live 7.6.7 field? | Verdict |
|---|---|---|
| `name`, `serial`, `status`, `state`, `clients`, `connecting_interface`, `board_mac`, `join_time`, `os_version`, `ap_profile`, `cpu_usage`, `mem_free`, `mem_total`, `health`, `last_failure`, `last_reboot_time`, `wan_status` | yes | OK |
| **`local_ipv4_addr`** | **no** — live name is **`local_addr`** | **DEAD allowlist key** (AP IP never shown) |

Important live fields the allowlist **drops**:

| Live field | Why it matters |
|---|---|
| **`local_addr`** | Actual management IP (rename of what we intended) |
| **`eos`** | FortiGuard end-of-support flag (new skip_eos param exists partly because this is noisy/useful) |
| `connection_state` | Finer than `status`/`state` |
| `wtp_id`, `ssid`, `forticare_registration_status`, `is_wpa3_supported`, `last_failure_code`, `poe_mode`, `region`/`location` | Ops-relevant |

#### 2. `get_wifi_clients` → `monitor/wifi/client`

| | |
|---|---|
| Call site | `src/tools/wireless.ts:60` |
| Allowlist | `defaults.ts:358-368` |
| Changelog | Response schema updated: **7.6.0, 7.6.5**; param `mac` added **7.6.1** |

| Allowlist entry | Live 7.6.7 field? | Verdict |
|---|---|---|
| `mac`, `ip`, `ssid`, `vap_name`, `wtp_id`, `wtp_ip`, `manufacturer`, `os`, `signal`, `snr`, `channel`, `vlan_id`, `radio_type`, `mimo`, `bandwidth_tx`, `bandwidth_rx`, `security_str`, `authentication`, `idle_time`, `data_rate_bps`, `health`, `noise` | yes | OK |
| **`hostname`** | **no** — live name is **`host`** | **DEAD allowlist key** |

Important live fields the allowlist **drops**:

| Live field | Why it matters |
|---|---|
| **`host`** | Client hostname (rename) |
| `wtp_name` | Human AP name (we only keep serial-ish `wtp_id`) |
| `association_time` | How long connected |
| `tx_retry_percentage`, `tx_discard_percentage` | RF quality beyond SNR |
| `ip6`, `security`, `encrypt`, `bytes_rx`/`bytes_tx` | Dual-stack + totals |

#### 3. `get_policy_hit_counts` → `monitor/firewall/policy`

| | |
|---|---|
| Call site | `src/tools/network.ts:216` |
| Allowlist | `defaults.ts:335-340` |
| Changelog | `policyid` param **7.6.3**; response schema updated **7.6.7** |

| Allowlist entry | Live 7.6.7 field? | Verdict |
|---|---|---|
| `policyid`, `active_sessions`, `bytes`, `packets`, `hit_count` | yes | OK |
| **`last_used`** | **absent** in live capture | **DEAD allowlist key** |

Live fields allowlist drops (still present on wire; description claims verbose keeps asic/software/nturbo but allowlist still applies unless `verboseBypassesFilters`):

- `uuid`, `creation_time`
- `software_bytes`, `software_packets`
- `asic_bytes`, `asic_packets`
- `nturbo_bytes`, `nturbo_packets`

#### 4. `get_firewall_sessions` → `monitor/firewall/sessions`

| | |
|---|---|
| Call site | `src/tools/network.ts:147` |
| Allowlist | `defaults.ts:269-276` |
| Changelog | singular removed **7.6.0**; `count` **7.6.1** (now required); response schema **7.6.5** |

| Allowlist entry | Live? | Verdict |
|---|---|---|
| `saddr`, `sport`, `daddr`, `dport`, `proto`, `srcintf`, `dstintf`, `policyid`, `duration`, `sentbyte`, `rcvdbyte`, `apps`, `country`, `srcmac` | yes | OK |
| **`dstmac`** | **not in live sample** | likely dead / rare; not harmful |

Live extras intentionally dropped (forensics off by default is fine): `snaddr`, `snport`, `policytype`, `type`, `tx_packets`, `rx_packets`, `tx_shaper_drops`, `rx_shaper_drops`, UUIDs. No rename bugs.

#### 5. `get_fortiview_statistics` → `monitor/fortiview/realtime-statistics`

| | |
|---|---|
| Call site | `src/tools/misc.ts:431` |
| Allowlist | `defaults.ts:342-346` |

Allowlist fields all present on live. Drops `country`, packet/shaper counters: intentional density tradeoff. **OK** at field level.

#### 6. `get_available_licenses` → `monitor/license/status`

| | |
|---|---|
| Call sites | `src/tools/system.ts:166` (verbose), `:172` (health subset) |
| Allowlist | `defaults.ts:398-404` |
| Changelog | Response schema updated nearly every 7.6.x release |

| Allowlist entry | Live? | Verdict |
|---|---|---|
| Categories `fortiguard`, `forticare`, `antivirus`, `ips`, `web_filtering`, `forticloud`, `vdom` | yes | OK (intentional health subset) |
| Leafs `status`, `connected`, `has_connected`, `expires`, `version`, `used`, `max`, `can_upgrade` | mostly yes | OK |
| **`support_level`** | **no** such leaf; `forticare.support.{hardware,enhanced,comprehensive}` objects exist | **DEAD / wrong shape** |

New 7.6-era categories the health subset never surfaces (only with `verbose=true` + allowlist bypass):  
`genai_app`, `fortitelemetry`, `iot_detection`, `ot_detection`, `ai_malware_detection`, `inline_casb`, `security_rating`, `forticloud_logging`, `fortiems_cloud`, `sdwan_network_monitor`, …

#### 7. `get_ipsec_tunnels` → `monitor/vpn/ipsec`

| | |
|---|---|
| Call site | `src/tools/vpn.ts:56` |
| Allowlist | `defaults.ts:421-426` |
| Changelog | Response schema updated **7.6.1, 7.6.3, 7.6.7** |

Live capture: **empty array** (`schema: []`). **UNVERIFIABLE ON THIS DEVICE** (0 IPsec tunnels). Cannot prove allowlist field names.

#### 8. EMS tools

| Tool / path | Call site | Live |
|---|---|---|
| `get_ems_status_summary` → `monitor/endpoint-control/ems/status-summary` | `utm_endpoint.ts:303` | **200 empty list** (0 EMS) |
| `get_ems_status` → `…/ems/status` | `utm_endpoint.ts:328` | not in capture |

Schema updated **7.6.3, 7.6.4, 7.6.5, 7.6.7**. No allowlist. **UNVERIFIABLE ON THIS DEVICE**.

#### 9. Other schema-updated endpoints we call (no allowlist; no live proof of field renames)

| Endpoint | Call site | Changelog response updates | Live proof |
|---|---|---|---|
| `monitor/system/csf` | `system_fabric.ts:46` | 7.6.0 → 7.6.7 (every release) | Live: `{devices.fortigate[], protocol_enabled}` — shape present; no allowlist |
| `monitor/switch-controller/detected-device` | `switch_monitor.ts:163` | 7.6.7 | Live keys: `mac, port_name, switch_id, serial, vlan_id, port_id, last_seen, vdom` — tool does client reshape; no allowlist |
| `monitor/switch-controller/managed-switch/status` | `switch.ts:35`, `:88` | 7.6.0, 7.6.4 | **Not in live-schemas** (only health-status captured). Allowlist `get_fortiswitches` / `get_switch_port_status` **UNVERIFIABLE** field-by-field |
| `monitor/system/available-interfaces` | `system_health.ts:305` | 7.6.0–7.6.4 | No live capture |
| `monitor/system/resource/usage` | `system.ts:34`, `:52` | 7.6.1 | No live capture |
| `monitor/user/device/query` | `users.ts:161` | 7.6.0, 7.6.1, 7.6.3 | No live capture |
| `monitor/user/firewall` | `users.ts:38` | 7.6.1 | No live capture |
| `monitor/user/proxy` | `users.ts:78` | 7.6.1 | No live capture |
| `monitor/virtual-wan/members` | `sdwan_vpn.ts:65` | 7.6.0, 7.6.1, 7.6.4 | No live capture |
| `monitor/firewall/address-dynamic` | `firewall_monitor.ts:93` | 7.6.1, 7.6.4 | No live capture |
| `monitor/firewall/ippool` | `firewall_monitor.ts:251` | 7.6.0 | No live capture |
| `monitor/router/bgp/neighbors` (+6) | `router.ts:62`, `:82` | 7.6.4 | **UNVERIFIABLE ON THIS DEVICE** (no BGP; paths return 500) |
| `monitor/router/bgp/paths` (+6) | `router.ts:122`, `:142` | 7.6.7 (schema + `vrf`) | **UNVERIFIABLE ON THIS DEVICE** (500) |
| `monitor/vpn/ssl`, `monitor/vpn/ssl/stats` | `vpn.ts:116`, `sdwan_vpn.ts:132` | 7.6.3 | No tunnels / not captured |
| `monitor/webfilter/fortiguard-categories` | `utm_endpoint.ts:183` | 7.6.5 | No capture |
| `monitor/webfilter/override` | `utm_endpoint.ts:223` | 7.6.0 | No capture |
| `monitor/extender-controller/extender` | `misc.ts:124` | 7.6.0, 7.6.1 | No capture |
| `monitor/extension-controller/fortigate` | `misc.ts:144` | 7.6.1 | No capture |
| `monitor/system/ha-history`, `ha-hw-interface` | `system_fabric.ts:146`, `:166` | 7.6.1 | HA not verified |
| `monitor/system/vdom-resource` | `system_health.ts:125` | 7.6.0 | No capture |
| `monitor/system/firmware` | `system.ts:77` | 7.6.0 | No capture |
| `monitor/system/timezone` | `system_health.ts:205` | 7.6.5 | No capture |
| `monitor/user/fsso` | `users.ts:206` | 7.6.0 | No capture |
| `monitor/firewall/local-in` | `firewall_monitor.ts:336` | 7.6.0 (+ `include_ttl`) | No capture |
| `monitor/router/ipv6` | `router.ts:42` | 7.6.1 | No capture |
| `monitor/router/lookup` | `router.ts:308` | 7.6.3 | No capture |
| `monitor/log/device/state` | `misc.ts:311` | param only (7.6.4) | Live shape OK (`memory/disk/faz/forticloud…`) |

---

## PARAM-DRIFT

Params we should **guard** (risk of 424 / huge payloads) or **exploit** (server-side filter).

| Endpoint | New/changed param | Version | Our call site | Current behavior | Action |
|---|---|---|---|---|---|
| `monitor/firewall/sessions` | `count` **required**, range 20..1000 | 7.6.1 (+ enforced later) | `network.ts:147` | Always sends `count≥20` | **OK** (fixed) |
| `monitor/firewall/proxy/sessions` | `count` range 20..1000 | 7.6.1 | `firewall_monitor.ts:316` | Sends **no** params | **Guard**: default `count=20` (or 50); same pattern as sessions |
| `monitor/firewall/load-balance` | `count` | 7.6.1 | `firewall_monitor.ts:396` | No params | Optional cap |
| `monitor/router/bgp/paths` | `vrf` | **7.6.7** | `router.ts:122` | No params | Expose optional `vrf` (defaults all) |
| `monitor/router/bgp/paths6` | `vrf` | **7.6.7** | `router.ts:142` | No params | Same |
| `monitor/system/traffic-history/interface` | `scope` = vdom\|global | **7.6.7** | `system_health.ts:357` | Sends `interface` (+ optional `time_period`); live probe **424** on this box (history/FortiView off) | Optional `scope`; 424 already handled in tool |
| `monitor/log/device/state` | `scope` = vdom\|global | 7.6.4 | `misc.ts:311` | No params | Optional for multi-VDOM |
| `monitor/wifi/client` | `mac` | 7.6.1 | `wireless.ts:60` | Client-side `ap`/`ssid` only | Prefer server `mac=` for single-client lookup |
| `monitor/wifi/managed_ap` | `skip_eos` | 7.6.3 | `wireless.ts:27` | Always full (incl. EOS data) | Optional; pairs with allowlist `eos` |
| `monitor/firewall/policy` | `policyid` array | 7.6.3 | `network.ts:216` | Always full table | Server-side filter by id |
| `monitor/router/ipv4` | `operator` and/or | 7.6.3 | `network.ts:31` | Only `count` | Expose when multi-filter |
| `monitor/router/ipv6` | `operator` | 7.6.3 | `router.ts:42` | Only `count` | Same |
| `monitor/router/statistics` | `operator` | 7.6.3 | `router.ts:282` | No params | Same |
| `monitor/virtual-wan/members` | `interface`, `sla`, `zone`, `skip_vpn_child` | 7.6.1 / 7.6.4 | `sdwan_vpn.ts:65` | No params | High value for SD-WAN triage |
| `monitor/virtual-wan/sla-log` | `sla`, `latest`, `include_sla_targets_met`, `skip_vpn_child` | 7.6.1 / 7.6.4 | `sdwan_vpn.ts:112` | Already supports `sla` + `latest` | **OK** (partial); could add `skip_vpn_child` |
| `monitor/utm/blacklisted-certificates` | `start`, `count` (max 2000) | 7.6.1 | `utm_endpoint.ts:83` | No params | Pagination guard |
| `monitor/switch-controller/matched-devices` | `mac` | 7.6.1 | `switch_monitor.ts:208` | No params | Server filter |
| `monitor/wifi/matched-devices` | `mac` | 7.6.1 | `wifi.ts:287` | No params | Server filter |
| `monitor/firewall/local-in` | `include_ttl` | 7.6.0 | `firewall_monitor.ts:336` | No params | Optional completeness |
| `monitor/virtual-wan/health-check` | `health_check_name` (then path removed) | 7.6.1 / remove 7.6.4 | `sdwan_vpn.ts:32` | No params | Prefer migrate off path |

---

## OK (representative)

Paths we call that are either unchanged in 7.6.x for our purposes, already on the replacement endpoint, or only gained optional params we can ignore safely:

| Path | Call site (primary) | Note |
|---|---|---|
| `monitor/firewall/sessions` | `network.ts:147` | Plural + count fixed |
| `monitor/fortiview/realtime-statistics` | `misc.ts:431` | Correct replacement |
| `monitor/switch-controller/managed-switch/health-status` | `switch_monitor.ts:36` | Correct replacement |
| `monitor/system/central-management/status` | `system_fabric.ts:226` | Correct FMG path |
| `monitor/system/status`, `time`, `performance/status`, `interface`, `dhcp`, `sensor-info`, … | `system.ts` / `system_health.ts` / `network.ts` | No 7.6 removal |
| `monitor/network/arp`, `lldp/*`, `dns/latency`, … | `network.ts` / `misc.ts` | OK |
| `monitor/router/ospf/neighbors`, `policy`, `sdwan/routes*`, `lookup*` | `router.ts` | OK (feature-dependent data) |
| `monitor/virtual-wan/sla-log` | `sdwan_vpn.ts:112` | Preferred SD-WAN health source |
| `monitor/wifi/ap_status`, `statistics`, `rogue_ap`, … | `wifi.ts` | OK |
| `monitor/registration/forticare/check-connectivity` | `misc.ts:84` | **New in 7.6.5**; we already call it |
| Most `cmdb/*` policy/address/admin/vpn phase tools | `firewall.ts`, `admin.ts`, `vpn.ts`, `security.ts` | Changelog had almost no CMDB removals for our read paths |
| Escape hatches | `escape.ts:32`, `:63` | Dynamic; version risk is user-supplied path |

Full unique path list is derivable via:

```bash
rg -oN 'fortiGet\("([^"]+)"' -r '$1' src/tools/ | sort -u
rg -oN 'runForti\("([^"]+)"' -r '$1' src/tools/ | sort -u
```

---

## Allowlist mismatch summary (actionable)

| Tool | File:lines (allowlist) | Dead keys (not on live wire) | Rename to | High-value live keys currently dropped |
|---|---|---|---|---|
| `get_fortiaps` | `defaults.ts:348-356` | `local_ipv4_addr` | `local_addr` | `eos`, `connection_state`, `wtp_id`, `ssid`, `forticare_registration_status` |
| `get_wifi_clients` | `defaults.ts:358-368` | `hostname` | `host` | `wtp_name`, `association_time`, `tx_retry_percentage`, `tx_discard_percentage`, `ip6` |
| `get_policy_hit_counts` | `defaults.ts:335-340` | `last_used` | remove (or keep only if verbose path reintroduces it) | `uuid`, `software_*`, `asic_*`, `nturbo_*`, `creation_time` (verbose) |
| `get_firewall_sessions` | `defaults.ts:269-276` | `dstmac` (absent in sample) | optional drop | none critical |
| `get_available_licenses` | `defaults.ts:398-404` | `support_level` | nest under `forticare.support` or drop | new 7.6 categories only if product wants them in default health view |
| `get_fortiview_statistics` | `defaults.ts:342-346` | (none) | — | `country` optional |
| `get_fortiswitches` / `get_switch_port_status` | `defaults.ts:370-375`, `429-435` | **UNVERIFIABLE ON THIS DEVICE** (no status schema capture) | re-probe `managed-switch/status` | — |
| `get_ipsec_tunnels` | `defaults.ts:421-426` | **UNVERIFIABLE ON THIS DEVICE** (0 tunnels) | re-probe with tunnels | — |
| CMDB allowlists (`get_firewall_policies`, addresses, …) | `defaults.ts:246-333` | Not re-validated against 7.6 CMDB (out of monitor changelog scope) | — | — |

Also fix the **stale description** that teaches the model the wrong field name:

- `src/tools/wireless.ts:17` — still says `local_ipv4_addr`

---

## Device limits (do not over-claim)

| Feature | Device fact | Impact on this audit |
|---|---|---|
| BGP | not configured; `bgp/paths` → **500** | SCHEMA/PARAM for BGP = **UNVERIFIABLE ON THIS DEVICE** |
| EMS | 0 EMS; summary empty list | EMS schema updates **UNVERIFIABLE** |
| IPsec | 0 tunnels; empty array | IPsec schema **UNVERIFIABLE** |
| 5G / LTE modem | no HW; both status paths 404 | Cannot distinguish removed vs no-hardware for LTE; 5G is **new** in 7.6.x |
| SD-WAN health probes | none; health-check `{}` | Empty ≠ missing endpoint |
| Interface traffic history | **424** even with `interface=wan1` | Tracking disabled in config, not path removal |
| FortiSwitch / FortiAP | 1 switch, 2 APs, ~10 clients | managed_ap + wifi_client + detected_device + health-status **verified** |
| FortiManager | registered | central-management **verified** |

---

## Suggested fix order (engineering)

1. **Allowlist renames** in `src/filters/defaults.ts` only:  
   `local_ipv4_addr` → `local_addr`, `hostname` → `host` (wifi), drop `last_used`, drop or fix `support_level`.  
   Then `npm run filters:example`.
2. **Add** `eos` (and maybe `connection_state`) to `get_fortiaps`; add `host`/`wtp_name` to wifi clients.
3. **FortiManager tool**: try `central-management/status` first on 7.6+, or skip legacy path when version ≥ 7.6.0.
4. **SD-WAN**: document / prefer `get_sdwan_sla_log(latest=true)`; keep health-check as deprecated alias.
5. **Proxy sessions**: always send `count` (mirror sessions clamp).
6. **Optional params** (tool schema + query): `mac` on wifi client, `policyid` on policy stats, SD-WAN member filters, BGP `vrf`, blacklisted-cert pagination.
7. **Re-capture** live schemas for: `managed-switch/status`, `system/available-interfaces`, `system/resource/usage`, `user/device/query`, `virtual-wan/members`, and any box that has BGP/IPsec/EMS.

---

## Sources

- Changelog: `~/vault/Fortinet/fortinet-restapi/fortios-rest-api-7.6.7-changelog.md` (7.6.0 through 7.6.7)
- Live probes: run `CONTEXT.md` verified table
- Live key trees: `live-schemas-767.json` (14 endpoints)
- Code: `src/tools/*.ts`, allowlists `src/filters/defaults.ts`
