const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rtlmdDesktop', {
	onOpenFile: function (callback) {
		if (typeof callback !== 'function') return;
		ipcRenderer.on('rtlmd:open-file', function (_event, payload) {
			callback(payload);
		});
	},
	saveFile: function (filePath, content) {
		return ipcRenderer.invoke('rtlmd:save-file', {
			path: filePath,
			content: typeof content === 'string' ? content : ''
		});
	}
});
