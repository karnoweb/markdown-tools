// Markdown Tools — dev watcher for the JS bundle (permanent).
// Watches app/js/src/{core,extras}/ and rebuilds app/js/rtlmd.bundle.js
// on every save, so local testing needs no manual build step.
//
// Usage: npm run watch:js   (keep it running in a terminal; Ctrl+C to stop)
import { watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

var ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
var SRC = join(ROOT, 'app', 'js', 'src');
var BUILD = join(ROOT, 'scripts', 'build-js-bundle.mjs');

var rebuilding = false;
var queued = false;

function build(reason) {
	if (rebuilding) {
		queued = true;
		return;
	}
	rebuilding = true;
	execFile(process.execPath, [BUILD], function (err, stdout, stderr) {
		var stamp = new Date().toLocaleTimeString();
		if (err) {
			console.error('[' + stamp + '] build FAILED (' + reason + ')\n' + (stderr || stdout || err.message));
		} else {
			console.log('[' + stamp + '] rebuilt (' + reason + ')');
		}
		rebuilding = false;
		if (queued) {
			queued = false;
			build('queued change');
		}
	});
}

try {
	watch(SRC, { recursive: true }, function (event, filename) {
		if (!filename || !filename.endsWith('.js')) return;
		build(filename);
	});
} catch (e) {
	console.error('[watch:js] cannot watch ' + SRC + ': ' + e.message);
	process.exit(1);
}

console.log('[watch:js] watching app/js/src/ — save a part and the bundle rebuilds.');
build('initial');
