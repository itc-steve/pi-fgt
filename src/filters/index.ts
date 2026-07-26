/**
 * Filter config loader.
 *
 * Defaults live in defaults.ts (TS = source of truth).
 * User overrides: ~/.pi/agent/fortigate-filters.json (deep-merged over defaults).
 * Missing file = defaults, no error — filters are opt-out, not opt-in.
 *
 * Tool name is carried through AsyncLocalStorage so textResult() can apply
 * per-tool rules without threading a param through ~150 call sites.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_FILTERS, type FilterConfig } from "./defaults.js";
import { applyFilters, compile, type FilterStats } from "./engine.js";

const AGENT_DIR = join(process.env.HOME || process.env.USERPROFILE || "~", ".pi", "agent");
const FILTERS_PATH = join(AGENT_DIR, "fortigate-filters.json");

const TTL_MS = 10_000;
let cached: FilterConfig | null = null;
let cacheTime = 0;
let lastError: string | null = null;

export function filtersPath(): string {
	return FILTERS_PATH;
}

export function filtersLoadError(): string | null {
	return lastError;
}

function isObj(v: unknown): v is Record<string, any> {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Deep merge: user arrays REPLACE default arrays (so users can shrink a list). */
function deepMerge<T>(base: T, over: unknown): T {
	if (!isObj(over)) return base;
	if (!isObj(base)) return over as T;
	const out: Record<string, any> = { ...base };
	for (const [k, v] of Object.entries(over)) {
		if (k.startsWith("$comment")) continue;
		out[k] = isObj(v) && isObj((base as any)[k]) ? deepMerge((base as any)[k], v) : v;
	}
	return out as T;
}

export function loadFilters(force = false): FilterConfig {
	const now = Date.now();
	if (!force && cached && now - cacheTime < TTL_MS) return cached;

	let cfg = DEFAULT_FILTERS;
	lastError = null;

	if (existsSync(FILTERS_PATH)) {
		try {
			cfg = deepMerge(DEFAULT_FILTERS, JSON.parse(readFileSync(FILTERS_PATH, "utf-8")));
		} catch (e: any) {
			// Bad JSON must never break tools — fall back loudly to defaults
			lastError = `fortigate-filters.json ignored (${e.message}); using defaults.`;
			cfg = DEFAULT_FILTERS;
		}
	}

	cached = cfg;
	cacheTime = now;
	return cfg;
}

// --- per-tool context ------------------------------------------------------

interface ToolStore {
	tool: string;
	verbose: boolean;
	/** Accumulated across every filter pass in this tool call. */
	stats: FilterStats;
}

const toolCtx = new AsyncLocalStorage<ToolStore>();

/** Wrap a tool execute() so filtering knows which tool it is serving. */
export function withToolContext<T>(tool: string, verbose: boolean, fn: () => T): T {
	return toolCtx.run(
		{ tool, verbose, stats: { keysDropped: 0, groups: new Set<string>() } },
		fn,
	);
}

export function currentTool(): ToolStore | undefined {
	return toolCtx.getStore();
}

/**
 * Filter a payload. Data only — no annotation, so this is safe to call before
 * bounded() (sizing must see post-filter bytes) and again in textResult().
 * Idempotent: a second pass finds nothing left to drop.
 */
export function filterForCurrentTool(data: unknown): unknown {
	const cfg = loadFilters();
	if (!cfg.enabled) return data;
	const ctx = currentTool();
	if (ctx?.verbose && cfg.audit?.verboseBypassesFilters) return data;

	const stats: FilterStats = ctx?.stats ?? { keysDropped: 0, groups: new Set<string>() };
	return applyFilters(data, compile(cfg, ctx?.tool), stats, 0);
}

/**
 * Audit stamp for what this tool call removed, or null when nothing was
 * dropped / annotation is off. Applied once, in textResult().
 */
export interface FilterAudit {
	keysDropped: number;
	groups: string[];
	hint: string;
}

export function filterAudit(): FilterAudit | null {
	const cfg = loadFilters();
	if (!cfg.enabled || cfg.audit?.annotate === false) return null;
	const ctx = currentTool();
	if (!ctx || ctx.stats.keysDropped === 0) return null;
	return {
		keysDropped: ctx.stats.keysDropped,
		groups: [...ctx.stats.groups].sort(),
		hint: "Fields removed by ~/.pi/agent/fortigate-filters.json — set a group exclude:false there to get them back.",
	};
}

/** Byte cap: filters file may override fortigate.json. null = defer. */
export function filterMaxResponseBytes(): number | null {
	const v = loadFilters().limits?.maxResponseBytes;
	return typeof v === "number" && v > 0 ? v : null;
}

export { DEFAULT_FILTERS };
export type { FilterConfig };
