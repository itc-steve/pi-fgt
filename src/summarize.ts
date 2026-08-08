/**
 * Shrink FortiOS monitor payloads that ship huge time-series history.
 * Keeps latest samples only so CPU/mem tools stay small.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return !!v && typeof v === "object" && !Array.isArray(v);
}

function unwrapResults(raw: unknown): unknown {
	if (isPlainObject(raw) && "results" in raw) return (raw as { results: unknown }).results;
	return raw;
}

/** Keep only the last N items of arrays (time series). */
function tailArray(arr: unknown[], n: number): unknown[] {
	if (arr.length <= n) return arr;
	return arr.slice(-n);
}

/**
 * FortiOS 7.4 resource/usage shape:
 *   { cpu: [ { current: 3, historical: { "1-min": { values: [[ts,v], ...] } } } ], mem: [...], ... }
 * Outer array is usually length 1; bulk is nested historical.values.
 * Keep current (+ optional newest historical point). Drop full series.
 */
function pickLatestMetric(val: unknown): unknown {
	if (Array.isArray(val)) {
		if (val.length === 0) return null;
		// multi-sample series → last sample only, then unwrap
		return pickLatestMetric(val[val.length - 1]);
	}
	if (!isPlainObject(val)) return val;

	// Preferred: { current, historical: { period: { values: [[ts, v], ...] } } }
	if ("current" in val) {
		// Ops only need current + one short-window sample (drop multi-period bulk)
		const out: Record<string, unknown> = { current: val.current };
		if (isPlainObject(val.historical)) {
			const prefer = ["1-min", "10-min", "1-hour"];
			for (const period of prefer) {
				const series = val.historical[period];
				if (isPlainObject(series) && Array.isArray(series.values) && series.values.length > 0) {
					// FortiOS returns newest-first on this endpoint; keep value only
					const pt = series.values[0];
					out[`sample_${period.replace("-", "_")}`] = Array.isArray(pt) ? pt[1] : pt;
					break;
				}
			}
		}
		return out;
	}

	// Nested object without current — recurse / trim arrays
	const nested: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(val)) {
		if (Array.isArray(v)) {
			const last = tailArray(v, 1);
			nested[k] = last.length === 1 ? pickLatestMetric(last[0]) : last.map(pickLatestMetric);
		} else if (isPlainObject(v)) {
			nested[k] = pickLatestMetric(v);
		} else {
			nested[k] = v;
		}
	}
	return nested;
}

/**
 * Summarize resource/usage style payloads:
 * - unwrap FortiOS `results` envelope
 * - collapse each metric to current (+ one latest historical point)
 */
export function summarizeResourceUsage(raw: unknown): unknown {
	const data = unwrapResults(raw);

	if (Array.isArray(data)) {
		return { samples: tailArray(data, 1).map(pickLatestMetric), _note: "history truncated to latest sample" };
	}

	if (!isPlainObject(data)) return data;

	const out: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(data)) {
		out[key] = pickLatestMetric(val);
	}
	out._summary = "time series reduced to current (+ one short-window sample) per metric";
	return out;
}

/**
 * Generic deep trim for unknown large objects:
 * - arrays longer than maxItems → last maxItems + meta
 * - recurse into objects
 */
export function deepTrim(value: unknown, maxItems = 20, depth = 0): unknown {
	if (depth > 8) return "[max depth]";
	if (Array.isArray(value)) {
		const trimmed = value.length > maxItems ? value.slice(0, maxItems) : value;
		const mapped = trimmed.map((item) => deepTrim(item, maxItems, depth + 1));
		if (value.length > maxItems) {
			return {
				_truncated_list: true,
				_returned: maxItems,
				_total: value.length,
				data: mapped,
			};
		}
		return mapped;
	}
	if (isPlainObject(value)) {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			out[k] = deepTrim(v, maxItems, depth + 1);
		}
		return out;
	}
	return value;
}

// Self-check: fails if nested historical data leaks through.
if (import.meta.main) {
	const fake = {
		results: {
			cpu: [{ current: 7, historical: { "1-min": { values: Array.from({ length: 200 }, (_, i) => [i, i % 5]) } } }],
			mem: [{ current: 42, historical: { "1-min": { values: Array.from({ length: 200 }, (_, i) => [i, 40]) } } }],
		},
	};
	const s = summarizeResourceUsage(fake) as any;
	const text = JSON.stringify(s);
	if (s.cpu?.current !== 7 || s.mem?.current !== 42) throw new Error("current missing");
	if (text.includes('"historical"') || text.includes('"values"') || text.length > 400) {
		throw new Error(`leaked history: ${text.length} ${text.slice(0, 200)}`);
	}
	console.log("summarize ok", text);
}
