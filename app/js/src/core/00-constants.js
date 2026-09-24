/* ── 00-constants.js ──
   Storage keys, vendor paths, theme/lang tables, tiny utils (normalizeLang, escapeHtml), content direction state. */

	var INIT_URL = 'initcontent.md';
	var STORAGE_KEY = 'rtlmd-content';
	var DOCS_KEY = 'rtlmd-docs';
	var ACTIVE_ID_KEY = 'rtlmd-active-id';
	var SIDEBAR_KEY = 'rtlmd-sidebar';
	var THEME_KEY = 'rtlmd-theme';
	var DIR_KEY = 'rtlmd-dir';
	var FONT_KEY = 'rtlmd-font-size';
	var FULLVIEW_KEY = 'rtlmd-fullview';
	var SCROLL_SYNC_KEY = 'rtlmd-scroll-sync';
	var PREFS_VER_KEY = 'rtlmd-prefs-ver';
	var PREFS_VER = '3';
	var MAX_DOCS = 40;
	var UNTITLED = 'Untitled';
	var MOBILE_MQ = '(max-width: 768px)';

	var pendingExternalFiles = [];
	/* In-memory File System Access handles (cannot survive JSON localStorage). */
	var fileHandlesByDocId = {};

	var MD_OPEN_TYPES = [
		{
			description: 'Markdown',
			accept: {
				'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'],
				'text/plain': ['.md', '.markdown', '.mdown', '.mkd', '.mkdn']
			}
		}
	];

	var DARK_THEMES = {
		dark: 1, night: 1, dracula: 1, dim: 1, nord: 1, sunset: 1,
		forest: 1, luxury: 1, coffee: 1, business: 1, halloween: 1,
		synthwave: 1, black: 1, cyberpunk: 1,
		'karnoweb-dark': 1
	};

	var VENDOR = 'assets/vendor/';
	var PRISM = VENDOR + 'prism/';
	var PRISM_THEME_DARK = PRISM + 'themes/prism-tomorrow.min.css';
	var PRISM_THEME_LIGHT = PRISM + 'themes/prism.min.css';

	var LANG_ALIASES = {
		js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash',
		shell: 'bash', yml: 'yaml', md: 'markdown', html: 'markup',
		xml: 'markup', svg: 'markup'
	};

	function normalizeLang(lang) {
		if (!lang) return '';
		lang = String(lang).toLowerCase().trim();
		// fence info like "php", "js title", "12:path/file.php"
		var ext = lang.match(/\.([a-z0-9+#]+)$/);
		if (ext) {
			lang = ext[1];
		} else {
			var parts = lang.split(/[:\s|/\\]+/).filter(Boolean);
			lang = parts.length ? parts[parts.length - 1] : lang;
		}
		return LANG_ALIASES[lang] || lang.replace(/[^a-z0-9+#.-]/gi, '');
	}

	/* Custom marked renderers own escaping — without this, <?php ... $table-> eats the DOM as a bogus comment. */
	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	var contentDir = 'ltr';

	function migratePrefsOnce() {
		/* ponytail: one-shot product defaults bump (LTR + system theme) */
		if (storageGet(PREFS_VER_KEY, '') === PREFS_VER) return;
		storageSet(THEME_KEY, 'system');
		storageSet(DIR_KEY, 'ltr');
		storageSet(PREFS_VER_KEY, PREFS_VER);
	}

	function dirAttr() {
		return ' dir="' + contentDir + '"';
	}
