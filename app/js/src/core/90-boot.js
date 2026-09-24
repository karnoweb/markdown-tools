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

	function isStandalonePwa() {
		return window.matchMedia('(display-mode: standalone)').matches ||
			window.matchMedia('(display-mode: window-controls-overlay)').matches ||
			!!window.navigator.standalone;
	}

	function initPwaInstall() {
		if (isDesktopShell() || isStandalonePwa()) return;

		var btn = document.getElementById('pwa-install');
		if (!btn) return;

		var deferredInstall = null;

		window.addEventListener('beforeinstallprompt', function (e) {
			e.preventDefault();
			deferredInstall = e;
			btn.classList.remove('hidden');
		});

		btn.addEventListener('click', function () {
			if (!deferredInstall) {
				window.alert('Install from the browser menu:\nChrome/Edge → Install Markdown Tools\n(or ⋮ → Apps → Install this site as an app)');
				return;
			}
			deferredInstall.prompt();
			deferredInstall.userChoice.then(function () {
				deferredInstall = null;
				btn.classList.add('hidden');
			});
		});

		window.addEventListener('appinstalled', function () {
			deferredInstall = null;
			btn.classList.add('hidden');
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
		initPwaInstall();
		registerServiceWorker();
	});
