/** Log query tool — memory / disk / FortiAnalyzer / FortiCloud via FortiGate API. */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { deviceParam, textResult } from "./helpers.js";
import { resolveDevice, getToken, getMaxResponseBytes } from "../config.js";
import { fortiGet } from "../client.js";
import { bounded } from "../bounds.js";
import { clampPerPage, validateName } from "../validate.js";
import { ALLOWED_LOG_SOURCES, ALLOWED_LOG_TYPES } from "../types.js";

/** Default subtype when caller omits it (FortiOS path needs both segments). */
const DEFAULT_SUBTYPE: Record<string, string> = {
	traffic: "forward",
	event: "system",
	virus: "virus",
	webfilter: "webfilter",
	ips: "ips",
	anomaly: "anomaly",
	"app-ctrl": "app-ctrl",
	dlp: "dlp",
	emailfilter: "emailfilter",
	utm: "webfilter",
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
			return;
		}
		const t = setTimeout(resolve, ms);
		const onAbort = () => {
			clearTimeout(t);
			reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
		};
		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

/**
 * FortiOS log path is log/<source>/<type>/<subtype>.
 * Type is NOT a parent of UTM children: virus/webfilter/ips/app-ctrl are top-level types.
 * Common agent mistake: log_type=utm subtype=virus → must become virus/virus.
 */
function resolveLogSegments(
	logType: string,
	subtype: string | undefined,
): { type: string; subtype: string; note?: string } {
	const lt = logType.trim().toLowerCase();
	const stRaw =
		subtype != null && String(subtype).trim() !== "" ? String(subtype).trim().toLowerCase() : "";

	if (lt === "utm") {
		const promoted = stRaw && stRaw !== "utm" && stRaw !== "system" ? stRaw : "";
		if (
			promoted &&
			ALLOWED_LOG_TYPES.has(promoted) &&
			promoted !== "utm" &&
			promoted !== "event" &&
			promoted !== "traffic"
		) {
			return {
				type: promoted,
				subtype: DEFAULT_SUBTYPE[promoted] || promoted,
				note: `Mapped log_type=utm subtype=${promoted} → ${promoted}/${DEFAULT_SUBTYPE[promoted] || promoted}`,
			};
		}
		return {
			type: "webfilter",
			subtype: "webfilter",
			note: "log_type=utm is not a FortiOS path; defaulted to webfilter/webfilter. Use virus|webfilter|ips|app-ctrl|traffic|event.",
		};
	}

	const st = stRaw || DEFAULT_SUBTYPE[lt] || lt;
	return { type: lt, subtype: st };
}

// Field selection is config-driven (filters tools.get_logs.allowlist).
// Kept as a pass-through so callers and the signature stay untouched.
function projectLogRow(row: any, _verbose: boolean): any {
	return row;
}

/**
 * FortiOS log search is often async (esp. FortiAnalyzer):
 * first GET returns ready=false + session_id + empty results;
 * re-query with session_id until ready=true (or timeout).
 */
async function fetchLogRows(
	path: string,
	dev: any,
	token: string,
	rows: number,
	signal?: AbortSignal,
): Promise<{
	entries: any[];
	meta: Record<string, unknown>;
}> {
	let raw: any = await fortiGet(path, dev, token, { rows, start: 0 }, signal);
	let polls = 0;
	const maxPolls = 20; // ~10s at 500ms — FAZ usually ready on poll 1
	// FortiOS uses 0xFFFFFFFF when a backend isn't actually searchable
	const SENTINEL_TOTAL = 4294967295;

	while (raw && raw.ready === false && polls < maxPolls) {
		// No FAZ/cloud backend serving this category — don't burn 10s polling
		if (Number(raw.total_lines) === SENTINEL_TOTAL && polls >= 1) break;
		polls++;
		await sleep(500, signal);
		raw = await fortiGet(
			path,
			dev,
			token,
			{ rows, start: 0, session_id: raw.session_id },
			signal,
		);
	}

	const entries = Array.isArray(raw?.results) ? raw.results : [];
	return {
		entries,
		meta: {
			device: raw?.device,
			category: raw?.category,
			subcategory: raw?.subcategory,
			ready: raw?.ready ?? true,
			completed: raw?.completed,
			percent_logs_processed: raw?.percent_logs_processed,
			total_lines: raw?.total_lines,
			polls,
			session_id: raw?.session_id,
			path,
		},
	};
}

