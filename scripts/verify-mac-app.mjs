#!/usr/bin/env node
/**
 * Post-build Gatekeeper / codesign checks (macOS only).
 * Usage: node scripts/verify-mac-app.mjs [path/to/Markdown Tools.app]
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

if (process.platform !== 'darwin') {
	console.error('verify:mac only runs on macOS.');
	process.exit(1);
}

function findApp() {
	const arg = process.argv[2];
	if (arg && fs.existsSync(arg)) return path.resolve(arg);

	const dist = path.join(process.cwd(), 'dist');
	if (!fs.existsSync(dist)) return null;

	const hits = [];
	function walk(dir, depth) {
		if (depth > 4) return;
		for (const name of fs.readdirSync(dir)) {
			const full = path.join(dir, name);
			let st;
			try {
				st = fs.lstatSync(full);
			} catch {
				continue;
			}
			if (st.isDirectory()) {
				if (name.endsWith('.app')) hits.push(full);
				else walk(full, depth + 1);
			}
		}
	}
	walk(dist, 0);
	hits.sort();
	return hits[0] || null;
}

const appPath = findApp();
if (!appPath) {
	console.error('No .app found. Pass a path or build first (npm run dist:mac).');
	process.exit(1);
}

console.log('Verifying:', appPath);

function run(label, cmd, args) {
	console.log('\n===', label, '===');
	const r = spawnSync(cmd, args, { encoding: 'utf8' });
	if (r.stdout) process.stdout.write(r.stdout);
	if (r.stderr) process.stderr.write(r.stderr);
	return r.status === 0;
}

const okVerify = run(
	'codesign --verify --deep --strict --verbose=2',
	'codesign',
	['--verify', '--deep', '--strict', '--verbose=2', appPath]
);
const okDetails = run('codesign -dv --verbose=4', 'codesign', ['-dv', '--verbose=4', appPath]);
const okSpctl = run(
	'spctl --assess --type execute --verbose',
	'spctl',
	['--assess', '--type', 'execute', '--verbose', appPath]
);

// Staple / notarization ticket (best-effort)
run('stapler validate', 'xcrun', ['stapler', 'validate', appPath]);

if (!okVerify || !okDetails) {
	console.error('\nFAIL: codesign verification failed.');
	process.exit(1);
}
if (!okSpctl) {
	console.error(
		'\nFAIL: spctl rejected the app. Usual causes: not notarized, ad-hoc/unsigned, or quarantine without a valid ticket.'
	);
	process.exit(1);
}

console.log('\nOK: signature and Gatekeeper assessment passed.');
