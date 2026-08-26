import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import toIco from 'to-ico';

const root = process.cwd();
const logo = path.join(root, 'assets', 'brand', 'karnoweb-logo.png');
const pwaDir = path.join(root, 'assets', 'pwa');
const buildDir = path.join(root, 'build');

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

async function iconWithBackground(outPath, size, bg) {
	const pad = Math.round(size * 0.18);
	const inner = size - pad * 2;
	const logoBuf = await sharp(logo)
		.resize(inner, inner, { fit: 'contain', background: bg })
		.png()
		.toBuffer();

	await sharp({
		create: { width: size, height: size, channels: 4, background: bg }
	})
		.composite([{ input: logoBuf, gravity: 'center' }])
		.png()
		.toFile(outPath);
}

async function main() {
	if (!fs.existsSync(logo)) {
		throw new Error('Logo not found: ' + logo);
	}

	ensureDir(pwaDir);
	ensureDir(buildDir);

	await iconWithBackground(path.join(pwaDir, 'icon-192.png'), 192, { r: 24, g: 24, b: 27, alpha: 1 });
	await iconWithBackground(path.join(pwaDir, 'icon-512.png'), 512, { r: 24, g: 24, b: 27, alpha: 1 });
	await iconWithBackground(path.join(pwaDir, 'icon-512-maskable.png'), 512, { r: 67, g: 97, b: 238, alpha: 1 });
	await iconWithBackground(path.join(buildDir, 'icon.png'), 512, { r: 24, g: 24, b: 27, alpha: 1 });

	const icoSizes = [16, 32, 48, 64, 128, 256];
	const icoBuffers = [];
	for (const size of icoSizes) {
		const buf = await sharp(path.join(buildDir, 'icon.png'))
			.resize(size, size)
			.png()
			.toBuffer();
		icoBuffers.push(buf);
	}
	fs.writeFileSync(path.join(buildDir, 'icon.ico'), await toIco(icoBuffers));

	console.log('PWA and Electron icons generated.');
}

main().catch(function (err) {
	console.error(err);
	process.exit(1);
});
