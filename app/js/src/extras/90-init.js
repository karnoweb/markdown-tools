/* ── 90-init.js ──
   Preview-post hook composition, global UI bindings, initRtlmdExtras(). */
	function hookRenderPreview() {
		window.rtlmdAfterPreview = function () {
			renderFrontMatterBanner();
			// Always (re)build the TOC list, even when the setting is off —
			// otherwise the toggle button/panel has nothing to show once re-enabled.
			buildTocFromHtml();
			updateWordCount();
			syncLineNumbers();
		};
	}

	function bindUi() {
		document.getElementById('btn-settings').addEventListener('click', openSettings);
		var tocCloseBtn = document.getElementById('toc-close');
		if (tocCloseBtn) tocCloseBtn.addEventListener('click', closeToc);
		var tocToggleBtn = document.getElementById('toc-toggle');
		if (tocToggleBtn) tocToggleBtn.addEventListener('click', toggleToc);
		document.getElementById('settings-form').addEventListener('submit', function (e) {
			e.preventDefault();
			saveSettingsFromDialog();
		});
		document.getElementById('btn-find-toggle').addEventListener('click', function () {
			var panel = document.getElementById('find-panel');
			toggleFindPanel(panel && panel.classList.contains('hidden'));
		});
		document.getElementById('find-next').addEventListener('click', function () { runFind('next'); });
		document.getElementById('find-prev').addEventListener('click', function () { runFind('prev'); });
		document.getElementById('find-replace-one').addEventListener('click', function () { runReplace(false); });
		document.getElementById('find-replace-all').addEventListener('click', function () { runReplace(true); });
		document.getElementById('find-close').addEventListener('click', function () { toggleFindPanel(false); });

		document.getElementById('doc-search').addEventListener('input', function () {
			filterDocList(this.value);
		});

		document.getElementById('doc-open-folder').addEventListener('click', openFolderFromDisk);
		document.getElementById('doc-backup-export').addEventListener('click', exportBackup);
		document.getElementById('doc-backup-import').addEventListener('change', function (e) {
			var f = e.target.files && e.target.files[0];
			if (f) importBackup(f);
			e.target.value = '';
		});

		document.getElementById('doc-template').addEventListener('change', function () {
			var key = this.value;
			if (!key || !api) return;
			api.createDoc(TEMPLATES[key] || TEMPLATES.blank, null, {});
			this.value = '';
		});

		document.getElementById('btn-snapshot').addEventListener('click', function () {
			var doc = api.findDoc(api.docsState.activeId);
			if (!doc) return;
			api.persistActiveFromEditor({ silentList: true });
			pushSnapshot(doc, 'manual');
			window.alert(t('snapshotSaved'));
		});
		document.getElementById('btn-restore-snapshot').addEventListener('click', openSnapshotDialog);

		document.addEventListener('keydown', function (e) {
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
				e.preventDefault();
				toggleFindPanel(true);
			}
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyH') {
				e.preventDefault();
				toggleFindPanel(true);
				var rep = document.getElementById('replace-input');
				if (rep) rep.focus();
			}
		});

		var ta = document.querySelector('#textbox textarea');
		if (ta) {
			ta.addEventListener('keydown', function (e) {
				if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
				e.preventDefault();
				var start = ta.selectionStart;
				var end = ta.selectionEnd;
				var val = ta.value;
				var insert = '  ';
				ta.value = val.slice(0, start) + insert + val.slice(end);
				ta.selectionStart = ta.selectionEnd = start + insert.length;
				if (api) api.onEditorChange();
			});
		}
	}

	window.rtlmdOnDiskSaved = function (doc) {
		if (!doc || doc.pinned) return;
		var snaps = doc.snapshots || [];
		if (snaps[0] && snaps[0].content === doc.content) return;
		pushSnapshot(doc, 'disk-save');
	};

	window.initRtlmdExtras = function (rtlmdApi) {
		api = rtlmdApi;
		hookRenderPreview();
		applyI18n();
		applySpellcheckPref();
		setupAutosave();
		bindUi();
		bindImagePasteDrop();
		bindLineNumbers();
		syncLineNumbers();
		updateWordCount();
		syncTocVisibility();
		if (api.renderPreview) api.renderPreview();
	};
