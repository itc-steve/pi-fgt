import assert from "node:assert/strict";
import { buildLocalInPayload, proxySessionCount } from "./firewall_monitor.js";

const configured = [
  {
    policyid: 1,
    intf: [{ name: "virtual-wan-link" }],
    srcaddr: [{ name: "ITC_Trusted_Whitelist" }],
    action: "accept",
    service: [{ name: "ALL" }],
  },
];
const monitor = {
  implicit: [{ action: "drop" }],
  admin: [{ action: "accept" }],
  custom: [{ from_zone: ["wan1", "wan2"], action: "accept" }],
};

const compact = buildLocalInPayload(configured, monitor, false) as any;
assert.deepEqual(compact.custom, configured, "custom must use authoritative configured policies");
assert.deepEqual(compact.implicit, monitor.implicit);
assert.deepEqual(compact.admin, monitor.admin);
assert.equal(compact.compiled_custom, undefined, "compiled view is verbose-only");

const verbose = buildLocalInPayload(configured, monitor, true) as any;
assert.deepEqual(verbose.compiled_custom, monitor.custom);

const fallback = buildLocalInPayload(undefined, monitor, true) as any;
assert.deepEqual(fallback.custom, monitor.custom, "monitor custom must survive when CMDB is unavailable");
assert.equal(fallback.compiled_custom, undefined);
assert.match(fallback._hint, /CMDB local-in config was unavailable/);

assert.equal(proxySessionCount(undefined), 20);
assert.equal(proxySessionCount(5), 20);
assert.equal(proxySessionCount(20), 20);
assert.equal(proxySessionCount(250), 250);
assert.equal(proxySessionCount(5000), 1000);

console.log("local-in payload ok");
