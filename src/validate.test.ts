/**
 * validatePath namespace-guard self-check. Run: npm run test:validate
 * Regression: monitor/ paths were silently stripped and queried under cmdb/,
 * yielding FortiOS 400 "no such cmdb table" (see get_config_object bug).
 * Assert-based, no test framework.
 */

import assert from "node:assert/strict";
import { buildQueryString } from "./filters/query.js";
import { buildCmdbNameFilter } from "./tools/firewall.js";
import { buildLogFilter } from "./tools/logs.js";
import { joinPolicyNames, zeroOnlyHits } from "./tools/network.js";
import { matchesLinkState } from "./tools/system.js";
import { poorOnlyClients } from "./tools/wireless.js";
import { validatePath } from "./validate.js";

// namespace stripped when it matches the calling tool
assert.equal(validatePath("cmdb/firewall/policy", "path", "cmdb"), "firewall/policy");
assert.equal(validatePath("monitor/wifi/managed_ap", "path", "monitor"), "wifi/managed_ap");

// bare paths pass through under either expectation
assert.equal(validatePath("firewall/policy", "path", "cmdb"), "firewall/policy");
assert.equal(validatePath("wifi/managed_ap", "path", "monitor"), "wifi/managed_ap");

// THE BUG: mismatched namespace must throw, not silently query the wrong one
assert.throws(
	() => validatePath("monitor/wifi/managed_ap", "path", "cmdb"),
	/get_monitor_resource/,
	"monitor path on cmdb tool must redirect",
);
assert.throws(
	() => validatePath("cmdb/firewall/policy", "path", "monitor"),
	/get_config_object/,
	"cmdb path on monitor tool must redirect",
);

// full URL / api/v2 prefixes still stripped, and namespace behind them still honoured
assert.equal(
	validatePath("https://fw.example.com/api/v2/monitor/wifi/client", "path", "monitor"),
	"wifi/client",
);
assert.throws(
	() => validatePath("api/v2/monitor/wifi/client", "path", "cmdb"),
	/get_monitor_resource/,
);

// no expectation given => permissive (back-compat for other callers)
assert.equal(validatePath("monitor/wifi/client"), "wifi/client");

// existing guards intact
assert.throws(() => validatePath("", "path"), /required/);
assert.throws(() => validatePath("firewall/../etc", "path"), /\.\./);
assert.throws(() => validatePath("firewall/policy?x=1", "path"), /query string/);

// Query arrays become repeated filter= keys; caller cannot override pinned VDOM.
const query = new URLSearchParams(buildQueryString({
	vdom: "other",
	filter: ["action==deny", "srcip==192.0.2.1"],
	rows: 25,
	missing: undefined,
}, "root"));
assert.equal(query.get("vdom"), "root");
assert.deepEqual(query.getAll("filter"), ["action==deny", "srcip==192.0.2.1"]);
assert.equal(query.get("rows"), "25");

assert.deepEqual(
	buildLogFilter({ action: "deny", srcip: "192.0.2", policyid: "15" }),
	["action==deny", "srcip=@192.0.2", "policyid==15"],
);
assert.deepEqual(buildLogFilter({}), []);
assert.throws(() => buildLogFilter({ action: "deny or action==accept" }), /invalid filter/i);
assert.throws(() => buildLogFilter({ srcip: "192.0.2.1&rows=50" }), /invalid filter/i);
assert.throws(() => buildLogFilter({ policyid: "1 OR 2" }), /invalid filter/i);
assert.equal(buildCmdbNameFilter("edge"), "name=@edge");
assert.equal(buildCmdbNameFilter(""), undefined);
assert.throws(() => buildCmdbNameFilter("edge==other"), /invalid characters/i);

assert.equal(zeroOnlyHits([{ policyid: 1, hit_count: 0, active_sessions: 0 }]).length, 1);
assert.equal(zeroOnlyHits([{ policyid: 0, hit_count: 0, active_sessions: 0 }]).length, 0);
assert.equal(zeroOnlyHits([{ policyid: 1, hit_count: 1, active_sessions: 0 }]).length, 0);
assert.deepEqual(
	joinPolicyNames([{ policyid: 1, hit_count: 0 }], [{ policyid: 1, name: "Allow", comments: "test" }]),
	[{ policyid: 1, hit_count: 0, name: "Allow", comments: "test" }],
);
assert.equal(poorOnlyClients([{ signal: -75, health: {} }]).length, 1);
assert.equal(poorOnlyClients([{ signal: -40, health: { band: { severity: "fair" } } }]).length, 1);
assert.equal(poorOnlyClients([{ signal: -40, health: { signal: { severity: "good" } } }]).length, 0);
assert.equal(poorOnlyClients([{ signal: -40 }]).length, 1);
assert.equal(matchesLinkState({ link: true }, "up"), true);
assert.equal(matchesLinkState({ link: "down" }, "down"), true);
assert.equal(matchesLinkState({}, "down"), false);

console.log("validate ok");
