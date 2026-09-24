/* Build the offline .docx exporter bundle:
 *   scripts/word-docx-entry.mjs (+ node_modules/docx)
 *     -> assets/vendor/docx/word-docx.bundle.js
 * Run: npm run build:docx (also part of `npm run vendor`).
 */
import esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const entry = path.join(root, "scripts", "word-docx-entry.mjs");
const outFile = path.join(root, "assets", "vendor", "docx", "word-docx.bundle.js");

fs.mkdirSync(path.dirname(outFile), { recursive: true });

await esbuild.build({
	entryPoints: [entry],
	bundle: true,
	minify: true,
	format: "iife",
	platform: "browser",
	target: ["chrome110", "firefox110", "safari16"],
	outfile: outFile,
	logLevel: "info",
});

const bytes = fs.statSync(outFile).size;
console.log(
	"Word .docx bundle: assets/vendor/docx/word-docx.bundle.js (" +
		(bytes / 1024).toFixed(1) +
		" KB)"
);
