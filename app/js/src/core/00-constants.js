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
	var FONT_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'];
	var FONT_FAMILY_KEY = 'rtlmd-font-family';
	var FONT_FAMILIES = ['vazirmatn', 'iranyekan', 'sahel', 'shabnam', 'samim', 'estedad', 'estedad-fd', 'parastoo', 'tanha', 'nahid', 'gandom', 'mikhak', 'mikhak-fd', 'nika', 'arad', 'behdad', 'ganjname', 'shahab', 'tahoma', 'system'];
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
		'karnoweb-dark': 1,
		/* reading themes (generated in 00-tokens-base.css by scripts/gen-themes.mjs) */
		'github-dark': 1, 'github-dimmed': 1, 'one-dark': 1, 'tokyo-night': 1,
		'nord-polar': 1, 'dracula-night': 1, 'solarized-dark': 1, 'gruvbox-dark': 1,
		'rose-pine-moon': 1, 'catppuccin-mocha': 1, graphite: 1, 'oled-black': 1,
		'contrast-dark': 1
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

	var BARE_MERMAID_HEADER_RE = /^\s*(?:%%\{[\s\S]*?\}%%\s*)*(?:flowchart(?:\s+(?:TB|TD|BT|RL|LR))?|graph\s+(?:TB|TD|BT|RL|LR)|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|gantt|journey|gitGraph|pie(?:\s+showData)?|mindmap|timeline|quadrantChart|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/;

	function isBareMermaidBlock(text) {
		var s = String(text || '').trim();
		if (!s || s.indexOf('\n') === -1) return false;
		if (!BARE_MERMAID_HEADER_RE.test(s)) return false;
		return /-->|---|-\.-|==>|->>|-->>|\bsubgraph\b|\bparticipant\b|\bstate\b|\bsection\b|\|\|--|\}\|--/.test(s);
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

	/* ── Smart RTL / Bidi & Arrow helpers (inspired by AI RTL) ── */
	var RTL_CHAR_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
	var RTL_CHAR_GLOBAL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
	var LTR_CHAR_GLOBAL_RE = /[A-Za-z]/g;

	var UNICODE_ARROW_FLIP_MAP = {
		'→': '←',
		'⇒': '⇐',
		'⇛': '⇚',
		'⟶': '⟵',
		'⟹': '⟸',
		'➡': '⬅',
		'⮕': '⬅',
		'▶': '◀',
		'▷': '◁',
		'►': '◄',
		'▸': '◂',
		'▻': '◅',
		'⇨': '⇦',
		'⇾': '⇽',
		'↦': '↤',
		'↠': '↞',
		'↝': '↜',
		'↣': '↢',
		'⇀': '↼',
		'⇝': '⇜',
		'⇢': '⇠',
		'⤇': '⤆',
		'☞': '☜',
		'☛': '☚',
		'➜': '←',
		'➔': '←',
		'➝': '←',
		'➞': '←'
	};
	var UNICODE_ARROW_RE = new RegExp(Object.keys(UNICODE_ARROW_FLIP_MAP).join('|'), 'g');

	/* Technical tokens (acronyms like QR/RFID/API/OK, URLs, versions, numbers)
	   should not force LTR on a Persian sentence that starts with them. */
	function isTechnicalNeutralToken(token) {
		var clean = String(token || '').replace(/^[^\w\u0600-\u06FF]+|[^\w\u0600-\u06FF]+$/g, '');
		if (!clean) return true;
		if (RTL_CHAR_RE.test(clean)) return false;
		if (/^(?:https?:\/\/|www\.)\S+$/i.test(clean)) return true;
		if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return true;
		if (/^v?\d+(?:\.\d+)+(?:-[A-Za-z0-9._-]+)?$/i.test(clean)) return true;
		if (/^[\d\u06F0-\u06F9]+(?:[|/:.,%-][\d\u06F0-\u06F9A-Za-z]+)*$/.test(clean)) return true;
		if (/^[A-Z][A-Z0-9_-]{1,5}$/.test(clean)) return true;
		return false;
	}

	function detectSmartDir(text, fallbackDir) {
		var fb = fallbackDir || contentDir || 'ltr';
		var s = String(text || '').trim();
		if (!s) return fb;
		if (!RTL_CHAR_RE.test(s)) {
			var tokens = s.split(/\s+/);
			var hasRealLtrWord = false;
			for (var i = 0; i < tokens.length; i++) {
				if (/[A-Za-z]/.test(tokens[i]) && !isTechnicalNeutralToken(tokens[i])) {
					hasRealLtrWord = true;
					break;
				}
			}
			return hasRealLtrWord ? 'ltr' : fb;
		}
		var rtlMatches = s.match(RTL_CHAR_GLOBAL_RE);
		var rtlCount = rtlMatches ? rtlMatches.length : 0;
		var stripped = s.split(/\s+/).filter(function (tok) {
			return !isTechnicalNeutralToken(tok);
		}).join(' ');
		var ltrMatches = stripped.match(LTR_CHAR_GLOBAL_RE);
		var ltrCount = ltrMatches ? ltrMatches.length : 0;
		if (rtlCount >= ltrCount * 0.35) return 'rtl';
		var firstStrong = stripped.match(/[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFA-Za-z]/);
		if (firstStrong && RTL_CHAR_RE.test(firstStrong[0])) return 'rtl';
		return fb === 'rtl' && rtlCount > 0 ? 'rtl' : 'ltr';
	}

	function flipArrowsInRtlText(text) {
		var s = String(text || '');
		if (!s) return s;
		s = s.replace(UNICODE_ARROW_RE, function (m) {
			return UNICODE_ARROW_FLIP_MAP[m] || m;
		});
		s = s
			.replace(/(^|\s)==>(?=\s|$)/g, '$1<==')
			.replace(/(^|\s)-->(?=\s|$)/g, '$1<--')
			.replace(/(^|\s)=>(?=\s|$)/g, '$1<=')
			.replace(/(^|\s)->(?=\s|$)/g, '$1<-');
		/* Guard compound ASCII numeric tokens like 3|4500 so UBA does not reverse them to 4500|3 in RTL */
		s = s.replace(/\u200E?\b(\d+(?:[|/:.-]\d+)+)\b\u200E?/g, '\u200E$1\u200E');
		return s;
	}

	function isHalfSpaceEvent(e) {
		if (!e) return false;
		if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey &&
			(e.code === 'Digit2' || e.code === 'Numpad2' || e.key === '@' || e.key === '2')) {
			return true;
		}
		if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'Space') {
			return true;
		}
		return false;
	}

	function insertHalfSpaceInTextarea(ta, onChanged) {
		if (!ta) return;
		var start = ta.selectionStart;
		var end = ta.selectionEnd;
		var val = ta.value || '';
		ta.value = val.slice(0, start) + '\u200C' + val.slice(end);
		ta.selectionStart = ta.selectionEnd = start + 1;
		if (typeof onChanged === 'function') onChanged();
	}
