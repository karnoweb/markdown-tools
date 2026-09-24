import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'assets', 'vendor');

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
	ensureDir(path.dirname(dest));
	fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
	if (!fs.existsSync(srcDir)) return;
	ensureDir(destDir);
	for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
		const from = path.join(srcDir, entry.name);
		const to = path.join(destDir, entry.name);
		if (entry.isDirectory()) copyDir(from, to);
		else copyFile(from, to);
	}
}

function download(url, dest) {
	return new Promise((resolve, reject) => {
		ensureDir(path.dirname(dest));
		const file = fs.createWriteStream(dest);
		https.get(url, (res) => {
			if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				file.close();
				fs.unlinkSync(dest);
				return download(res.headers.location, dest).then(resolve, reject);
			}
			if (res.statusCode !== 200) {
				file.close();
				fs.unlink(dest, () => {});
				return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
			}
			res.pipe(file);
			file.on('finish', () => file.close(resolve));
		}).on('error', reject);
	});
}

async function downloadFonts() {
	const fontsDir = path.join(vendor, 'fonts');
	const vazirDir = path.join(fontsDir, 'vazirmatn');
	const firaDir = path.join(fontsDir, 'fira-code');
	ensureDir(vazirDir);
	ensureDir(firaDir);

	const vazirFiles = [
		'Vazirmatn-Regular.woff2',
		'Vazirmatn-Medium.woff2',
		'Vazirmatn-Bold.woff2'
	];
	const vazirBase = 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/';
	for (const file of vazirFiles) {
		await download(vazirBase + file, path.join(vazirDir, file));
	}

	const firaFiles = [
		['FiraCode-Regular.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/fira-code@5.0.18/files/fira-code-latin-400-normal.woff2'],
		['FiraCode-Medium.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/fira-code@5.0.18/files/fira-code-latin-500-normal.woff2']
	];
	for (const [name, url] of firaFiles) {
		await download(url, path.join(firaDir, name));
	}

	const fontsCss = [
		'@font-face {',
		"  font-family: 'Vazirmatn';",
		"  src: url('vazirmatn/Vazirmatn-Regular.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Vazirmatn';",
		"  src: url('vazirmatn/Vazirmatn-Medium.woff2') format('woff2');",
		'  font-weight: 500;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Vazirmatn';",
		"  src: url('vazirmatn/Vazirmatn-Bold.woff2') format('woff2');",
		'  font-weight: 700;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Fira Code';",
		"  src: url('fira-code/FiraCode-Regular.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Fira Code';",
		"  src: url('fira-code/FiraCode-Medium.woff2') format('woff2');",
		'  font-weight: 500;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}'
	].join('\n');
	fs.writeFileSync(path.join(fontsDir, 'fonts.css'), fontsCss);
}

async function main() {
	ensureDir(vendor);

	const nm = path.join(root, 'node_modules');
	copyFile(
		path.join(nm, 'html-to-image', 'dist', 'html-to-image.js'),
		path.join(vendor, 'html-to-image', 'html-to-image.js')
	);
	copyFile(
		path.join(nm, 'mermaid', 'dist', 'mermaid.min.js'),
		path.join(vendor, 'mermaid', 'mermaid.min.js')
	);
	copyFile(
		path.join(nm, 'katex', 'dist', 'katex.min.js'),
		path.join(vendor, 'katex', 'katex.min.js')
	);
	copyFile(
		path.join(nm, 'katex', 'dist', 'katex.min.css'),
		path.join(vendor, 'katex', 'katex.min.css')
	);
	copyFile(
		path.join(nm, 'dompurify', 'dist', 'purify.min.js'),
		path.join(vendor, 'dompurify', 'purify.min.js')
	);

	const prismRoot = path.join(nm, 'prismjs');
	copyFile(path.join(prismRoot, 'prism.js'), path.join(vendor, 'prism', 'prism.min.js'));
	copyDir(path.join(prismRoot, 'themes'), path.join(vendor, 'prism', 'themes'));
	copyDir(path.join(prismRoot, 'components'), path.join(vendor, 'prism', 'components'));
	copyDir(path.join(prismRoot, 'plugins'), path.join(vendor, 'prism', 'plugins'));

	await downloadFonts();

	console.log('Vendor assets copied to assets/vendor/');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
