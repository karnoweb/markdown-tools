#!/usr/bin/env node
/**
 * macOS Electron release helper.
 *
 * Signed + notarized (default): requires Developer ID + Apple notarization credentials.
 * Unsigned (--unsigned): local/CI only — Gatekeeper will treat downloaded builds as damaged.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const unsigned = process.argv.includes('--unsigned');
const passthrough = process.argv.slice(2).filter((a) => a !== '--unsigned');

function hasNotarizeAuth() {
	const appleId =
		process.env.APPLE_ID &&
		process.env.APPLE_APP_SPECIFIC_PASSWORD &&
		process.env.APPLE_TEAM_ID;
	const apiKey =
		process.env.APPLE_API_KEY &&
		process.env.APPLE_API_KEY_ID &&
		process.env.APPLE_API_ISSUER;
	const keychain = process.env.APPLE_KEYCHAIN && process.env.APPLE_KEYCHAIN_PROFILE;
	return Boolean(appleId || apiKey || keychain);
}

function run(cmd, args, env = process.env) {
	const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
	if (r.status !== 0) process.exit(r.status || 1);
}

if (process.platform === 'darwin') {
	const prep = path.join(root, 'scripts', 'prepare-mac-icons.sh');
	if (fs.existsSync(prep)) {
		run('bash', [prep]);
	}
}

const ebArgs = ['electron-builder', '--mac', ...passthrough];
const env = { ...process.env };

if (unsigned) {
	env.CSC_IDENTITY_AUTO_DISCOVERY = 'false';
	ebArgs.push(
		'-c.mac.identity=null',
		'-c.mac.hardenedRuntime=false',
		'-c.mac.notarize=false'
	);
	console.warn(
		'[dist:mac:unsigned] Building WITHOUT Developer ID signing / notarization.\n' +
			'Downloaded copies will be blocked by Gatekeeper ("damaged and can\'t be opened").\n' +
			'For a distributable build, use: npm run dist:mac  (with signing + notarize env).'
	);
} else {
	if (!hasNotarizeAuth()) {
		console.error(
			'[dist:mac] Missing notarization credentials.\n' +
				'Set one of:\n' +
				'  • APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID\n' +
				'  • APPLE_API_KEY + APPLE_API_KEY_ID + APPLE_API_ISSUER (+ APPLE_TEAM_ID)\n' +
				'  • APPLE_KEYCHAIN + APPLE_KEYCHAIN_PROFILE\n' +
				'See build/mac-release.env.example\n' +
				'For a non-distributable local build only: npm run dist:mac:unsigned'
		);
		process.exit(1);
	}
	// Prefer keychain / CSC_LINK identity; do not force ad-hoc.
	delete env.CSC_IDENTITY_AUTO_DISCOVERY;
	console.log(
		'[dist:mac] Signing with Developer ID (auto-discover or CSC_*) then notarizing the final .app before DMG packaging.'
	);
}

run('npx', ebArgs, env);
