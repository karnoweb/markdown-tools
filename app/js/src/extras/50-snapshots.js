/* ── 50-snapshots.js ──
   Document version snapshots + duplicate-doc hook. */
	function pushSnapshot(doc, label) {
		if (!doc || doc.pinned) return;
		doc.snapshots = doc.snapshots || [];
		var content = doc.content;
		if (api.getEditor && api.getEditor().length && doc.id === api.docsState.activeId) {
			content = api.getEditor().val();
		}
		doc.snapshots.unshift({
			at: Date.now(),
			label: label || '',
			content: content
		});
		if (doc.snapshots.length > MAX_SNAPSHOTS) doc.snapshots.length = MAX_SNAPSHOTS;
		api.writeDocs(api.docsState.items);
	}

	function restoreSnapshot(doc, snap) {
		if (!doc || !snap) return;
		if (!api.confirmLeaveIfDiskDirty()) return;
		doc.content = snap.content;
		doc.updatedAt = Date.now();
		api.writeDocs(api.docsState.items);
		if (doc.id === api.docsState.activeId) {
			api.loadDocIntoEditor(doc);
		} else {
			api.renderDocList();
		}
	}

	function openSnapshotDialog() {
		if (!api) return;
		var doc = api.findDoc(api.docsState.activeId);
		if (!doc) return;
		var snaps = doc.snapshots || [];
		if (!snaps.length) {
			window.alert(t('noSnapshots'));
			return;
		}
		var lines = snaps.map(function (s, i) {
			return (i + 1) + '. ' + new Date(s.at).toLocaleString() + (s.label ? ' — ' + s.label : '');
		}).join('\n');
		var pick = window.prompt(t('restoreSnapshot') + '\n\n' + lines, '1');
		if (pick === null) return;
		var idx = parseInt(pick, 10) - 1;
		if (isNaN(idx) || idx < 0 || idx >= snaps.length) return;
		restoreSnapshot(doc, snaps[idx]);
	}

	window.rtlmdDuplicateDoc = function (id) {
		if (!api) return;
		var src = api.findDoc(id);
		if (!src) return;
		api.createDoc(src.content, (src.title || api.UNTITLED) + ' (copy)', { titleLocked: true });
	};
