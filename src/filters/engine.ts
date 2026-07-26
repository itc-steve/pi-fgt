/**
 * Rule-based response filter.
 *
 * Precedence (first match wins):
 *   keep[]  → always survives
 *   dropKeys / group keys
 *   dropPrefixes / dropSuffixes / group prefixes+suffixes
 *   dropValues (byValue, disableDefaults)
 *   dropEmpty
 *
 * Group `flatten` (health) rewrites rather than drops.
 */

import type { FilterConfig, RuleBlock, ToolOverride } from "./defaults.js";

export interface FilterStats {
	keysDropped: number;
	groups: Set<string>;
}

/** Compiled matcher — built once per tool call, not per key. */
export interface Compiled {
	keep: Set<string>;
	/** null = no allowlist. Non-empty = ONLY these fields survive on records. */
	allowlist: Set<string> | null;
	/** Prefix/suffix patterns from re-enabled groups that bypass the allowlist. */
	allowPatterns: Array<["p" | "s", string]>;
	dropKeys: Map<string, string>; // key → group label ("" = explicit rule)
	dropPrefixes: Array<[string, string]>;
	dropSuffixes: Array<[string, string]>;
	flattenKeys: Set<string>;
	byValue: Set<string>;
	disableDefaults: boolean;
	dropEmptyString: boolean;
	dropEmptyArray: boolean;
	dropEmptyObject: boolean;
	dropNull: boolean;
	annotate: boolean;
	maxArrayItems: number;
}

function mergeRuleBlock(base: RuleBlock, over: RuleBlock | undefined): RuleBlock {
	if (!over) return base;
	return {
		dropEmpty: { ...base.dropEmpty, ...over.dropEmpty },
		dropValues: {
			byValue: over.dropValues?.byValue ?? base.dropValues?.byValue,
			disableDefaults:
				over.dropValues?.disableDefaults ?? base.dropValues?.disableDefaults,
		},
		dropKeys: [...(base.dropKeys || []), ...(over.dropKeys || [])],
		dropPrefixes: [...(base.dropPrefixes || []), ...(over.dropPrefixes || [])],
		dropSuffixes: [...(base.dropSuffixes || []), ...(over.dropSuffixes || [])],
	};
}

/** Build the matcher for one tool. */
export function compile(cfg: FilterConfig, toolName?: string): Compiled {
	const tool: ToolOverride | undefined = toolName ? cfg.tools?.[toolName] : undefined;
	const rules = mergeRuleBlock(cfg.global || {}, tool);

	const keep = new Set(tool?.keep || []);
	const dropKeys = new Map<string, string>();
	const dropPrefixes: Array<[string, string]> = [];
	const dropSuffixes: Array<[string, string]> = [];
	const flattenKeys = new Set<string>();

	for (const [name, g] of Object.entries(cfg.groups || {})) {
		// per-tool group override beats the group's own default
		const on = tool?.groups?.[name] ?? g.exclude;
		if (g.flatten) for (const k of g.keys || []) flattenKeys.add(k);
		if (!on) continue;
		for (const k of g.keys || []) if (!flattenKeys.has(k)) dropKeys.set(k, name);
		for (const p of g.prefixes || []) dropPrefixes.push([p, name]);
		for (const s of g.suffixes || []) dropSuffixes.push([s, name]);
	}
	for (const k of rules.dropKeys || []) dropKeys.set(k, "");
	for (const p of rules.dropPrefixes || []) dropPrefixes.push([p, ""]);
	for (const s of rules.dropSuffixes || []) dropSuffixes.push([s, ""]);

	// A group turned back ON (exclude:false) must be able to re-admit its keys
	// past a tool allowlist — otherwise flipping uuid:{exclude:false} appears to
	// do nothing, which is the worst kind of config: silently ignored.
	const allow = tool?.allowlist;
	const allowSet =
		Array.isArray(allow) && allow.length > 0 ? new Set(allow) : null;
	const allowPatterns: Array<["p" | "s", string]> = [];
	if (allowSet) {
		for (const [name, g] of Object.entries(cfg.groups || {})) {
			const on = tool?.groups?.[name] ?? g.exclude;
			if (on) continue;
			for (const k of g.keys || []) allowSet.add(k);
			for (const p of g.prefixes || []) allowPatterns.push(["p", p]);
			for (const s of g.suffixes || []) allowPatterns.push(["s", s]);
		}
	}

	return {
		keep,
		allowlist: allowSet,
		allowPatterns,
		dropKeys,
		dropPrefixes,
		dropSuffixes,
		flattenKeys,
		byValue: new Set(rules.dropValues?.byValue || []),
		disableDefaults: !!rules.dropValues?.disableDefaults,
		dropEmptyString: rules.dropEmpty?.emptyString !== false,
		dropEmptyArray: rules.dropEmpty?.emptyArray !== false,
		dropEmptyObject: rules.dropEmpty?.emptyObject !== false,
		dropNull: rules.dropEmpty?.nullValue !== false,
		annotate: cfg.audit?.annotate !== false,
		maxArrayItems: cfg.limits?.maxArrayItems ?? 20,
	};
}

/**
 * health:{sig:{value,severity}} → {sig_severity:"good"}
 * Also handles arrays of {value,severity} (FortiAP health.general.uplink_status)
 * → ["good","good"], which otherwise passed through unflattened.
 */
