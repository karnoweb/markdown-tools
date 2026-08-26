const { app, BrowserWindow, shell, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const APP_ROOT = path.join(__dirname, '..');
const MD_EXT = /\.(md|markdown|mdown|mkd|mkdn)$/i;
const APP_USER_MODEL_ID = 'ir.karnoweb.markdown-tools';

let mainWindow = null;
const fileOpenQueue = [];

if (process.platform === 'win32') {
	app.setAppUserModelId(APP_USER_MODEL_ID);
}

function isMarkdownPath(filePath) {
	return typeof filePath === 'string' && MD_EXT.test(filePath);
}

function normalizeIncomingPath(raw) {
	if (!raw || typeof raw !== 'string') return '';
	let value = raw.trim().replace(/^"+|"+$/g, '');
	if (!value || value.startsWith('-')) return '';
	if (/\.exe$/i.test(value) && !MD_EXT.test(value)) return '';
	return value;
}

function collectMarkdownPaths(argv) {
	const seen = new Set();
	const paths = [];

	function add(rawPath) {
		const cleaned = normalizeIncomingPath(rawPath);
		if (!cleaned || !isMarkdownPath(cleaned)) return;
		const abs = path.isAbsolute(cleaned)
			? path.normalize(cleaned)
			: path.resolve(cleaned);
		const key = abs.toLowerCase();
		if (seen.has(key)) return;
		if (!fs.existsSync(abs)) return;
		seen.add(key);
		paths.push(abs);
	}

	(argv || []).forEach(add);

	if (!paths.length && process.platform === 'win32') {
		for (let i = (argv || []).length - 1; i >= 0; i--) {
			add(argv[i]);
			if (paths.length) break;
		}
	}

	return paths;
}

function enqueueMarkdownFile(filePath) {
	if (!isMarkdownPath(filePath)) return;
	const abs = path.resolve(filePath);
	if (fileOpenQueue.indexOf(abs) !== -1) return;
	fileOpenQueue.push(abs);
	processFileQueue();
}

function readMarkdownFile(filePath) {
	const abs = path.resolve(filePath);
	const content = fs.readFileSync(abs, 'utf8');
	const base = path.basename(abs, path.extname(abs));
	return { path: abs, content: content, name: base };
}

function sendOpenFile(payload) {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	mainWindow.webContents.send('rtlmd:open-file', payload);
}

function processFileQueue() {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	if (mainWindow.webContents.isLoading()) return;

	while (fileOpenQueue.length) {
		const fp = fileOpenQueue.shift();
		try {
			sendOpenFile(readMarkdownFile(fp));
		} catch (err) {
			dialog.showErrorBox(
				'Could not open file',
				fp + '\n\n' + (err && err.message ? err.message : String(err))
			);
		}
	}
}

function queueStartupFiles(argv) {
	collectMarkdownPaths(argv || process.argv.slice(1)).forEach(enqueueMarkdownFile);
}

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 840,
		minWidth: 720,
		minHeight: 480,
		title: 'Markdown Tools',
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true
		}
	});

	mainWindow.loadFile(path.join(APP_ROOT, 'index.html'));

	mainWindow.webContents.once('did-finish-load', function () {
		setTimeout(processFileQueue, 50);
	});

	mainWindow.webContents.setWindowOpenHandler(function (details) {
		shell.openExternal(details.url);
		return { action: 'deny' };
	});

	mainWindow.on('closed', function () {
		mainWindow = null;
	});
}

ipcMain.handle('rtlmd:save-file', function (_event, payload) {
	if (!payload || !payload.path) {
		throw new Error('No file path');
	}
	const abs = path.resolve(payload.path);
	const content = typeof payload.content === 'string' ? payload.content : '';
	fs.writeFileSync(abs, content, 'utf8');
	return { path: abs, savedAt: Date.now() };
});

const gotLock = app.requestSingleInstanceLock({ appId: APP_USER_MODEL_ID });
if (!gotLock) {
	app.quit();
} else {
	app.on('second-instance', function (_event, commandLine) {
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
		}
		queueStartupFiles(Array.isArray(commandLine) ? commandLine : []);
	});

	app.on('open-file', function (event, filePath) {
		event.preventDefault();
		enqueueMarkdownFile(filePath);
	});

	app.whenReady().then(function () {
		createWindow();
		queueStartupFiles(process.argv.slice(1));
	});

	app.on('window-all-closed', function () {
		if (process.platform !== 'darwin') app.quit();
	});

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
}
