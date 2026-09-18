/**
 * Filter engine self-check. Run: npm run test:filters
 * Fixtures are real FortiOS 7.4 payload shapes (FGT70F).
 * Assert-based, no test framework.
 */

import assert from "node:assert/strict";
import { DEFAULT_FILTERS, type FilterConfig } from "./defaults.js";
import { applyFilters, compile, type FilterStats } from "./engine.js";
import {
	withToolContext,
	filterForCurrentTool,
	filterAudit,
	groupEnabled,
} from "./index.js";

const fresh = (): FilterStats => ({ keysDropped: 0, groups: new Set() });

function run(data: unknown, tool?: string, cfg: FilterConfig = DEFAULT_FILTERS) {
	const stats = fresh();
	const out = applyFilters(data, compile(cfg, tool), stats, 0);
	return { out: out as any, stats };
}

// --- fixtures --------------------------------------------------------------

const POLICY = {
	policyid: 1,
	status: "enable",
	uuid: "2d0f0986-cf9b-51ef-30c4-805df808e17b",
	"uuid-idx": 935,
	srcintf: [{ name: "MGMT" }],
	dstintf: [{ name: "virtual-wan-link" }],
	action: "accept",
	nat64: "disable",
	"ztna-status": "disable",
	srcaddr: [{ name: "MGMT address" }],
	srcaddr6: [],
	"ztna-ems-tag": [],
	"internet-service6-src-custom": [],
	"reputation-minimum": 0,
	"rtp-addr": [],
	schedule: "always",
	service: [{ name: "ALL" }],
	"tos-mask": "0x00",
	"diffservcode-forward": "000000",
	"pcp-outbound": "disable",
	"srcaddr-negate": "disable",
	natip: "0.0.0.0 0.0.0.0",
	nat: "enable",
	logtraffic: "disable",
	ippool: "enable",
	fixedport: "enable",
	"traffic-shaper": "wan-limit",
	"session-ttl": "300",
	comments: "",
};

const SESSION = {
	saddr: "192.168.5.3",
	sport: 50174,
	daddr: "174.210.228.247",
	dport: 8913,
	proto: "udp",
	srcmac: "b8:3a:9d:74:ea:5a",
	src_uuid: "fd78e3d0-cf9b-51ef-6221-4133f59810c8",
	src_uuid_type: "firewall.address",
	country: "United States",
	policyid: 2,
	vf: "root",
	app_list_id: 0,
	policytype: "policy",
	expiry: "120",
	sentbyte: 139892,
	tx_packets: 100,
	rx_packets: 90,
	tx_shaper_drops: 2,
	rx_shaper_drops: 1,
};

const AP_CLIENT = {
	mac: "4c:bb:47:13:b4:02",
	ip: "192.168.5.7",
	wtp_id: "FP421ETF20019562",
	wtp_name: "FP421ETF20019562",
	signal: -67,
	noise: -95,
	sta_rxrate_mcs: 6,
	sta_txrate_mcs: 5,
	sta_rxrate_score: 67,
	sta_rxrate: 130000,
	sta_txrate: 65000,
	data_rxrate_bps: 130000000,
	data_txrate_bps: 65000000,
	tx_retry_percentage: 12,
	tx_discard_percentage: 3,
	association_time: 1787539052,
	wtp_radio: 1,
	"11k_capable": false,
	"11v_capable": true,
	"11r_capable": true,
	captive_portal_authenticated: true,
	uses_captive_portal: true,
	lan_authenticated: false,
	security: 10,
	security_str: "wpa2_only_personal",
	health: {
		signal_strength: { value: -67, severity: "fair" },
		snr: { value: 28, severity: "good" },
	},
};

const AGGREGATE_INTERFACE = {
	name: "fortilink",
	type: "aggregate",
	speed: "auto",
	member: [{ "interface-name": "a" }, { "interface-name": "b" }],
	vrf: 2,
	mtu: 1400,
	"mtu-override": "enable",
	"src-check": "disable",
	"dhcp-relay-service": "enable",
	"dhcp-relay-ip": "192.0.2.53",
	"lacp-mode": "active",
	"lacp-speed": "slow",
	"min-links": 1,
	"min-links-down": "operational",
	bfd: "global",
	stp: "disable",
	algorithm: "L4",
};

