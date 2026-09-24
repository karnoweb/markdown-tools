// Markdown Tools — JS bundle builder (permanent).
// Concatenates the split authoring sources in a fixed order into one
// classic-script bundle (the app runs from file:// under Electron, so ES
// modules / imports cannot be used at runtime).
//
// Sources : app/js/src/core/*.js then app/js/src/extras/*.js (alphabetical)
// Output  : app/js/rtlmd.bundle.js  (committed — the app must run straight
//           from git, no build step required to open index.html)
//
// Usage: npm run build:js   (also runs as part of `npm run vendor`)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

var ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
var SRC = join(ROOT, 'app', 'js', 'src');
var OUT = join(ROOT, 'app', 'js', 'rtlmd.bundle.js');

function listParts(dir) {
	return readdirSync(dir)
		.filter(function (f) { return f.endsWith('.js'); })
		.sort()
		.map(function (f) { return join(dir, f); });
}

var groups = ['core', 'extras'];
var files = [];
groups.forEach(function (g) {
	listParts(join(SRC, g)).forEach(function (f) { files.push(f); });
});
if (!files.length) {
	console.error('[build:js] no sources found under app/js/src/{core,extras}/');
	process.exit(1);
}

/* Guard: the two legacy files each defined storageGet/storageSet. After the
   split there must be exactly one definition of each in the whole bundle —
   a silent double definition would change which implementation wins. */
var counts = {};
files.forEach(function (f) {
	var src = readFileSync(f, 'utf8');
	src.split('\n').forEach(function (line) {
		var m = line.match(/^\tfunction ([A-Za-z_$][\w$]*)\s*\(/);
		if (m) counts[m[1]] = (counts[m[1]] || 0) + 1;
	});
});
var dupes = Object.keys(counts).filter(function (k) { return counts[k] > 1; });
if (dupes.length) {
	console.error('[build:js] duplicate top-level function(s): ' + dupes.join(', '));
	process.exit(1);
}

var out = [];
out.push('/* Markdown Tools — generated bundle. DO NOT EDIT BY HAND.');
out.push(' * Built by `npm run build:js` (scripts/build-js-bundle.mjs).');
out.push(' * Edit the sources under app/js/src/{core,extras}/ and rebuild.');
out.push(' */');
out.push('(function () {');
out.push("'use strict';");
files.forEach(function (f) {
	var rel = f.slice(ROOT.length + 1).replace(/\\/g, '/');
	out.push('');
	out.push('/* ===== src: ' + rel + ' ===== */');
	out.push(readFileSync(f, 'utf8').replace(/\s+$/, ''));
});
out.push('');
out.push('}());');
out.push('');
writeFileSync(OUT, out.join('\n'));

/* Syntax gate — the bundle must at least parse before we ship it. */
execFileSync(process.execPath, ['--check', OUT], { stdio: 'inherit' });
console.log('[build:js] wrote ' + files.length + ' parts -> app/js/rtlmd.bundle.js');
