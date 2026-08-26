import fs from 'node:fs';
import path from 'node:path';
import rcedit from 'rcedit';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const productName = pkg.build.productName || 'Markdown Tools';
const packRoot = path.join(root, '.build', 'electron');
const exe = path.join(packRoot, 'win-unpacked', productName + '.exe');
const iconCandidates = [
	path.join(root, 'build', 'icon.ico'),
	path.join(packRoot, '.icon-ico', 'icon.ico'),
	path.join(root, 'dist', '.icon-ico', 'icon.ico')
];

function resolveIcon() {
	for (const candidate of iconCandidates) {
		if (fs.existsSync(candidate)) return candidate;
	}
	throw new Error('Windows icon (.ico) not found. Run npm run vendor && npm run pack:win first.');
}

async function main() {
	if (!fs.existsSync(exe)) {
		throw new Error('Executable not found: ' + exe);
	}

	const version = String(pkg.version || '1.0.0');
	const parts = version.split('.').map(function (n) { return parseInt(n, 10) || 0; });
	while (parts.length < 4) parts.push(0);

	await rcedit(exe, {
		icon: resolveIcon(),
		'file-version': parts.join('.'),
		'product-version': parts.join('.'),
		'version-string': {
			FileDescription: productName,
			ProductName: productName,
			InternalName: 'MarkdownTools',
			OriginalFilename: productName + '.exe',
			CompanyName: pkg.author || 'karnoweb',
			LegalCopyright: pkg.build.copyright || ''
		}
	});

	console.log('Patched Windows executable metadata:', exe);
}

main().catch(function (err) {
	console.error(err);
	process.exit(1);
});
