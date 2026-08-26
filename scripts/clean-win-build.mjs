import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const packRoot = path.join(process.cwd(), '.build', 'electron');
const unpacked = path.join(packRoot, 'win-unpacked');

function sleep(ms) {
	if (process.platform === 'win32') {
		try {
			execSync('powershell -NoProfile -Command "Start-Sleep -Milliseconds ' + ms + '"', { stdio: 'ignore' });
			return;
		} catch {
			/* fall through */
		}
	}
	const end = Date.now() + ms;
	while (Date.now() < end) { /* busy wait */ }
}

function killWindowsBuildLocks() {
	if (process.platform !== 'win32') return;
	const names = ['Markdown Tools.exe', 'electron.exe'];
	for (const name of names) {
		try {
			execSync('taskkill /F /T /IM "' + name + '"', { stdio: 'ignore' });
		} catch {
			/* not running */
		}
	}
	sleep(800);
}

function removeDir(dir) {
	if (!fs.existsSync(dir)) return;
	for (let attempt = 0; attempt < 8; attempt++) {
		try {
			fs.rmSync(dir, { recursive: true, force: true });
			return;
		} catch (err) {
			if (attempt === 7) throw err;
			killWindowsBuildLocks();
			sleep(600);
		}
	}
}

killWindowsBuildLocks();
removeDir(packRoot);
console.log('Ready for Windows pack/build.');
