/** FortiOS GET query string. vdom is pinned; params.vdom is ignored. Arrays → repeated keys. */

export function buildQueryString(
	params: Record<string, unknown> | undefined,
	vdom: string,
): string {
	const qs = new URLSearchParams();
	qs.set("vdom", vdom || "root");
	if (!params) return qs.toString();
	for (const [k, v] of Object.entries(params)) {
		if (k === "vdom" || v === undefined || v === null) continue;
		if (Array.isArray(v)) {
			for (const item of v) {
				if (item === undefined || item === null || item === "") continue;
				qs.append(k, String(item));
			}
		} else {
			qs.set(k, String(v));
		}
	}
	return qs.toString();
}

export function isFortiOsBadRequest(err: unknown): boolean {
	return /FortiGate API error 400\b/.test(String((err as any)?.message || err));
}
