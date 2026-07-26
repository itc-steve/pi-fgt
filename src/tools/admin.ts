/** Administration tools (3). Full parity + device list. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes, listDevices } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";

export function registerAdminTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "list_fortigate_devices",
		label: "FortiGate: List Devices",
		description:
			"List configured FortiGate device keys (names only, no secrets). " +
			"Use when unsure of the device= argument. Prefer this over reading fortigate.json.",
		promptSnippet: "List FortiGate device names",
		parameters: Type.Object({}),
		async execute() {
			return textResult(listDevices(), { path: "config/devices" });
		},
	});

	pi.registerTool({
		name: "get_admin_accounts",
		label: "FortiGate: Admin Accounts",
		description:
			"Administrator accounts (cmdb/system/admin). Password hashes not returned. Projected unless verbose.",
		promptSnippet: "FortiGate admin accounts",
		parameters: Type.Object({
			...deviceParam,
			verbose: Type.Optional(Type.Boolean({ description: "Full admin records" })),
		}),
		async execute(_id, params, signal) {
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data = fortiResults(await fortiGet("cmdb/system/admin", dev, token, {}, signal));
			data = bounded(data, "Set verbose=True for full fields.", getMaxResponseBytes());
			return textResult(data, { device: name });
		},
	});

	pi.registerTool({
		name: "get_admin_profiles",
		label: "FortiGate: Admin Profiles",
		description: "Access profiles / roles (cmdb/system/accprofile).",
		promptSnippet: "FortiGate admin profiles",
		parameters: Type.Object({ ...deviceParam }),
		async execute(_id, params, signal) {
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data = fortiResults(await fortiGet("cmdb/system/accprofile", dev, token, {}, signal));
			data = bounded(data, "Admin profile list truncated.", getMaxResponseBytes());
			return textResult(data, { device: name });
		},
	});
}
