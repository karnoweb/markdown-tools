/* ── 90-boot.js ──
   Global shortcuts, PWA install, service worker, public api object, startup. */
	function initUI() {
		migratePrefsOnce();
		initTheme();
		initDirection();
		initFontSize();
		initFullview();
		initScrollSync();
		initSidebar();
		initMobileView();
		bindDocsUi();

		$('#dir-toggle').on('change', function () {
			applyDirection(this.checked ? 'rtl' : 'ltr');
		});

		$('#theme-toggle').on('change', function () {
			applyTheme(this.checked ? 'karnoweb' : 'karnoweb-dark');
		});

		$('#palette-select').on('change', function () {
			applyTheme(this.value);
		});

		$('#font-size-toggle').on('change', function () {
			applyFontSize(this.checked ? 'large' : 'normal');
		});

		$('#fullview-toggle').on('change', function () {
			setFullview(this.checked);
		});

		$('#scroll-sync-toggle').on('change', function () {
			setScrollSync(this.checked);
		});

		$('[data-export]').on('click', function () {
			exportResult($(this).data('export'));
		});

		$(document).on('keydown', function (e) {
			/* ponytail: e.code (physical key, e.g. "KeyS") is layout-independent — e.key
			   depends on the active keyboard layout (Persian, Arabic, …) and can fail to
			   equal 's'/'o'/'n', silently skipping preventDefault() and letting the
			   browser's native Ctrl+S "Save Page" / Ctrl+O "Open File" dialog take over. */
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
				e.preventDefault();
				persistActiveFromEditor();
				saveActiveDocToDisk();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyO') {
				e.preventDefault();
				openMarkdownFromDisk();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.code === 'KeyN' && !e.shiftKey) {
				e.preventDefault();
				if (!confirmLeaveIfDiskDirty()) return;
				createDoc('# New document\n\n');
				return;
			}
			if (e.key === 'Escape') {
				if (isFullview()) {
					setFullview(false);
				} else if (isMobile() &&
					!document.documentElement.classList.contains('sidebar-collapsed')) {
					setSidebarOpen(false);
				}
			}
		});

		if (/[?&]selfcheck=1(?:&|$)/.test(location.search)) {
			runDocsSelfCheck();
		}
	}

	function isDesktopShell() {
		return /Electron\//.test(navigator.userAgent);
	}

	function initPaneSplitter() {
		var KEY = 'rtlmd.editorPaneWidth';
		var ws = document.getElementById('editor');
		var pane = document.getElementById('textbox');
		var handle = document.getElementById('pane-splitter');
		if (!ws || !pane || !handle) return;

		function clamp(p) { return Math.min(80, Math.max(15, p)); }
		function apply(p) { pane.style.flex = '0 0 ' + p + '%'; }

		var saved = parseFloat(storageGet(KEY, ''));
		if (saved > 0) apply(clamp(saved));

		handle.addEventListener('pointerdown', function (e) {
			if (e.button !== 0) return;
			e.preventDefault();
			var rect = ws.getBoundingClientRect();
			var pct = null;
			handle.setPointerCapture(e.pointerId);
			document.body.classList.add('is-resizing-panes');
			function move(ev) {
				pct = clamp(((ev.clientX - rect.left) / rect.width) * 100);
				apply(pct);
			}
			function up() {
				handle.removeEventListener('pointermove', move);
				handle.removeEventListener('pointerup', up);
				handle.removeEventListener('pointercancel', up);
				document.body.classList.remove('is-resizing-panes');
				if (pct !== null) storageSet(KEY, String(Math.round(pct * 10) / 10));
			}
			handle.addEventListener('pointermove', move);
			handle.addEventListener('pointerup', up);
			handle.addEventListener('pointercancel', up);
		});

		handle.addEventListener('dblclick', function () {
			pane.style.flex = '';
			storageSet(KEY, '');
		});
	}

	function registerServiceWorker() {
		if (isDesktopShell()) return;
		if (!('serviceWorker' in navigator)) return;
		window.addEventListener('load', function () {
			navigator.serviceWorker.register('sw.js').catch(function () {
				/* ponytail: SW needs http(s) — file:// and some hosts skip registration */
			});
		});
	}

	function buildRtlmdApi() {
		return {
			findDoc: findDoc,
			docsState: docsState,
			writeDocs: writeDocs,
			createDoc: createDoc,
			loadDocIntoEditor: loadDocIntoEditor,
			persistActiveFromEditor: persistActiveFromEditor,
			saveActiveDocToDisk: saveActiveDocToDisk,
			renderDocList: renderDocList,
			renderPreview: renderPreview,
			onEditorChange: onEditorChange,
			openMarkdownFromDisk: openMarkdownFromDisk,
			openExternalMarkdownFile: openExternalMarkdownFile,
			isActiveDocDiskDirty: isActiveDocDiskDirty,
			canWriteDocToDisk: canWriteDocToDisk,
			confirmLeaveIfDiskDirty: confirmLeaveIfDiskDirty,
			titleFromContent: titleFromContent,
			slugifyFilename: slugifyFilename,
			downloadFile: downloadFile,
			buildWordDocument: buildWordDocument,
			uid: uid,
			UNTITLED: UNTITLED,
			getEditor: function () { return $editor; },
			getContentDir: function () { return contentDir; },
			parseMarkdown: parseMarkdown,
			applyMdTool: applyMdTool
		};
	}

	$(document).ready(function () {
		bindEditorEvents();
		initUI();
		initDesktopBridge();
		if (typeof window.initRtlmdExtras === 'function') {
			window.initRtlmdExtras(buildRtlmdApi());
		}
		loadInitialContent();
		initPaneSplitter();
		registerServiceWorker();
	});
