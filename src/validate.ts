/** Path / name validation + clamps. */

import { PER_PAGE_CAP } from "./types.js";

const NAME_RE = /^[A-Za-z0-9_.\-: ]+$/;
const PATH_RE = /^[A-Za-z0-9_.\-/]+$/;

export function validateName(value: string, label: string): string {
  const name = (value || "").trim();
  if (!name) {
    throw new Error(`${label} is required`);
  }
  if (name.length > 128) {
    throw new Error(`${label} is too long (max 128 chars)`);
  }
  if (!NAME_RE.test(name)) {
    throw new Error(
      `${label} contains invalid characters (allowed: letters, digits, underscore, dot, hyphen, colon, space)`,
    );
  }
  return name;
}

/**
 * Bare FortiOS path under cmdb/ or monitor/ (no scheme, no api/v2 prefix, no query).
 * Examples: firewall/policy, wifi/managed_ap, switch-controller/managed-switch/status
 */
export function validatePath(value: string, label = "path"): string {
  let p = (value || "").trim().replace(/^\/+|\/+$/g, "");
  if (!p) {
    throw new Error(`${label} is required`);
  }
  // Strip accidental full URL / api prefix the model often adds
  p = p.replace(/^https?:\/\/[^/]+\/?/i, "");
  p = p.replace(/^api\/v2\//i, "");
  p = p.replace(/^(cmdb|monitor)\//i, ""); // tools add their own prefix
  p = p.replace(/^\/+|\/+$/g, "");

  if (!p) {
    throw new Error(`${label} is required (bare path like wifi/managed_ap — do not include api/v2)`);
  }
  if (/api\/v2/i.test(p)) {
    throw new Error(
      `${label} must be a bare path only (e.g. wifi/managed_ap). Do not include api/v2 or a full URL.`,
    );
  }
  if (p.length > 256) {
    throw new Error(`${label} is too long (max 256 chars)`);
  }
  if (p.includes("..")) {
    throw new Error(`${label} must not contain '..'`);
  }
  if (p.includes("?") || p.includes("#")) {
    throw new Error(`${label} must not include a query string — use typed tools for filters`);
  }
  if (!PATH_RE.test(p)) {
    throw new Error(
      `${label} contains invalid characters — provide a bare table path like 'firewall/policy' with no query string or scheme`,
    );
  }
  return p;
}

export function clampPerPage(n: unknown, cap = PER_PAGE_CAP): number {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.min(Math.floor(num), cap);
}