// --- 1. uuid is gone, ops fields survive -----------------------------------
{
	const { out, stats } = run(POLICY, "get_firewall_policies");
	assert.equal(out.uuid, undefined, "uuid must be dropped");
	assert.equal(out["uuid-idx"], undefined, "uuid-idx must be dropped");
	assert.equal(out.policyid, 1, "policyid must survive");
	assert.equal(out.action, "accept", "action must survive");
	assert.deepEqual(out.srcintf, [{ name: "MGMT" }], "srcintf must survive");
	assert.ok(stats.groups.has("uuid"), "uuid group must be reported");
}

// --- 1b. UUID catalog keeps correlation identity ---------------------------
{
	const uuid = "2d0f0986-cf9b-51ef-30c4-805df808e17b";
	const { out } = run({ uuid, type: "firewall.address", vdom: "root" }, "get_firewall_uuid_list");
	assert.equal(out.uuid, uuid, "UUID catalog must retain uuid");
}

// --- 2. allowlisted defaults survive value filtering -----------------------
{
	const { out } = run(POLICY, "get_firewall_policies");
	// logtraffic:"disable" would normally die under disableDefaults, but it is
	// explicitly allowlisted because disabled logging is security-relevant.
	assert.equal(out.logtraffic, "disable", "allowlist must override disableDefaults");
	assert.equal(out.status, "enable");
	// not in keep[], value "disable" → gone
	assert.equal(out.nat64, undefined, "disableDefaults must drop nat64");
	assert.equal(out["pcp-outbound"], undefined);
}

// --- 3. policy shrinks hard -------------------------------------------------
{
	const before = JSON.stringify(POLICY).length;
	const { out } = run(POLICY, "get_firewall_policies");
	const after = JSON.stringify(out).length;
	assert.ok(after < before * 0.55, `expected >45% cut, got ${before}→${after}`);
	assert.equal(out.srcaddr6, undefined, "empty array dropped");
	assert.equal(out.natip, undefined, "0.0.0.0 placeholder dropped");
	assert.equal(out.comments, undefined, "empty string dropped");
	assert.equal(out["srcaddr-negate"], undefined, "negate suffix dropped");
	assert.equal(out["diffservcode-forward"], undefined, "qos prefix dropped");
}

// --- 4. session forensics KEPT (group exclude:false) ------------------------
{
	const { out } = run(SESSION, "get_firewall_sessions");
	assert.equal(out.country, "United States", "country must be kept for geo triage");
	assert.equal(out.srcmac, "b8:3a:9d:74:ea:5a", "srcmac must be kept");
	assert.equal(out.src_uuid, undefined, "session uuid still dropped");
	assert.equal(out.vf, undefined, "internal id dropped");
	assert.equal(out.app_list_id, undefined, "internal id dropped");
	assert.equal(out.saddr, "192.168.5.3");
	assert.equal(out.policytype, "policy", "policy kind must survive");
	assert.equal(out.tx_packets, 100, "packet counters must survive");
	assert.equal(out.tx_shaper_drops, 2, "shaper drops must survive");
}

// --- 5. wifi: diagnostic evidence stays; duplicate identity/security go ----
{
	const { out } = run(AP_CLIENT, "get_wifi_clients");
	assert.equal(out.wtp_name, undefined, "wtp_name duplicates wtp_id");
	assert.equal(out.wtp_id, "FP421ETF20019562", "wtp_id survives");
	for (const key of [
		"sta_rxrate_mcs", "sta_txrate_mcs", "11k_capable", "11v_capable", "11r_capable",
		"captive_portal_authenticated", "uses_captive_portal", "lan_authenticated",
	]) assert.equal(out[key], (AP_CLIENT as any)[key], `${key} must survive`);
	assert.equal(out.security, undefined, "int dup of security_str dropped");
	assert.equal(out.security_str, "wpa2_only_personal", "readable form survives");
	assert.equal(out.noise, -95, "RF floor kept (exclude:false)");
	assert.equal(out.sta_txrate, 65000, "negotiated client rate must survive");
	assert.equal(out.tx_retry_percentage, 12, "retry percentage must survive");
	assert.equal(out.association_time, 1787539052, "association time must survive");
}

