/* ── 70-backup-folder.js ──
   JSON backup export/import, open-folder-from-disk. */
	function exportBackup() {
		if (!api) return;
		var payload = {
			version: 1,
			exportedAt: Date.now(),
			docs: api.docsState.items
		};
		api.downloadFile(JSON.stringify(payload, null, 2), 'markdown-tools-backup.json', 'application/json');
	}

	function importBackup(file) {
		if (!api || !file) return;
		file.text().then(function (text) {
			var data = JSON.parse(text);
			if (!data || !Array.isArray(data.docs)) throw new Error('invalid');
			if (!window.confirm('Replace all local documents with backup?')) return;
			api.writeDocs(data.docs.map(function (d) {
				return {
					id: d.id || api.uid(),
					title: d.title || api.UNTITLED,
					content: d.content || '',
					pinned: !!d.pinned,
					sourcePath: d.sourcePath || null,
					titleLocked: !!d.titleLocked,
					lastSavedToDisk: typeof d.lastSavedToDisk === 'string' ? d.lastSavedToDisk : null,
					snapshots: Array.isArray(d.snapshots) ? d.snapshots : [],
					updatedAt: d.updatedAt || Date.now(),
					createdAt: d.createdAt || Date.now()
				};
			}));
			var first = api.docsState.items[0];
			if (first) api.loadDocIntoEditor(first);
			api.renderDocList();
		}).catch(function () {
			window.alert('Invalid backup file.');
		});
	}

	async function openFolderFromDisk() {
		if (!api) return;
		if (typeof window.showDirectoryPicker !== 'function') {
			window.alert('Folder open needs Chrome/Edge File System Access API.');
			return;
		}
		try {
			var dir = await window.showDirectoryPicker({ mode: 'read' });
			var entries = [];
			for await (var entry of dir.values()) {
				if (entry.kind === 'file' && /\.(md|markdown|mdown|mkd|mkdn)$/i.test(entry.name)) {
					entries.push(entry);
				}
			}
			for (var i = 0; i < entries.length; i++) {
				var file = await entries[i].getFile();
				var content = await file.text();
				api.openExternalMarkdownFile({
					path: entries[i].name,
					name: entries[i].name.replace(/\.(md|markdown|mdown|mkd|mkdn)$/i, ''),
					content: content,
					handle: null
				});
			}
		} catch (err) {
			if (err && err.name === 'AbortError') return;
			window.alert('Could not open folder.');
		}
	}