export function registerLogTools(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "get_logs",
		label: "FortiGate: Logs",
		description:
			"Recent log entries via FortiGate API (log/<source>/<type>/<subtype>). " +
			"source: memory (fast buffer)|disk (if present)|fortianalyzer (FAZ — auto-polled until ready)|forticloud. " +
			"log_type: traffic|event|virus|webfilter|ips|anomaly|app-ctrl|dlp|emailfilter " +
			"(NOT parent 'utm' — children are top-level; utm/virus auto-maps to virus/virus). " +
			"Default subtypes: traffic→forward, event→system, others→same as type. " +
			"Optional client filters: action, srcip, dstip, policyid (FortiOS path subtype is often ignored). " +
			"Check get_log_device_state / get_log_fortianalyzer_status first when unsure where logs land. " +
			"Empty buffer ≠ API failure. rows max 50.",
		promptSnippet: "FortiGate log query (memory/disk/FAZ)",
		parameters: Type.Object({
			...deviceParam,
			source: Type.Optional(
				Type.String({
					description: "memory|disk|fortianalyzer|forticloud (use fortianalyzer when FAZ is registered)",
					default: "memory",
				}),
			),
			log_type: Type.Optional(
				Type.String({
					description:
						"traffic|event|virus|webfilter|ips|anomaly|app-ctrl|dlp|emailfilter (avoid utm)",
					default: "event",
				}),
			),
			subtype: Type.Optional(
				Type.String({
					description:
						"Path subtype. Defaults: traffic=forward, event=system, virus=virus, webfilter=webfilter, …",
					default: "system",
				}),
			),
			rows: Type.Optional(Type.Number({ description: "Row count (max 50)", default: 25 })),
			action: Type.Optional(
				Type.String({
					description: "Client-side filter: accept|deny|client-rst|timeout|ip-conn|…",
				}),
			),
			srcip: Type.Optional(Type.String({ description: "Client-side filter on srcip (substring)" })),
			dstip: Type.Optional(Type.String({ description: "Client-side filter on dstip (substring)" })),
			policyid: Type.Optional(
				Type.String({ description: "Client-side filter on policyid (exact string match)" }),
			),
			verbose: Type.Optional(
				Type.Boolean({ description: "Return full log rows (default: projected ops fields only)" }),
			),
		}),
		async execute(_id, params, signal) {
			const src = String(params.source || "memory")
				.trim()
				.toLowerCase();
			const ltIn = String(params.log_type || "event")
				.trim()
				.toLowerCase();
			if (!ALLOWED_LOG_SOURCES.has(src)) {
				return textResult({
					error: `source must be one of: ${[...ALLOWED_LOG_SOURCES].sort().join(", ")}`,
				});
			}
			if (!ALLOWED_LOG_TYPES.has(ltIn)) {
				return textResult({
					error: `log_type must be one of: ${[...ALLOWED_LOG_TYPES].sort().join(", ")}`,
				});
			}

			// Schema default subtype is "system" — wrong for non-event types
			let subtypeParam = params.subtype;
			if (
				subtypeParam != null &&
				String(subtypeParam).toLowerCase() === "system" &&
				ltIn !== "event"
			) {
				subtypeParam = undefined;
			}

			const { type: lt, subtype: stIn, note } = resolveLogSegments(
				ltIn,
				subtypeParam as string | undefined,
			);
			const st = validateName(stIn, "subtype");
			const rows = clampPerPage(params.rows ?? 25);
			const { name, device: dev } = resolveDevice(params.device);
			const token = getToken(dev);
			const path = `log/${src}/${lt}/${st}`;

			let entries: any[];
			let meta: Record<string, unknown>;
			try {
				({ entries, meta } = await fetchLogRows(path, dev, token, rows, signal));
			} catch (e: any) {
				if (e?.name === "AbortError") throw e;
				const msg = String(e?.message || e);
				if (src === "disk" && /404/.test(msg)) {
					return textResult(
						`Error: log disk not available on this device (log_disk_status often not_available on desktop FGTs). ` +
							`Use source=memory (recent buffer) or source=fortianalyzer if FAZ is registered. Tried: ${lt}/${st}. ` +
							`Confirm with get_log_device_state.`,
						{ device: name, source: src, log_type: lt, subtype: st },
					);
				}
				if (/404/.test(msg)) {
					return textResult(
						`Error: log path not found: ${path}. ` +
							`Valid patterns: traffic/forward, event/system|vpn|user, virus/virus, webfilter/webfilter, ips/ips, app-ctrl/app-ctrl. ` +
							`Do not use utm/* as type/subtype.`,
						{ device: name, source: src, log_type: lt, subtype: st },
					);
				}
				return textResult(`Error: ${msg}`, {
					device: name,
					source: src,
					log_type: lt,
					subtype: st,
				});
			}

			const fetched = entries.length;
			const clientFilter: Record<string, string> = {};
			const actionQ = String(params.action || "")
				.trim()
				.toLowerCase();
			const srcQ = String(params.srcip || "")
				.trim()
				.toLowerCase();
			const dstQ = String(params.dstip || "")
				.trim()
				.toLowerCase();
			const polQ = String(params.policyid || "").trim();

			if (actionQ || srcQ || dstQ || polQ) {
				entries = entries.filter((row: any) => {
					if (actionQ && !String(row?.action || "")
						.toLowerCase()
						.includes(actionQ))
						return false;
					if (srcQ && !String(row?.srcip || "")
						.toLowerCase()
						.includes(srcQ))
						return false;
					if (dstQ && !String(row?.dstip || "")
						.toLowerCase()
						.includes(dstQ))
						return false;
					if (polQ && String(row?.policyid ?? "") !== polQ) return false;
					return true;
				});
				if (actionQ) clientFilter.action = actionQ;
				if (srcQ) clientFilter.srcip = srcQ;
				if (dstQ) clientFilter.dstip = dstQ;
				if (polQ) clientFilter.policyid = polQ;
			}

			// FortiOS often ignores path subcategory — soft client filter by row.subtype
			const wantSub = st.toLowerCase();
			const subtypeMatched = entries.filter(
				(r: any) => String(r?.subtype || "").toLowerCase() === wantSub,
			);
			let subtypeNote: string | undefined;
			if (subtypeMatched.length > 0 && subtypeMatched.length < entries.length) {
				entries = subtypeMatched;
				subtypeNote = `Client-filtered to subtype=${wantSub} (FortiOS path subcategory often ignored).`;
			} else if (entries.length > 0 && subtypeMatched.length === 0) {
				subtypeNote =
					`Path subtype=${wantSub} but returned rows have other subtypes ` +
					`(${[...new Set(entries.map((r: any) => r?.subtype).filter(Boolean))].slice(0, 6).join(", ")}). ` +
					`Showing unfiltered window — FortiOS commonly ignores subcategory on memory/FAZ.`;
			}

			const verbose = !!params.verbose;
			entries = entries.map((r) => projectLogRow(r, verbose));

			const notReady = meta.ready === false;
			const empty = entries.length === 0;

			let hint: string | undefined;
			if (notReady) {
				hint =
					`Log search not ready after ${meta.polls} polls (source=${src}). Retry get_logs; FAZ can be slow under load.`;
			} else if (empty && src === "fortianalyzer") {
				const sentinel = Number(meta.total_lines) === 4294967295;
				hint = sentinel
					? `FAZ log search not available for this device (total_lines sentinel). ` +
						`Check get_log_device_state / get_log_fortianalyzer_status — FAZ may be unregistered or not receiving logs. ` +
						`Use source=memory for the live buffer.`
					: `No FAZ rows for ${lt}/${st} (ready=${meta.ready}, total_lines=${meta.total_lines}, polls=${meta.polls}). ` +
						`Confirm FAZ with get_log_fortianalyzer_status (registration/connection). ` +
						`Try source=memory or another log_type.`;
			} else if (empty && src === "memory") {
				hint =
					`No rows in memory buffer for ${lt}/${st}. Not an API error. ` +
					`Try source=fortianalyzer if FAZ is registered, or another type (traffic/forward for accepts/denies).`;
			} else if (empty && src === "forticloud") {
				hint = `No FortiCloud log rows for ${lt}/${st}. Check get_log_forticloud_status / licensing.`;
			} else if (Object.keys(clientFilter).length && entries.length === 0 && fetched > 0) {
				hint = `Fetched ${fetched} rows but client filter matched 0: ${JSON.stringify(clientFilter)}. Broaden filters.`;
			}

			const payload: Record<string, unknown> = {
				entries,
				_meta: {
					...meta,
					source: src,
					log_type: lt,
					subtype: st,
					returned: entries.length,
					fetched,
					...(Object.keys(clientFilter).length ? { _client_filter: clientFilter } : {}),
					...(note ? { _mapped: note } : {}),
					...(subtypeNote ? { _subtype_note: subtypeNote } : {}),
				},
			};
			if (empty) payload._empty = true;
			if (hint) payload._hint = hint;

			return textResult(
				bounded(
					payload,
					"Lower rows, add action/srcip/dstip/policyid filters, or switch source.",
					getMaxResponseBytes(),
				),
				{ device: name, source: src, log_type: lt, subtype: st, path },
			);
		},
	});
}