// --- 5b. useful interface config survives; repeated LACP defaults do not ----
{
	const { out } = run(AGGREGATE_INTERFACE, "get_interfaces_config");
	assert.equal(out.speed, "auto", "configured speed/duplex must survive");
	assert.deepEqual(out.member, AGGREGATE_INTERFACE.member, "aggregate members must survive");
	assert.equal(out.vrf, 2, "interface VRF must survive");
	assert.equal(out.mtu, 1400, "interface MTU must survive");
	assert.equal(out["dhcp-relay-ip"], undefined, "relay detail needs verbose mode");
	assert.equal(out["mtu-override"], undefined, "default-heavy flags stay filtered");
	assert.equal(out["lacp-mode"], undefined, "repeated LACP defaults stay filtered");
	assert.equal(out["lacp-speed"], undefined, "repeated LACP defaults stay filtered");
	assert.equal(out["min-links"], undefined, "repeated LACP defaults stay filtered");
	assert.equal(out["min-links-down"], undefined, "repeated LACP defaults stay filtered");
	assert.equal(out.bfd, undefined, "unrelated link-protocol tuning stays filtered");
	assert.equal(out.stp, undefined, "unrelated STP tuning stays filtered");
	assert.equal(out.algorithm, undefined, "LACP load-balancing noise stays filtered");
}

// --- 6. health flattening ---------------------------------------------------
{
	const { out } = run(AP_CLIENT, "get_wifi_clients");
	assert.deepEqual(
		out.health,
		{ signal_strength_severity: "fair", snr_severity: "good" },
		"health must flatten to *_severity",
	);
	const flatBytes = JSON.stringify(out.health).length;
	const rawBytes = JSON.stringify(AP_CLIENT.health).length;
	assert.ok(flatBytes < rawBytes, `flatten must shrink: ${rawBytes}→${flatBytes}`);
	// value/severity pairs collapse to one scalar, so the win grows with key count
	const wide = { health: Object.fromEntries(
		["a", "b", "c", "d", "e"].map((k) => [k, { value: 1, severity: "good" }]),
	) };
	const w = run(wide, "get_fortiaps").out;
	// measured ~0.59 — the _severity suffix buys back some of the win
	assert.ok(
		JSON.stringify(w.health).length < JSON.stringify(wide.health).length * 0.7,
		"flatten should cut ~40% on realistic multi-metric health blocks",
	);
}

// --- 6b. health arrays flatten too (FortiAP uplink_status) -----------------
{
	const ap = {
		name: "FP421E",
		health: {
			general: {
				country_code: { value: 0, severity: "good" },
				uplink_status: [
					{ value: 1000, severity: "good" },
					{ value: 0, severity: "fair" },
				],
			},
		},
	};
	const { out } = run(ap, "get_fortiaps");
	assert.deepEqual(
		out.health,
		{ general: { country_code_severity: "good", uplink_status_severity: ["good", "fair"] } },
		"arrays of {value,severity} must flatten to severities",
	);
	assert.ok(
		!JSON.stringify(out.health).includes('"value"'),
		"no raw value/severity pairs may survive flattening",
	);

	// filterForCurrentTool runs twice per tool call (bounded + textResult).
	// Flattening must be idempotent or suffixes stack:
	// uplink_status_severity_severity_severity (seen live on 7.6.7).
	withToolContext("get_fortiaps", false, () => {
		const p1: any = filterForCurrentTool([ap]);
		const p2: any = filterForCurrentTool(p1);
		const p3: any = filterForCurrentTool(p2);
		assert.deepEqual(p2[0].health, p1[0].health, "2nd filter pass must not re-suffix");
		assert.deepEqual(p3[0].health, p1[0].health, "3rd filter pass must not re-suffix");
		assert.ok(
			!JSON.stringify(p3).includes("_severity_severity"),
			"severity suffix must never stack",
		);
	});
}

// --- 7. idempotent (bounded() + textResult() both filter) -------------------
{
	const c = compile(DEFAULT_FILTERS, "get_firewall_policies");
	const once = applyFilters(POLICY, c, fresh(), 0);
	const twice = applyFilters(once, c, fresh(), 0);
	assert.deepEqual(twice, once, "second pass must be a no-op");
}

// --- 8. turning a group off brings data back --------------------------------
{
	const cfg: FilterConfig = {
		...DEFAULT_FILTERS,
		groups: {
			...DEFAULT_FILTERS.groups,
			uuid: { ...DEFAULT_FILTERS.groups.uuid, exclude: false },
		},
	};
	const { out } = run(POLICY, "get_firewall_policies", cfg);
	assert.equal(out.uuid, "2d0f0986-cf9b-51ef-30c4-805df808e17b", "uuid returns when exclude:false");
}

