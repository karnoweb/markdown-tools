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
	const sahelDir = path.join(fontsDir, 'sahel');
	const shabnamDir = path.join(fontsDir, 'shabnam');
	const samimDir = path.join(fontsDir, 'samim');
	const parastooDir = path.join(fontsDir, 'parastoo');
	const estedadDir = path.join(fontsDir, 'estedad');
	const tanhaDir = path.join(fontsDir, 'tanha');
	const gandomDir = path.join(fontsDir, 'gandom');
	const nahidDir = path.join(fontsDir, 'nahid');
	const mikhakDir = path.join(fontsDir, 'mikhak');
	const nikaDir = path.join(fontsDir, 'nika');
	const aradDir = path.join(fontsDir, 'arad');
	const behdadDir = path.join(fontsDir, 'behdad');
	const ganjnameDir = path.join(fontsDir, 'ganjname');
	const shahabDir = path.join(fontsDir, 'shahab');
	ensureDir(vazirDir);
	ensureDir(firaDir);
	ensureDir(sahelDir);
	ensureDir(shabnamDir);
	ensureDir(samimDir);
	ensureDir(parastooDir);
	ensureDir(estedadDir);
	ensureDir(tanhaDir);
	ensureDir(gandomDir);
	ensureDir(nahidDir);
	ensureDir(mikhakDir);
	ensureDir(nikaDir);
	ensureDir(aradDir);
	ensureDir(behdadDir);
	ensureDir(ganjnameDir);
	ensureDir(shahabDir);

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

	const extraPersian = [
		[path.join(sahelDir, 'Sahel.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/sahel-font@v3.4.0/dist/Sahel.woff2'],
		[path.join(sahelDir, 'Sahel-Bold.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/sahel-font@v3.4.0/dist/Sahel-Bold.woff2'],
		[path.join(shabnamDir, 'Shabnam.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/Shabnam.woff2'],
		[path.join(shabnamDir, 'Shabnam-Bold.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/Shabnam-Bold.woff2'],
		[path.join(samimDir, 'Samim.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/Samim.woff2'],
		[path.join(samimDir, 'Samim-Bold.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/Samim-Bold.woff2'],
		[path.join(parastooDir, 'Parastoo.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/parastoo-font@v2.0.1/dist/Parastoo.woff2'],
		[path.join(parastooDir, 'Parastoo-Bold.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/parastoo-font@v2.0.1/dist/Parastoo-Bold.woff2'],
		[path.join(estedadDir, 'Estedad-Regular.woff2'), 'https://cdn.jsdelivr.net/gh/aminabedi68/Estedad@v7.3/fonts/webfonts/statics/Estedad-Regular.woff2'],
		[path.join(estedadDir, 'Estedad-Bold.woff2'), 'https://cdn.jsdelivr.net/gh/aminabedi68/Estedad@v7.3/fonts/webfonts/statics/Estedad-Bold.woff2'],
		[path.join(tanhaDir, 'Tanha.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/tanha-font@v0.10/dist/Tanha.woff2'],
		[path.join(gandomDir, 'Gandom.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/gandom-font@v0.8/dist/Gandom.woff2'],
		[path.join(nahidDir, 'Nahid.woff2'), 'https://cdn.jsdelivr.net/gh/rastikerdar/nahid-font@v0.3.0/dist/Nahid.woff2'],
		[path.join(mikhakDir, 'Mikhak-VF.woff2'), 'https://cdn.jsdelivr.net/gh/aminabedi68/Mikhak@v3.2/fonts/webfonts/variable/Mikhak[DSTY,KSHD,wght].woff2'],
		[path.join(mikhakDir, 'Mikhak-FD-VF.woff2'), 'https://cdn.jsdelivr.net/gh/aminabedi68/Mikhak@v3.2/fonts/webfonts/variable/Mikhak-FD[DSTY,KSHD,wght].woff2'],
		[path.join(estedadDir, 'Estedad-FD-VF.woff2'), 'https://cdn.jsdelivr.net/gh/aminabedi68/Estedad@v7.3/fonts/webfonts/variable/Estedad-FD[KSHD,wght].woff2'],
		[path.join(nikaDir, 'Nika-Regular.woff2'), 'https://cdn.jsdelivr.net/gh/font-store/NikaFont@v1.0.0/web/Nika-Regular.woff2'],
		[path.join(aradDir, 'Arad-VF.woff2'), 'https://cdn.jsdelivr.net/gh/MDarvishi5124/Arad@v1.010/fonts/variable/Arad-VF.woff2'],
		[path.join(behdadDir, 'Behdad-Regular.woff2'), 'https://cdn.jsdelivr.net/gh/font-store/BehdadFont@v0.0.3/web/Behdad-Regular.woff2'],
		[path.join(ganjnameDir, 'GanjNamehSans-Regular.woff2'), 'https://cdn.jsdelivr.net/gh/font-store/GanjnamehFont@v0.0.4/web/GanjNamehSans-Regular.woff2'],
		[path.join(shahabDir, 'Shahab-Regular.woff2'), 'https://cdn.jsdelivr.net/gh/font-store/ShahabFont@v0.0.2/web/Shahab-Regular.woff2']
	];
	for (const [dest, url] of extraPersian) {
		if (!fs.existsSync(dest)) await download(url, dest);
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
		"  font-family: 'Sahel';",
		"  src: url('sahel/Sahel.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Sahel';",
		"  src: url('sahel/Sahel-Bold.woff2') format('woff2');",
		'  font-weight: 700;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Shabnam';",
		"  src: url('shabnam/Shabnam.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Shabnam';",
		"  src: url('shabnam/Shabnam-Bold.woff2') format('woff2');",
		'  font-weight: 700;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Samim';",
		"  src: url('samim/Samim.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Samim';",
		"  src: url('samim/Samim-Bold.woff2') format('woff2');",
		'  font-weight: 700;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Parastoo';",
		"  src: url('parastoo/Parastoo.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Parastoo';",
		"  src: url('parastoo/Parastoo-Bold.woff2') format('woff2');",
		'  font-weight: 700;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Estedad';",
		"  src: url('estedad/Estedad-Regular.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Estedad';",
		"  src: url('estedad/Estedad-Bold.woff2') format('woff2');",
		'  font-weight: 700;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Tanha';",
		"  src: url('tanha/Tanha.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Gandom';",
		"  src: url('gandom/Gandom.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'IRANYekan';",
		"  src: url('iranyekan/iranyekanwebregular.woff') format('woff');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'IRANYekan';",
		"  src: url('iranyekan/iranyekanwebmedium.woff') format('woff');",
		'  font-weight: 500;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'IRANYekan';",
		"  src: url('iranyekan/iranyekanwebbold.woff') format('woff');",
		'  font-weight: 700;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Nahid';",
		"  src: url('nahid/Nahid.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Mikhak';",
		"  src: url('mikhak/Mikhak-VF.woff2') format('woff2');",
		'  font-weight: 100 900;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Mikhak FD';",
		"  src: url('mikhak/Mikhak-FD-VF.woff2') format('woff2');",
		'  font-weight: 100 900;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Estedad FD';",
		"  src: url('estedad/Estedad-FD-VF.woff2') format('woff2');",
		'  font-weight: 100 900;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Nika';",
		"  src: url('nika/Nika-Regular.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Arad';",
		"  src: url('arad/Arad-VF.woff2') format('woff2');",
		'  font-weight: 100 900;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Behdad';",
		"  src: url('behdad/Behdad-Regular.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'GanjNamehSans';",
		"  src: url('ganjname/GanjNamehSans-Regular.woff2') format('woff2');",
		'  font-weight: 400;',
		'  font-style: normal;',
		'  font-display: swap;',
		'}',
		'@font-face {',
		"  font-family: 'Shahab';",
		"  src: url('shahab/Shahab-Regular.woff2') format('woff2');",
		'  font-weight: 400;',
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

	copyFile(
		path.join(nm, 'turndown', 'lib', 'turndown.browser.umd.js'),
		path.join(vendor, 'turndown', 'turndown.min.js')
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
