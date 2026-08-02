/**
 * validatePath namespace-guard self-check. Run: npm run test:validate
 * Regression: monitor/ paths were silently stripped and queried under cmdb/,
 * yielding FortiOS 400 "no such cmdb table" (see get_config_object bug).
 * ponytail: assert-based, no framework.
 */

import assert from "node:assert/strict";
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

console.log("validate ok");
