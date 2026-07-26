import { readFileSync } from "node:fs";
import { applyFilters, compile } from "../src/filters/engine.ts";
import { DEFAULT_FILTERS } from "../src/filters/defaults.ts";

const env = Object.fromEntries(
  readFileSync(process.env.HOME + "/.pi/agent/fortigate.env", "utf8")
    .split("\n").filter(l => l.includes("=") && !l.startsWith("#"))
    .map(l => { const i = l.indexOf("="); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,"")]; })
);
const cfg = JSON.parse(readFileSync(process.env.HOME + "/.pi/agent/fortigate.json", "utf8"));
const [devName, dev]: any = Object.entries(cfg.devices)[0];
const token = env[dev.tokenEnv];

async function get(path: string, q = "") {
  const url = `${dev.url}/api/v2/${path}?vdom=${dev.vdom||"root"}${q}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, tls: { rejectUnauthorized: false } } as any);
  return r.json();
}
const bytes = (o:any)=>JSON.stringify(o).length;
const stats = ()=>({keysDropped:0,groups:new Set<string>()});

const cases: Array<[string,string,string]> = [
  ["get_firewall_policies", "cmdb/firewall/policy", ""],
  ["get_interfaces_config", "cmdb/system/interface", ""],
  ["get_firewall_sessions", "monitor/firewall/session", "&count=20&summary=true"],
  ["get_dhcp_leases",       "monitor/system/dhcp", ""],
  ["get_routing_table",     "monitor/router/ipv4", "&count=50"],
  ["get_fortiaps",          "monitor/wifi/managed_ap", ""],
  ["get_wifi_clients",      "monitor/wifi/client", ""],
  ["get_address_objects",   "cmdb/firewall/address", ""],
];

console.log(`device ${devName}\n`);
console.log("tool".padEnd(24), "raw".padStart(9), "filtered".padStart(9), "cut".padStart(7), " groups");
let tr=0, tf=0;
for (const [tool, path, q] of cases) {
  try {
    const raw = (await get(path, q)).results ?? {};
    const st = stats();
    const out = applyFilters(raw, compile(DEFAULT_FILTERS, tool), st, 0);
    const a=bytes(raw), b=bytes(out); tr+=a; tf+=b;
    console.log(tool.padEnd(24), String(a).padStart(9), String(b).padStart(9),
      `${(100-100*b/a).toFixed(0)}%`.padStart(7), " " + [...st.groups].slice(0,4).join(","));
  } catch(e:any) { console.log(tool.padEnd(24), "ERR", e.message); }
}
console.log("\nTOTAL".padEnd(24), String(tr).padStart(9), String(tf).padStart(9), `${(100-100*tf/tr).toFixed(0)}%`.padStart(7));