function flattenHealth(v: unknown): unknown {
	if (!v || typeof v !== "object") return v;

	if (Array.isArray(v)) {
		// array of severity records → array of severities
		if (v.some((e) => e && typeof e === "object" && "severity" in (e as any))) {
			return v.map((e) =>
				e && typeof e === "object" && "severity" in (e as any)
					? (e as any).severity
					: flattenHealth(e),
			);
		}
		return v.map(flattenHealth);
	}

	const out: Record<string, unknown> = {};
	for (const [k, sub] of Object.entries(v as Record<string, unknown>)) {
		if (sub && typeof sub === "object" && !Array.isArray(sub) && "severity" in (sub as any)) {
			out[`${k}_severity`] = (sub as any).severity;
		} else if (sub && typeof sub === "object") {
			const nested = flattenHealth(sub);
			const empty =
				nested && typeof nested === "object" && Object.keys(nested as object).length === 0;
			if (nested != null && !empty) out[Array.isArray(nested) ? `${k}_severity` : k] = nested;
		}
	}
	return out;
}

/** Allowlisted by name, or by a re-enabled group's prefix/suffix pattern? */
function isAllowed(c: Compiled, key: string): boolean {
	if (!c.allowlist) return false;
	if (c.allowlist.has(key)) return true;
	for (const [kind, pat] of c.allowPatterns) {
		if (kind === "p" ? key.startsWith(pat) : key.endsWith(pat)) return true;
	}
	return false;
}

/** Should this key/value pair be removed? Returns group label, or null to keep. */
function dropReason(c: Compiled, key: string, val: unknown): string | null {
	if (c.keep.has(key)) return null;

	// An allowlisted key already survived an explicit "only these fields" pass,
	// so it must not then be dropped for holding a DEFAULT value — otherwise
	// logtraffic:"disable" (a real security signal) silently vanishes.
	// Empty/null still drops: absent data is noise, not signal.
	const allowlisted = isAllowed(c, key);

	const g = c.dropKeys.get(key);
	if (g !== undefined) return g || "rule";

	for (const [p, label] of c.dropPrefixes) {
		if (key.startsWith(p)) return label || "rule";
	}
	for (const [s, label] of c.dropSuffixes) {
		if (key.endsWith(s)) return label || "rule";
	}

	if (typeof val === "string") {
		if (!allowlisted) {
			if (c.disableDefaults && val === "disable") return "default_off";
			if (c.byValue.has(val)) return "zero_placeholder";
		}
		if (c.dropEmptyString && val === "") return "empty";
	}
	if (c.dropNull && val === null) return "empty";
	if (Array.isArray(val)) {
		if (c.dropEmptyArray && val.length === 0) return "empty";
	} else if (val && typeof val === "object") {
		if (c.dropEmptyObject && Object.keys(val).length === 0) return "empty";
	}
	return null;
}

/** Recursively filter a FortiOS payload. Mutates nothing. */
export function applyFilters(
	value: unknown,
	c: Compiled,
	stats: FilterStats,
	depth = 0,
): unknown {
	if (depth > 12) return value;

	if (Array.isArray(value)) {
		return value.map((v) => applyFilters(v, c, stats, depth + 1));
	}
	if (!value || typeof value !== "object") return value;

	let entries = Object.entries(value as Record<string, unknown>);

	// Strict allowlist, applied at RECORD level only.
	// An object sharing no keys with the allowlist is an envelope
	// (e.g. {summary, details}) and is passed through to its children,
	// so we never gut a wrapper. Projecting before recursing also means
	// big unlisted subtrees (fortiap `radio`) are never even walked.
	if (c.allowlist) {
		const isRecord = entries.some(([k]) => isAllowed(c, k));
		if (isRecord) {
			const kept: Array<[string, unknown]> = [];
			for (const e of entries) {
				// _hint/_partial/_truncated are OUR metadata — never allowlist them away
				if (isAllowed(c, e[0]) || e[0].startsWith("_")) {
					kept.push(e);
					continue;
				}
				stats.keysDropped++;
				// Attribute to the named group when one also covers this key, so the
				// audit still says WHY (uuid, ztna, …) instead of a bare "allowlist".
				const g = dropReason(c, e[0], e[1]);
				stats.groups.add(g && g !== "rule" ? g : "allowlist");
			}
			entries = kept;
		}
	}

	const out: Record<string, unknown> = {};
	for (const [k, v] of entries) {
		if (c.flattenKeys.has(k)) {
			const flat = flattenHealth(v);
			if (flat && Object.keys(flat as object).length) {
				out[k] = flat;
				stats.groups.add("health_nesting(flattened)");
			}
			continue;
		}

		const reason = dropReason(c, k, v);
		if (reason !== null) {
			stats.keysDropped++;
			if (reason !== "rule") stats.groups.add(reason);
			continue;
		}

		const cleaned = applyFilters(v, c, stats, depth + 1);

		// a nested object emptied by filtering is itself noise
		if (
			c.dropEmptyObject &&
			cleaned &&
			typeof cleaned === "object" &&
			!Array.isArray(cleaned) &&
			Object.keys(cleaned).length === 0 &&
			v &&
			typeof v === "object" &&
			!Array.isArray(v) &&
			Object.keys(v).length > 0
		) {
			stats.keysDropped++;
			continue;
		}
		out[k] = cleaned;
	}
	return out;
}
