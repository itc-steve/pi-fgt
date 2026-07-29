/**
 * Generate fortigate-filters.example.json from src/filters/defaults.ts.
 * Run: npm run filters:example
 * The TS object is the source of truth; the JSON is documentation.
 */

import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// .ts specifier: this file is run directly by node --experimental-strip-types,
// which resolves the real path, not the compiled .js one.
import { DEFAULT_FILTERS } from "../src/filters/defaults.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "fortigate-filters.example.json");

const doc = {
	$comment: [
		"GENERATED from src/filters/defaults.ts — do not hand-edit; run `npm run filters:example`.",
		"Copy this to ~/.pi/agent/fortigate-filters.json to customize.",
		"Applied AFTER the FortiGate answers, BEFORE the model sees the data.",
		"Precedence: tools[].keep > dropKeys > dropPrefixes/dropSuffixes > dropValues > dropEmpty.",
		"A group with exclude:true is REMOVED from responses. Flip to false to get it back.",
		"Your file is deep-merged over these defaults, so you only need the keys you change.",
	],
	...DEFAULT_FILTERS,
};

writeFileSync(out, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`wrote ${out}`);