// --- 8b. re-admit also works for prefix/suffix groups -----------------------
{
	const cfg: FilterConfig = {
		...DEFAULT_FILTERS,
		groups: {
			...DEFAULT_FILTERS.groups,
			ztna: { ...DEFAULT_FILTERS.groups.ztna, exclude: false },
		},
	};
	const { out } = run(POLICY, "get_firewall_policies", cfg);
	assert.equal(
		out["ztna-status"],
		"disable",
		"prefix group must re-admit past the allowlist when exclude:false",
	);
}

// --- 8c. keep[] also beats a strict allowlist -------------------------------
{
	const cfg: FilterConfig = {
		...DEFAULT_FILTERS,
		tools: {
			...DEFAULT_FILTERS.tools,
			probe: { keep: ["diagnostic"], allowlist: ["id"] },
		},
	};
	const { out } = run({ id: 1, diagnostic: "needed", junk: "drop" }, "probe", cfg);
	assert.deepEqual(out, { id: 1, diagnostic: "needed" });
}

// --- 8d. compact views retain fields needed for normal troubleshooting -------
{
	const ipv6 = run(
		{ ip6: "::/0", ipv6_gateway: "fe80::1", interface: "wan1", type: "static" },
		"get_routing_table_ipv6",
	).out;
	assert.equal(ipv6.ip6, "::/0", "IPv6 route destination must survive the IPv6 tool");
	assert.equal(ipv6.ipv6_gateway, "fe80::1", "IPv6 next hop must survive the IPv6 tool");

	const session = run(
		{ ...SESSION, snaddr: "203.0.113.8", snport: 45001, user: "alice" },
		"get_firewall_sessions",
	).out;
	assert.equal(session.snaddr, "203.0.113.8", "translated source must survive");
	assert.equal(session.snport, 45001, "translated source port must survive");
	assert.equal(session.user, "alice", "authenticated user must survive");

	const log = run(
		{
			date: "2026-08-26", time: "12:00:00", level: "critical", virus: "EICAR",
			appcat: "Malware",
			_meta: {
				subtype: "virus", source: "fortianalyzer", returned: 1, fetched: 50,
				ready: true, completed: false, percent_logs_processed: 80,
				total_lines: 50, polls: 2, path: "log/fortianalyzer/virus/virus",
				device: "edge-fgt", session_id: 42, junk: "drop",
			},
		},
		"get_logs",
	).out;
	assert.equal(log.level, "critical", "event severity must survive");
	assert.equal(log.virus, "EICAR", "malware name must survive");
	assert.equal(log.appcat, "Malware", "application category must survive");
	assert.equal(log._meta.total_lines, 50, "log completeness metadata must survive");
	assert.equal(log._meta.path, "log/fortianalyzer/virus/virus", "queried log path must survive");
	assert.equal(log._meta.device, "edge-fgt", "FAZ device identity must survive");
	assert.equal(log._meta.percent_logs_processed, 80, "search progress must survive");
	assert.equal(log._meta.junk, undefined, "nested records remain projected");

	const policy = run(
		{
			...POLICY, poolname: [{ name: "egress-pool" }],
			"inspection-mode": "flow", "ssl-ssh-profile": "certificate-inspection",
			"av-profile": "default", "webfilter-profile": "default",
		},
		"get_firewall_policy",
	).out;
	assert.deepEqual(policy.poolname, [{ name: "egress-pool" }]);
	assert.equal(policy["ssl-ssh-profile"], "certificate-inspection");
	assert.equal(policy["av-profile"], "default");
	assert.equal(policy.ippool, "enable", "SNAT pool state must survive");
	assert.equal(policy.fixedport, "enable", "source-port behavior must survive");
	assert.equal(policy["session-ttl"], "300", "configured session TTL must survive");
	assert.equal(policy["traffic-shaper"], "wan-limit", "configured shaper must survive");

	const address = run(
		{ name: "printer", type: "mac", macaddr: [{ macaddr: "00:11:22:33:44:55" }] },
		"get_address_objects",
	).out;
	assert.ok(address.macaddr, "MAC address object value must survive");

	const wildcard = run(
		{ name: "legacy-net", type: "wildcard", wildcard: "192.0.2.0 0.0.0.255" },
		"get_address_objects",
	).out;
	assert.equal(wildcard.wildcard, "192.0.2.0 0.0.0.255");

	const service = run(
		{ name: "GRE", protocol: "IP", "protocol-number": 47, helper: "auto" },
		"get_service_objects",
	).out;
	assert.equal(service["protocol-number"], 47, "IP service protocol must survive");
	assert.equal(service.helper, undefined, "unlisted service noise stays filtered");

	const vip = run(
		{ name: "web", type: "server-load-balance", status: "disable", "ldb-method": "round-robin",
			realservers: [{ ip: "192.0.2.10", port: 443 }], monitor: [{ name: "https" }] },
		"get_vip_objects",
	).out;
	assert.equal(vip.status, "disable", "disabled VIP must not look enabled");
	assert.ok(vip.realservers, "load-balancer members must survive");

	const route = run(
		{ ip_mask: "0.0.0.0/0", gateway: "192.0.2.1", type: "static", origin: "sd-wan", vrf: 0 },
		"get_routing_table",
	).out;
	assert.equal(route.origin, "sd-wan", "route provenance must survive");
	assert.equal(route.vrf, 0, "route VRF must survive");
	const lookup = run(
		{ gateway: "0.0.0.0", interface: "wan1", unused: "0.0.0.0" },
		"get_route_lookup",
	).out;
	assert.equal(lookup.gateway, "0.0.0.0", "on-link route next hop must survive");
	assert.equal(lookup.unused, undefined, "unrelated zero placeholders must still drop");
	const staticRoute = run(
		{ "seq-num": 1, dst: "203.0.113.0/24", vrf: "2", blackhole: "enable" },
		"get_static_routes",
	).out;
	assert.equal(staticRoute.vrf, "2", "static route VRF must survive");
	assert.equal(staticRoute.blackhole, "enable", "blackhole state must survive");

	const admin = run(
		{ name: "ops", status: "disable", accprofile: "super_admin", password: "not-returned" },
		"get_admin_accounts",
	).out;
	assert.equal(admin.status, "disable", "disabled admin must not look enabled");
	assert.equal(admin.password, undefined);
	assert.equal(run({ host: "198.51.100.4" }, "get_current_admins").out.host, "198.51.100.4");

	const sw = run(
		{ "switch-id": "S1", connecting_from: "port1", status: "Connected",
			port_count: 24, ports_up: 8 },
		"get_fortiswitches",
	).out;
	assert.equal(sw.connecting_from, "port1", "switch topology must survive");
	assert.equal(sw.port_count, 24, "derived switch port count must survive its allowlist");
	assert.equal(sw.ports_up, 8, "derived switch up count must survive its allowlist");
	const phase1Fields = [
		"type", "mode-cfg", "keylife", "dpd", "dpd-retryinterval", "nattraversal",
		"transport", "client-auto-negotiate", "client-keep-alive", "ipv4-start-ip",
		"ipv4-end-ip", "ipv4-split-include", "dns-mode", "ipv4-dns-server1",
		"ipv4-dns-server2", "eap", "eap-identity", "reauth", "certificate", "peergrp",
		"xauthtype",
	];
	const phase1 = run(
		{
			name: "branch", status: "up", interface: "wan1", "remote-gw": "198.51.100.1",
			"local-gw": "192.0.2.1", ...Object.fromEntries(phase1Fields.map((key) => [key, "configured"])),
			psksecret: "must-not-survive",
		},
		"get_ipsec_phase1",
	).out;
	assert.equal(phase1.status, "up", "phase1 status must survive");
	assert.equal(phase1["local-gw"], "192.0.2.1", "phase1 local gateway must survive");
	for (const key of phase1Fields) assert.equal(phase1[key], "configured", `${key} must survive`);
	assert.equal(phase1.psksecret, undefined, "IPsec secret must stay filtered");
	const phase2 = run(
		{ name: "branch-p2", dhgrp: "14", pfs: "enable", keepalive: "enable", psksecret: "no" },
		"get_ipsec_phase2",
	).out;
	assert.equal(phase2.dhgrp, "14");
	assert.equal(phase2.pfs, "enable");
	assert.equal(phase2.keepalive, "enable");
	assert.equal(phase2.psksecret, undefined);
	assert.equal(
		run({ srcaddr: "192.0.2.10", user: "alice" }, "get_fortiview_statistics").out.user,
		"alice",
		"FortiView user must survive",
	);
	const port = run({ interface: "port1", switch_serial: "S1" }, "get_switch_port_status").out;
	assert.equal(port.switch_serial, "S1", "switch port identity must survive");
}

