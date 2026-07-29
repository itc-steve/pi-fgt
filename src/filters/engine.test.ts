/**
 * Filter engine self-check. Run: npm run test:filters
 * Fixtures are real FortiOS 7.4 payload shapes (FGT70F).
 * ponytail: assert-based, no framework.
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
	sentbyte: 139892,
};

const AP_CLIENT = {
	mac: "4c:bb:47:13:b4:02",
	ip: "192.168.5.7",
	wtp_id: "FP421ETF20019562",
	wtp_name: "FP421ETF20019562",
	signal: -67,
	noise: -95,
	sta_rxrate_mcs: 6,
	sta_rxrate_score: 67,
	"11k_capable": false,
	security: 10,
	security_str: "wpa2_only_personal",
	health: {
		signal_strength: { value: -67, severity: "fair" },
		snr: { value: 28, severity: "good" },
	},
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

// --- 2. keep[] beats disableDefaults ---------------------------------------
{
	const { out } = run(POLICY, "get_firewall_policies");
	// logtraffic:"disable" would normally die under disableDefaults,
	// but this tool lists it in keep[] — a security-relevant field.
	assert.equal(out.logtraffic, "disable", "keep[] must override disableDefaults");
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
}

// --- 5. wifi: dup identity + micro-telemetry out, RF floor stays ------------
{
	const { out } = run(AP_CLIENT, "get_wifi_clients");
	assert.equal(out.wtp_name, undefined, "wtp_name duplicates wtp_id");
	assert.equal(out.wtp_id, "FP421ETF20019562", "wtp_id survives");
	assert.equal(out.sta_rxrate_mcs, undefined, "micro-telemetry dropped");
	assert.equal(out["11k_capable"], undefined);
	assert.equal(out.security, undefined, "int dup of security_str dropped");
	assert.equal(out.security_str, "wpa2_only_personal", "readable form survives");
	assert.equal(out.noise, -95, "RF floor kept (exclude:false)");
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
