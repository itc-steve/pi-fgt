/** Security / UTM profiles (1). Full parity. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet, fortiResults } from "../client.js";
import { bounded } from "../bounds.js";
import { ALLOWED_PROFILE_TYPES } from "../types.js";

export function registerSecurityTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "get_security_profiles",
		label: "FortiGate: Security Profiles",
		description:
			"UTM profiles by type (antivirus, ips, webfilter, application, dnsfilter, ssl-ssh, file-filter, emailfilter). " +
			"Name/comment only unless verbose=true.",
		promptSnippet: "FortiGate UTM security profiles",
		parameters: Type.Object({
			...deviceParam,
			profile_type: Type.String({
				description:
					"One of: antivirus, ips, webfilter, application, dnsfilter, ssl-ssh, file-filter, emailfilter",
			}),
			verbose: Type.Optional(Type.Boolean({ description: "Full profile bodies" })),
		}),
		async execute(_id, params, signal) {
			const pt = String(params.profile_type || "")
				.trim()
				.toLowerCase();
			if (!(pt in ALLOWED_PROFILE_TYPES)) {
				return textResult({
					error: `profile_type must be one of: ${Object.keys(ALLOWED_PROFILE_TYPES).sort().join(", ")}`,
				});
			}
			const table = ALLOWED_PROFILE_TYPES[pt];
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			let data = fortiResults(await fortiGet(`cmdb/${table}`, dev, token, {}, signal));
			if (!params.verbose && Array.isArray(data)) {
				data = data
					.filter((item: unknown) => item && typeof item === "object")
					.map((item: Record<string, unknown>) => {
						const out: Record<string, unknown> = {};
						if ("name" in item) out.name = item.name;
						if ("comment" in item) out.comment = item.comment;
						return out;
					});
			}
			data = bounded(
				data,
				"Set verbose=True for full profile bodies (these can be very large).",
				getMaxResponseBytes(),
			);
			return textResult(data, { device: name, profile_type: pt });
		},
	});
}