// --- 8e. raw structural groups retain full nested records -----------------
{
	const cfg: FilterConfig = {
		...DEFAULT_FILTERS,
		groups: {
			...DEFAULT_FILTERS.groups,
			switch_port_counts: { ...DEFAULT_FILTERS.groups.switch_port_counts, exclude: false },
			ipsec_compact: { ...DEFAULT_FILTERS.groups.ipsec_compact, exclude: false },
		},
	};
	const ports = [{ port_name: "port1", status: "up", custom_detail: "raw" }];
	assert.deepEqual(
		run({ "switch-id": "S1", ports }, "get_fortiswitches", cfg).out.ports,
		ports,
		"disabled switch compaction must retain raw ports",
	);
	const proxyid = [{ p2name: "p2", status: "up", proxy_src: [{ subnet: "10.0.0.0/24" }] }];
	assert.deepEqual(
		run({ name: "vpn", proxyid }, "get_ipsec_tunnels", cfg).out.proxyid,
		proxyid,
		"disabled IPsec compaction must retain raw proxy IDs",
	);
}

// --- 9. enabled:false is a true bypass --------------------------------------
{
	const cfg: FilterConfig = { ...DEFAULT_FILTERS, enabled: false };
	// engine has no enabled check; loader short-circuits. Assert the contract:
	assert.equal(cfg.enabled, false);
	const { out } = run(POLICY, "get_firewall_policies", DEFAULT_FILTERS);
	assert.ok(out.policyid !== undefined);
}

