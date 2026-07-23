/** Firewall policy & objects (11). Full parity with upstream. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded, project } from "../bounds.js";
import { validateName } from "../validate.js";
import {
	POLICY_KEEP,
	ADDRESS_KEEP,
	ADDRGRP_KEEP,
	SERVICE_KEEP,
	VIP_KEEP,
	ROUTE_KEEP,
} from "../types.js";

const IFACE_KEEP = new Set([
	"name",
	"ip",
	"type",
	"vdom",
	"mode",
	"role",
	"status",
	"allowaccess",
	"alias",
	"description",
	"interface",
	"vlanid",
]);

const verboseParam = Type.Optional(
	Type.Boolean({ description: "Return full records (default: projected fields only)" }),
);

const nameFilterParam = Type.Optional(
	Type.String({ description: "Substring filter on object name (case-insensitive)" }),
);

async function cmdbList(
	path: string,
	params: { device?: string; verbose?: boolean; name?: string },
	signal: AbortSignal,
	keep: Set<string> | null,
	hint: string,
) {
	const { name, device: dev } = resolveDevice(params.device);
	const token = getToken(dev);
	let data = fortiResults(await fortiGet(path, dev, token, {}, signal));
	const nameQ = String(params.name || "").trim().toLowerCase();
	if (nameQ && Array.isArray(data)) {
		data = data.filter((row: any) => String(row?.name || "").toLowerCase().includes(nameQ));
	}
	if (keep) data = project(data, keep, !!params.verbose);
	data = bounded(data, hint, getMaxResponseBytes());
	return textResult(data, { device: name, path });
}

export function registerFirewallTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "get_firewall_policies",
		label: "FortiGate: Firewall Policies",
		description:
			"IPv4 firewall policy table (cmdb/firewall/policy). Projected by default; name= filters by policy name; verbose=true for full records.",
		promptSnippet: "FortiGate firewall policies",
		parameters: Type.Object({ ...deviceParam, name: nameFilterParam, verbose: verboseParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/firewall/policy",
				params,
				signal,
				POLICY_KEEP,
				"Filter with name=, set verbose=true for full fields, or get_firewall_policy(policy_id).",
			);
		},
	});

	pi.registerTool({
		name: "get_firewall_policy",
		label: "FortiGate: Firewall Policy",
		description: "Single firewall policy by policyid (cmdb/firewall/policy/<id>).",
		promptSnippet: "FortiGate single policy",
		parameters: Type.Object({
			...deviceParam,
			policy_id: Type.String({ description: "Numeric policyid" }),
			verbose: verboseParam,
		}),
		async execute(_id, params, signal) {
			const pid = validateName(params.policy_id, "policy_id");
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data: any = fortiResults(
				await fortiGet(`cmdb/firewall/policy/${pid}`, dev, token, {}, signal),
			);
			// FortiOS often returns a 1-element array for /policy/<id>
			if (Array.isArray(data)) data = data[0] ?? {};
			if (!params.verbose && data && typeof data === "object") {
				const out: Record<string, unknown> = {};
				for (const k of POLICY_KEEP) {
					if (k in data) out[k] = data[k];
				}
				data = out;
			}
			data = bounded(
				data,
				"Use verbose=true only if you need every field.",
				getMaxResponseBytes(),
			);
			return textResult(data, { device: name, path: `cmdb/firewall/policy/${pid}` });
		},
	});

	pi.registerTool({
		name: "get_address_objects",
		label: "FortiGate: Address Objects",
		description:
			"IPv4 address objects (cmdb/firewall/address). Use name= — catalogs are often hundreds of objects.",
		promptSnippet: "FortiGate address objects",
		parameters: Type.Object({ ...deviceParam, name: nameFilterParam, verbose: verboseParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/firewall/address",
				params,
				signal,
				ADDRESS_KEEP,
				"Filter with name=; set verbose=true for full fields.",
			);
		},
	});

	pi.registerTool({
		name: "get_address_groups",
		label: "FortiGate: Address Groups",
		description: "Address groups (cmdb/firewall/addrgrp). Optional name= filter.",
		promptSnippet: "FortiGate address groups",
		parameters: Type.Object({ ...deviceParam, name: nameFilterParam, verbose: verboseParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/firewall/addrgrp",
				params,
				signal,
				ADDRGRP_KEEP,
				"Filter with name=; set verbose=true for full fields.",
			);
		},
	});

	pi.registerTool({
		name: "get_service_objects",
		label: "FortiGate: Service Objects",
		description: "Custom services (cmdb/firewall.service/custom). Optional name= filter.",
		promptSnippet: "FortiGate service objects",
		parameters: Type.Object({ ...deviceParam, name: nameFilterParam, verbose: verboseParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/firewall.service/custom",
				params,
				signal,
				SERVICE_KEEP,
				"Filter with name=; set verbose=true for full fields.",
			);
		},
	});

	pi.registerTool({
		name: "get_service_groups",
		label: "FortiGate: Service Groups",
		description: "Service groups (cmdb/firewall.service/group).",
		promptSnippet: "FortiGate service groups",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/firewall.service/group",
				params,
				signal,
				null,
				"Large service catalogs: query individual members if truncated.",
			);
		},
	});

	pi.registerTool({
		name: "get_vip_objects",
		label: "FortiGate: VIP Objects",
		description: "Virtual IPs / DNAT (cmdb/firewall/vip). Optional name= filter.",
		promptSnippet: "FortiGate VIPs",
		parameters: Type.Object({ ...deviceParam, name: nameFilterParam, verbose: verboseParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/firewall/vip",
				params,
				signal,
				VIP_KEEP,
				"Set verbose=True for full fields.",
			);
		},
	});

	pi.registerTool({
		name: "get_ippools",
		label: "FortiGate: IP Pools",
		description: "IP pools / SNAT (cmdb/firewall/ippool).",
		promptSnippet: "FortiGate IP pools",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/firewall/ippool",
				params,
				signal,
				null,
				"If truncated, query a single pool with get_config_object('firewall/ippool/<name>').",
			);
		},
	});

	pi.registerTool({
		name: "get_static_routes",
		label: "FortiGate: Static Routes",
		description: "Configured IPv4 static routes (cmdb/router/static).",
		promptSnippet: "FortiGate static routes",
		parameters: Type.Object({ ...deviceParam, verbose: verboseParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/router/static",
				params,
				signal,
				ROUTE_KEEP,
				"Set verbose=True for full fields, or use get_routing_table for the active RIB.",
			);
		},
	});

	pi.registerTool({
		name: "get_interfaces_config",
		label: "FortiGate: Interfaces Config",
		description: "Interface config (cmdb/system/interface).",
		promptSnippet: "FortiGate interface config",
		parameters: Type.Object({ ...deviceParam, verbose: verboseParam }),
		async execute(_id, params, signal) {
			return cmdbList(
				"cmdb/system/interface",
				params,
				signal,
				IFACE_KEEP,
				"Set verbose=True for full fields, or get_config_object('system/interface/<name>').",
			);
		},
	});

	pi.registerTool({
		name: "get_zones",
		label: "FortiGate: Zones",
		description: "Interface zones (cmdb/system/zone).",
		promptSnippet: "FortiGate zones",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			return cmdbList("cmdb/system/zone", params, signal, null, "Zone list truncated; narrow query.");
		},
	});
}