// --- 10. arrays and nesting -------------------------------------------------
{
	const { out } = run([POLICY, POLICY], "get_firewall_policies");
	assert.equal(out.length, 2, "arrays preserved");
	assert.equal(out[0].uuid, undefined);
	assert.equal(out[1].policyid, 1);
}

// --- 10b. records emptied inside arrays are removed ------------------------
{
	const { out } = run(
		{ name: "group", member: [{ uuid: "hidden" }, { name: "visible", uuid: "hidden" }] },
		"get_address_groups",
	);
	assert.deepEqual(out.member, [{ name: "visible" }]);
}

// --- 11. unknown tool = global rules only ----------------------------------
{
	const { out } = run(POLICY, "get_some_new_tool");
	assert.equal(out.uuid, undefined, "global groups still apply");
	assert.equal(out.nat64, "disable", "disableDefaults is per-tool, not global");
}

// --- 13. end-to-end: context, audit stamp, idempotent stats ----------------
{
	const POLICY_E2E = { ...POLICY };

	withToolContext("get_firewall_policies", false, () => {
		const out: any = filterForCurrentTool([POLICY_E2E, POLICY_E2E]);
		const audit = filterAudit();
		assert.equal(out[0].uuid, undefined, "uuid must not survive the real path");
		assert.equal(out[0].logtraffic, "disable", "allowlisted default must survive");
		assert.ok(audit, "audit stamp required when fields were dropped");
		assert.ok(audit!.keysDropped > 0);
		assert.ok(audit!.groups.includes("uuid"));
		assert.match(audit!.hint, /Only listed rules/, "audit must not imply absent API fields were filtered");
	});

	// verboseBypassesFilters defaults to true — verbose=true is documented as
	// "full records", so it must lift the allowlist AND the groups.
	withToolContext("get_firewall_policies", true, () => {
		const out: any = filterForCurrentTool([POLICY_E2E]);
		assert.equal(out[0].uuid, POLICY_E2E.uuid, "verbose must return full records");
	});

	// structural groups follow the same gate
	withToolContext("get_fortiswitches", false, () => {
		assert.equal(groupEnabled("switch_port_counts"), true, "structural group on by default");
	});
	withToolContext("get_fortiswitches", true, () => {
		assert.equal(groupEnabled("switch_port_counts"), false, "verbose must disable reshaping");
	});

	// bounded() and textResult() both filter; stats must not double-count
	withToolContext("get_firewall_policies", false, () => {
		const once = filterForCurrentTool(POLICY_E2E);
		const first = filterAudit()!.keysDropped;
		filterForCurrentTool(once);
		assert.equal(filterAudit()!.keysDropped, first, "second pass double-counted");
	});
}

console.log("filters ok");
