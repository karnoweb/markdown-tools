/* Markdown Tools — generated bundle. DO NOT EDIT BY HAND.
 * Built by `npm run build:js` (scripts/build-js-bundle.mjs).
 * Edit the sources under app/js/src/{core,extras}/ and rebuild.
 */
(function () {
'use strict';

/* ===== src: app/js/src/core/00-constants.js ===== */
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

/* ===== src: app/js/src/core/10-markdown.js ===== */
/* ── 10-markdown.js ──
   marked renderers, DOMPurify config, parseMarkdown(), storage helpers, theme-resolution helpers. */
	var renderer = new marked.Renderer();

	renderer.heading = function (text, level) {
		return '<h' + level + dirAttr() + '>' + text + '</h' + level + '>';
	};

	renderer.paragraph = function (text) {
		return '<p' + dirAttr() + '>' + text + '</p>';
	};

	renderer.blockquote = function (quote) {
		return '<blockquote' + dirAttr() + '>' + quote + '</blockquote>';
	};

	renderer.listitem = function (text) {
		return '<li' + dirAttr() + '>' + text + '</li>';
	};

	renderer.list = function (body, ordered) {
		var tag = ordered ? 'ol' : 'ul';
		return '<' + tag + dirAttr() + '>' + body + '</' + tag + '>';
	};

	renderer.table = function (header, body) {
		return '<div class="table-scroll" tabindex="0" role="region" aria-label="Table">' +
			'<table' + dirAttr() + '><thead>' + header + '</thead><tbody>' + body + '</tbody></table></div>';
	};

	renderer.tablerow = function (content) {
		return '<tr>' + content + '</tr>';
	};

	renderer.tablecell = function (content, flags) {
		var tag = flags.header ? 'th' : 'td';
		var align = flags.align ? ' style="text-align:' + flags.align + '"' : '';
		return '<' + tag + align + dirAttr() + '>' + content + '</' + tag + '>';
	};

	renderer.code = function (code, lang) {
		var norm = normalizeLang(lang);
		var safe = escapeHtml(code);
		if (norm === 'mermaid') {
			return '<div class="mermaid-wrap" dir="ltr"><pre class="mermaid">' + safe + '</pre></div>';
		}
		var langAttr = norm || 'none';
		var label = norm
			? '<span class="code-lang" dir="ltr">' + escapeHtml(norm) + '</span>'
			: '';
		return '<pre dir="ltr" class="code-block language-' + langAttr + '">' +
			label +
			'<code dir="ltr" class="language-' + langAttr + '">' + safe + '</code></pre>';
	};

	renderer.codespan = function (code) {
		/* marked already HTML-escapes codespan text — don't escapeHtml again */
		return '<code dir="ltr" class="codespan">' + code + '</code>';
	};

	renderer.link = function (href, title, text) {
		var titleAttr = title ? ' title="' + title + '"' : '';
		return '<a href="' + href + '"' + titleAttr + dirAttr() + '>' + text + '</a>';
	};

	renderer.hr = function () {
		return '<hr' + dirAttr() + '>';
	};

	marked.setOptions({
		renderer: renderer,
		gfm: true,
		breaks: false
	});

	/* Security: marked() passes raw HTML typed by the document author straight through
	   (by design — that's how <br>, embedded images, etc. keep working). If the *content*
	   comes from an untrusted source (a shared/downloaded .md file, a pasted snippet, …),
	   that raw HTML can carry <script>, on*="" handlers, or javascript: URLs. Every render
	   pass is sanitized with DOMPurify using an explicit allow-list matched to exactly what
	   this app's renderer/preprocessors emit — nothing more. */
	var MD_SANITIZE_CONFIG = {
		ALLOWED_TAGS: [
			'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'strong', 'em', 'del', 's', 'a', 'span', 'div',
			'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
			'table', 'thead', 'tbody', 'tr', 'th', 'td',
			'img', 'input'
		],
		ALLOWED_ATTR: [
			'dir', 'class', 'href', 'title', 'alt', 'src', 'style',
			'type', 'checked', 'disabled', 'id', 'target', 'rel',
			'role', 'aria-label', 'aria-hidden', 'tabindex'
		],
		ALLOW_DATA_ATTR: true
	};

	function sanitizeMarkdownHtml(html) {
		if (typeof window.DOMPurify === 'undefined' || typeof window.DOMPurify.sanitize !== 'function') {
			/* ponytail: fail closed — if the sanitizer failed to load, never show
			   unsanitized HTML; fall back to plain escaped text instead. */
			return escapeHtml(String(html || ''));
		}
		return window.DOMPurify.sanitize(String(html || ''), MD_SANITIZE_CONFIG);
	}

	function parseMarkdown(src) {
		if (typeof window.rtlmdPreprocessMarkdown === 'function') {
			src = window.rtlmdPreprocessMarkdown(src);
		}
		var html = marked.parse(src);
		html = sanitizeMarkdownHtml(html);
		if (typeof window.rtlmdPostprocessMarkdownHtml === 'function') {
			html = window.rtlmdPostprocessMarkdownHtml(html, src);
		}
		return html;
	}

	function confirmLeaveIfDiskDirty() {
		if (!isActiveDocDiskDirty()) return true;
		var msg = typeof window.rtlmdT === 'function'
			? window.rtlmdT('unsavedDiskLeave')
			: 'This file has unsaved changes on disk. Leave anyway?';
		return window.confirm(msg);
	}

	function storageGet(key, fallback) {
		try {
			var v = localStorage.getItem(key);
			return v !== null ? v : fallback;
		} catch (e) {
			return fallback;
		}
	}

	function storageSet(key, val) {
		try {
			localStorage.setItem(key, val);
			return true;
		} catch (e) {
			/* ponytail: quota exceeded or private-mode storage block — the caller MUST
			   check this return value. Silently swallowing this here (as before) made
			   writeDocs() believe a failed save had succeeded, risking silent data loss. */
			if (window.console && console.warn) {
				console.warn('[rtlmd] localStorage write failed for key "' + key + '":', e);
			}
			return false;
		}
	}

	function isDarkTheme(theme) {
		return !!DARK_THEMES[theme];
	}

	function resolveTheme(pref) {
		if (!pref || pref === 'system') {
			return window.matchMedia('(prefers-color-scheme: dark)').matches
				? 'karnoweb-dark'
				: 'karnoweb';
		}
		return pref;
	}

	function getThemePref() {
		return storageGet(THEME_KEY, 'system');
	}

	function applyPrismTheme(/* resolvedTheme */) {
		var link = document.getElementById('prism-theme');
		if (!link) return;
		// ponytail: code blocks always dark bg — one prism theme is enough
		link.href = PRISM_THEME_DARK;
	}

	function getMermaidTheme() {
		return isDarkTheme(resolveTheme(getThemePref())) ? 'dark' : 'default';
	}

/* ===== src: app/js/src/core/20-code-mermaid.js ===== */
/* ── 20-code-mermaid.js ──
   Code bidi enhancement, Prism highlight, mermaid render + zoom/toolbar + fullscreen. */
	/* Persian/Arabic runs; spaces only when next char is also Arabic (keeps Latin tokens out) */
	var BIDI_RUN_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF](?:[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u200c\u200d،؛؟:!.,…]|\s+(?=[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]))*/g;

	function enhanceCodeBidi(codeEl) {
		if (!codeEl || codeEl.nodeType !== 1) return;
		if (codeEl.querySelector(':scope > .token bdi.code-bidi, :scope > bdi.code-bidi, bdi.code-bidi')) {
			/* already wrapped for current highlight output */
			return;
		}
		var walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT, null);
		var nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			var text = node.nodeValue;
			if (!text || text.search(/[\u0600-\u06FF]/) === -1) continue;
			BIDI_RUN_RE.lastIndex = 0;
			if (!BIDI_RUN_RE.test(text)) continue;
			BIDI_RUN_RE.lastIndex = 0;
			var frag = document.createDocumentFragment();
			var last = 0;
			var m;
			while ((m = BIDI_RUN_RE.exec(text))) {
				if (m.index > last) {
					frag.appendChild(document.createTextNode(text.slice(last, m.index)));
				}
				var bdi = document.createElement('bdi');
				bdi.className = 'code-bidi';
				bdi.textContent = m[0];
				frag.appendChild(bdi);
				last = m.index + m[0].length;
			}
			if (last < text.length) {
				frag.appendChild(document.createTextNode(text.slice(last)));
			}
			node.parentNode.replaceChild(frag, node);
		}
	}

	function highlightCode() {
		if (typeof Prism === 'undefined') return;
		if (!Prism._rtlmdBidiHook && Prism.hooks) {
			Prism._rtlmdBidiHook = true;
			Prism.hooks.add('after-highlight', function (env) {
				if (env && env.element) enhanceCodeBidi(env.element);
			});
		}
		$('#output pre.code-block code').each(function () {
			try {
				Prism.highlightElement(this);
				/* ponytail: autoloader may skip after-highlight when lang already in DOM */
				enhanceCodeBidi(this);
			} catch (e) {
				/* ponytail: skip blocks whose language/plugin is missing */
			}
		});
	}

	function renderMermaid() {
		if (typeof mermaid === 'undefined') return;
		var nodes = document.querySelectorAll('#output pre.mermaid');
		if (!nodes.length) return;
		try {
			mermaid.initialize({
				startOnLoad: false,
				theme: getMermaidTheme(),
				securityLevel: 'loose',
				fontFamily: 'Vazirmatn, Tahoma, sans-serif'
			});
			mermaid.run({ nodes: nodes }).then(function () {
				enhanceMermaidDiagrams();
				if (scrollSyncOn) refreshScrollMaps();
			}).catch(function () {
				/* ponytail: bad diagram syntax — source stays visible in pre */
			});
		} catch (e) { /* ponytail: mermaid unavailable */ }
	}

	function enhanceMermaidDiagrams() {
		document.querySelectorAll('#output .mermaid-wrap').forEach(function (wrap) {
			if (wrap.dataset.mermaidEnhanced === '1') return;
			var svg = wrap.querySelector('svg');
			if (!svg) return;
			wrap.dataset.mermaidEnhanced = '1';

			var toolbar = document.createElement('div');
			toolbar.className = 'mermaid-toolbar';
			toolbar.setAttribute('role', 'toolbar');
			toolbar.setAttribute('aria-label', 'Diagram zoom');
			toolbar.innerHTML =
				'<button type="button" class="mermaid-zoom-btn" data-action="out" title="Zoom out" aria-label="Zoom out">−</button>' +
				'<button type="button" class="mermaid-zoom-btn mermaid-zoom-btn--label" data-action="reset" title="Reset zoom" aria-label="Reset zoom">100%</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-action="in" title="Zoom in" aria-label="Zoom in">+</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-action="fit" title="Fit width" aria-label="Fit width">Fit</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-action="full" title="Fullscreen" aria-label="Fullscreen">⛶</button>';

			var viewport = document.createElement('div');
			viewport.className = 'mermaid-viewport';
			var stage = document.createElement('div');
			stage.className = 'mermaid-stage';

			wrap.insertBefore(toolbar, svg);
			wrap.insertBefore(viewport, svg);
			stage.appendChild(svg);
			viewport.appendChild(stage);

			var scale = 1;
			var minScale = 0.2;
			var maxScale = 5;
			var pinchStart = 0;

			function labelBtn() {
				return toolbar.querySelector('[data-action="reset"]');
			}

			function applyScale(next, origin) {
				scale = Math.min(maxScale, Math.max(minScale, next));
				stage.style.transform = 'scale(' + scale + ')';
				var btn = labelBtn();
				if (btn) btn.textContent = Math.round(scale * 100) + '%';
				if (origin) stage.style.transformOrigin = origin;
			}

			function fitWidth() {
				var vw = Math.max(viewport.clientWidth - 8, 1);
				var rect = svg.getBoundingClientRect();
				var baseWidth = rect.width / scale;
				if (baseWidth > 0) applyScale(Math.min(1, vw / baseWidth), 'top center');
			}

			toolbar.addEventListener('click', function (e) {
				var btn = e.target.closest('[data-action]');
				if (!btn) return;
				var action = btn.getAttribute('data-action');
				if (action === 'in') applyScale(scale * 1.2, 'top center');
				if (action === 'out') applyScale(scale / 1.2, 'top center');
				if (action === 'reset') applyScale(1, 'top center');
				if (action === 'fit') fitWidth();
				if (action === 'full') openMermaidFullscreen(wrap, stage, toolbar, applyScale, fitWidth, function () { return scale; });
			});

			viewport.addEventListener('wheel', function (e) {
				if (!e.ctrlKey && !e.metaKey) return;
				e.preventDefault();
				applyScale(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 'top center');
			}, { passive: false });

			viewport.addEventListener('touchstart', function (e) {
				if (e.touches.length === 2) pinchStart = pinchDistance(e.touches);
			}, { passive: true });

			viewport.addEventListener('touchmove', function (e) {
				if (e.touches.length !== 2 || !pinchStart) return;
				e.preventDefault();
				var dist = pinchDistance(e.touches);
				applyScale(scale * (dist / pinchStart), 'top center');
				pinchStart = dist;
			}, { passive: false });

			viewport.addEventListener('touchend', function () {
				pinchStart = 0;
			});

			if (window.matchMedia('(max-width: 768px)').matches) {
				requestAnimationFrame(fitWidth);
			}
		});
	}

	function pinchDistance(touches) {
		var dx = touches[0].clientX - touches[1].clientX;
		var dy = touches[0].clientY - touches[1].clientY;
		return Math.hypot(dx, dy);
	}

	function openMermaidFullscreen(wrap, stage, toolbar, applyScale, fitWidth, getScale) {
		var overlay = document.createElement('div');
		overlay.className = 'mermaid-fullscreen';
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', 'Diagram preview');

		var panel = document.createElement('div');
		panel.className = 'mermaid-fullscreen-panel';

		var head = document.createElement('div');
		head.className = 'mermaid-fullscreen-head';
		head.innerHTML = '<span>Diagram</span>';

		var closeBtn = document.createElement('button');
		closeBtn.type = 'button';
		closeBtn.className = 'mermaid-zoom-btn';
		closeBtn.textContent = '✕';
		closeBtn.setAttribute('aria-label', 'Close');
		closeBtn.addEventListener('click', close);
		head.appendChild(closeBtn);

		var cloneToolbar = toolbar.cloneNode(true);
		var cloneViewport = document.createElement('div');
		cloneViewport.className = 'mermaid-viewport mermaid-viewport--full';
		var cloneStage = stage.cloneNode(true);
		cloneStage.style.transform = stage.style.transform || 'scale(1)';
		cloneViewport.appendChild(cloneStage);

		var fsScale = getScale();
		function fsApply(next) {
			fsScale = Math.min(5, Math.max(0.2, next));
			cloneStage.style.transform = 'scale(' + fsScale + ')';
			var reset = cloneToolbar.querySelector('[data-action="reset"]');
			if (reset) reset.textContent = Math.round(fsScale * 100) + '%';
		}

		cloneToolbar.addEventListener('click', function (e) {
			var btn = e.target.closest('[data-action]');
			if (!btn) return;
			var action = btn.getAttribute('data-action');
			if (action === 'in') fsApply(fsScale * 1.2);
			if (action === 'out') fsApply(fsScale / 1.2);
			if (action === 'reset') fsApply(1);
			if (action === 'fit') {
				var svg = cloneStage.querySelector('svg');
				if (!svg) return;
				var vw = Math.max(cloneViewport.clientWidth - 8, 1);
				var base = svg.getBoundingClientRect().width / fsScale;
				if (base > 0) fsApply(Math.min(1, vw / base));
			}
			if (action === 'full') close();
		});

		panel.appendChild(head);
		panel.appendChild(cloneToolbar);
		panel.appendChild(cloneViewport);
		overlay.appendChild(panel);
		document.body.appendChild(overlay);
		document.body.classList.add('mermaid-fullscreen-open');

		function close() {
			overlay.remove();
			document.body.classList.remove('mermaid-fullscreen-open');
			document.removeEventListener('keydown', onKey);
		}

		function onKey(e) {
			if (e.key === 'Escape') close();
		}

		document.addEventListener('keydown', onKey);
		overlay.addEventListener('click', function (e) {
			if (e.target === overlay) close();
		});

		requestAnimationFrame(function () {
			var fitBtn = cloneToolbar.querySelector('[data-action="fit"]');
			if (fitBtn) fitBtn.click();
		});
	}

/* ===== src: app/js/src/core/30-view-state.js ===== */
/* ── 30-view-state.js ──
   Theme, direction, font size, full-view, scroll-sync engine, sidebar, mobile view. */
	function applyTheme(pref) {
		var resolved = resolveTheme(pref);
		document.documentElement.setAttribute('data-theme', resolved);
		$('#palette-select').val(pref);
		$('#theme-toggle').prop('checked', !isDarkTheme(resolved));
		applyPrismTheme(resolved);
		storageSet(THEME_KEY, pref);
		renderPreview();
	}

	function initTheme() {
		applyTheme(getThemePref());

		window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
			if (getThemePref() === 'system') {
				applyTheme('system');
			}
		});
	}

	function applyDirection(dir, skipRender) {
		contentDir = dir;
		var rtl = dir === 'rtl';
		/* layout stays LTR so Editor | Preview panes do not swap */
		$('#editor').attr('dir', 'ltr');
		$('#textbox textarea').attr('dir', dir);
		$('#output').attr('dir', dir);
		$('#dir-toggle').prop('checked', rtl);
		$('#dir-toggle').closest('label')
			.attr('title', rtl ? 'Switch to left to right' : 'Switch to right to left')
			.toggleClass('btn-active', rtl);
		storageSet(DIR_KEY, dir);
		if (!skipRender) {
			renderPreview();
		}
	}

	function initDirection() {
		applyDirection(storageGet(DIR_KEY, 'ltr'), true);
	}

	function applyFontSize(size) {
		var large = size === 'large';
		document.documentElement.classList.toggle('font-large', large);
		$('#font-size-toggle').prop('checked', large);
		$('#font-size-toggle').closest('label')
			.toggleClass('btn-active', large)
			.attr('title', large ? 'Zoom out text' : 'Zoom in text');
		storageSet(FONT_KEY, size);
	}

	function initFontSize() {
		applyFontSize(storageGet(FONT_KEY, 'normal'));
	}

	function setFullview(on) {
		$('body').toggleClass('fullview', on);
		$('#fullview-toggle').prop('checked', on);
		$('#fullview-toggle').closest('label')
			.attr('title', on ? 'Exit full preview' : 'Full preview')
			.toggleClass('btn-active', on);
		if (on && isMobile()) {
			setMobileView('preview');
		}
		storageSet(FULLVIEW_KEY, on ? '1' : '0');
		if (typeof window.rtlmdOnFullviewChange === 'function') {
			window.rtlmdOnFullviewChange(on);
		}
	}

	function isFullview() {
		return $('body').hasClass('fullview');
	}

	function initFullview() {
		setFullview(storageGet(FULLVIEW_KEY, '0') === '1');
	}

	var scrollSyncOn = false;
	var syncingScroll = false;
	var scrollMapReady = false;
	var editorLineYs = null; /* 1-based: Y at start of each source line; [lines+1]=end */
	var $scrollMirror = null;

	function lineAtIndex(src, index) {
		var n = 1;
		var end = Math.min(index, src.length);
		for (var i = 0; i < end; i++) {
			if (src.charCodeAt(i) === 10) n++;
		}
		return n;
	}

	/* Top-level marked tokens → #output children (skip space). */
	function sourceBlockRanges(src) {
		var tokens = marked.lexer(src || '');
		var ranges = [];
		var offset = 0;
		for (var i = 0; i < tokens.length; i++) {
			var raw = tokens[i].raw || '';
			if (tokens[i].type !== 'space') {
				var start = lineAtIndex(src, offset);
				var last = offset + raw.length;
				while (last > offset && src.charCodeAt(last - 1) === 10) last--;
				ranges.push({ start: start, end: lineAtIndex(src, Math.max(offset, last - 1)) });
			}
			offset += raw.length;
		}
		return ranges;
	}

	function annotatePreviewBlocks(src) {
		var out = document.getElementById('output');
		if (!out) return false;
		var ranges = sourceBlockRanges(src);
		var kids = out.children;
		var n = Math.min(kids.length, ranges.length);
		for (var i = 0; i < kids.length; i++) {
			kids[i].removeAttribute('data-line-start');
			kids[i].removeAttribute('data-line-end');
		}
		if (!n || kids.length !== ranges.length) {
			scrollMapReady = false;
			return false;
		}
		for (var j = 0; j < n; j++) {
			kids[j].setAttribute('data-line-start', String(ranges[j].start));
			kids[j].setAttribute('data-line-end', String(ranges[j].end));
		}
		return true;
	}

	function ensureScrollMirror() {
		if ($scrollMirror && $scrollMirror.length) return $scrollMirror[0];
		var el = document.createElement('div');
		el.id = 'scroll-sync-mirror';
		el.setAttribute('aria-hidden', 'true');
		document.body.appendChild(el);
		$scrollMirror = $(el);
		return el;
	}

	function rebuildEditorLineYs() {
		if (!$editor || !$editor.length) {
			editorLineYs = null;
			return;
		}
		var ta = $editor[0];
		var src = ta.value;
		var lines = src.split('\n');
		var mirror = ensureScrollMirror();
		var cs = window.getComputedStyle(ta);
		var padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
		mirror.style.width = Math.max(0, ta.clientWidth - padX) + 'px';
		mirror.style.fontFamily = cs.fontFamily;
		mirror.style.fontSize = cs.fontSize;
		mirror.style.fontWeight = cs.fontWeight;
		mirror.style.fontStyle = cs.fontStyle;
		mirror.style.lineHeight = cs.lineHeight;
		mirror.style.letterSpacing = cs.letterSpacing;
		mirror.style.wordSpacing = cs.wordSpacing;
		mirror.style.tabSize = cs.tabSize;
		mirror.style.whiteSpace = 'pre-wrap';
		mirror.style.overflowWrap = 'break-word';
		mirror.style.wordBreak = cs.wordBreak;
		mirror.style.boxSizing = 'content-box';

		var html = '';
		for (var i = 0; i < lines.length; i++) {
			html += '<div>' + (lines[i] ? escapeHtml(lines[i]) : '&nbsp;') + '</div>';
		}
		mirror.innerHTML = html;
		var ys = [0];
		var nodes = mirror.children;
		for (var k = 0; k < nodes.length; k++) {
			ys.push(nodes[k].offsetTop);
		}
		ys.push(mirror.scrollHeight);
		editorLineYs = ys;
	}

	function lineFracFromEditorScroll(scrollTop) {
		var ys = editorLineYs;
		if (!ys || ys.length < 3) return 1;
		var y = Math.max(0, scrollTop);
		var lo = 1;
		var hi = ys.length - 2;
		while (lo < hi) {
			var mid = (lo + hi + 1) >> 1;
			if (ys[mid] <= y) lo = mid;
			else hi = mid - 1;
		}
		var y0 = ys[lo];
		var y1 = ys[lo + 1];
		var span = Math.max(1, y1 - y0);
		return lo + Math.min(1, Math.max(0, (y - y0) / span));
	}

	function scrollEditorToLineFrac(lineFrac) {
		if (!$editor || !$editor.length || !editorLineYs) return;
		var ys = editorLineYs;
		var maxLine = ys.length - 2;
		var line = Math.min(maxLine, Math.max(1, lineFrac));
		var i = Math.min(maxLine, Math.floor(line));
		var f = line - i;
		var y0 = ys[i];
		var y1 = ys[Math.min(ys.length - 1, i + 1)];
		$editor[0].scrollTop = y0 + f * (y1 - y0);
	}

	function blockOffsetTop(block, container) {
		var cr = container.getBoundingClientRect();
		var br = block.getBoundingClientRect();
		return br.top - cr.top + container.scrollTop;
	}

	function findBlockForLine(out, line) {
		var kids = out.children;
		var fallback = null;
		for (var i = 0; i < kids.length; i++) {
			var s = parseInt(kids[i].getAttribute('data-line-start'), 10);
			var e = parseInt(kids[i].getAttribute('data-line-end'), 10);
			if (!s) continue;
			fallback = kids[i];
			if (line <= e) return kids[i];
		}
		return fallback;
	}

	function findBlockAtScroll(out, scrollTop) {
		var kids = out.children;
		var y = Math.max(0, scrollTop);
		var last = null;
		for (var i = 0; i < kids.length; i++) {
			var top = blockOffsetTop(kids[i], out);
			if (top + kids[i].offsetHeight > y) return kids[i];
			last = kids[i];
		}
		return last;
	}

	function scrollMax(el) {
		return Math.max(0, el.scrollHeight - el.clientHeight);
	}

	function syncScrollProportion(source, target) {
		var sMax = scrollMax(source);
		var tMax = scrollMax(target);
		target.scrollTop = sMax <= 0 || tMax <= 0 ? 0 : (source.scrollTop / sMax) * tMax;
	}

	function syncEditorToPreview() {
		var ta = $editor && $editor[0];
		var out = document.getElementById('output');
		if (!ta || !out) return;
		if (!scrollMapReady) {
			syncScrollProportion(ta, out);
			return;
		}
		var line = lineFracFromEditorScroll(ta.scrollTop);
		var block = findBlockForLine(out, line);
		if (!block) return;
		var s = parseInt(block.getAttribute('data-line-start'), 10) || 1;
		var e = parseInt(block.getAttribute('data-line-end'), 10) || s;
		var span = Math.max(1, e - s + 1);
		var progress = Math.min(1, Math.max(0, (line - s) / span));
		var top = blockOffsetTop(block, out);
		out.scrollTop = top + progress * block.offsetHeight;
	}

	function syncPreviewToEditor() {
		var ta = $editor && $editor[0];
		var out = document.getElementById('output');
		if (!ta || !out) return;
		if (!scrollMapReady) {
			syncScrollProportion(out, ta);
			return;
		}
		var block = findBlockAtScroll(out, out.scrollTop);
		if (!block) return;
		var s = parseInt(block.getAttribute('data-line-start'), 10) || 1;
		var e = parseInt(block.getAttribute('data-line-end'), 10) || s;
		var top = blockOffsetTop(block, out);
		var h = Math.max(1, block.offsetHeight);
		var progress = Math.min(1, Math.max(0, (out.scrollTop - top) / h));
		scrollEditorToLineFrac(s + progress * (e - s + 1));
	}

	function refreshScrollMaps() {
		if (!scrollSyncOn || !$editor || !$editor.length) {
			scrollMapReady = false;
			editorLineYs = null;
			return;
		}
		var src = $editor.val();
		var okAnnotate = annotatePreviewBlocks(src);
		rebuildEditorLineYs();
		scrollMapReady = okAnnotate && !!editorLineYs;
	}

	function onScrollSyncScroll(fromEditor) {
		if (!scrollSyncOn || syncingScroll) return;
		syncingScroll = true;
		if (fromEditor) syncEditorToPreview();
		else syncPreviewToEditor();
		requestAnimationFrame(function () {
			syncingScroll = false;
		});
	}

	function setScrollSync(on) {
		scrollSyncOn = !!on;
		$('#scroll-sync-toggle').prop('checked', scrollSyncOn);
		$('#scroll-sync-toggle').closest('label')
			.attr('title', scrollSyncOn ? 'Sync scroll on' : 'Sync scroll off')
			.toggleClass('btn-active', scrollSyncOn);
		storageSet(SCROLL_SYNC_KEY, scrollSyncOn ? '1' : '0');
		if (scrollSyncOn) {
			refreshScrollMaps();
		} else {
			scrollMapReady = false;
			editorLineYs = null;
			if ($scrollMirror) $scrollMirror.empty();
		}
	}

	function initScrollSync() {
		setScrollSync(storageGet(SCROLL_SYNC_KEY, '0') === '1');
	}

	function isMobile() {
		return window.matchMedia(MOBILE_MQ).matches;
	}

	function setSidebarOpen(on) {
		document.documentElement.classList.toggle('sidebar-collapsed', !on);
		$('#sidebar-toggle').attr('aria-expanded', on ? 'true' : 'false');
		$('#sidebar-backdrop').prop('hidden', !(on && isMobile()));
		if (!isMobile()) {
			storageSet(SIDEBAR_KEY, on ? '1' : '0');
		}
	}

	function initSidebar() {
		var open = isMobile() ? false : storageGet(SIDEBAR_KEY, '1') !== '0';
		setSidebarOpen(open);
	}

	function setMobileView(view) {
		var preview = view === 'preview';
		$('body').toggleClass('mobile-view-preview', preview);
		$('body').toggleClass('mobile-view-editor', !preview);
		$('.mobile-view-btn').each(function () {
			var active = $(this).data('view') === view;
			$(this).toggleClass('is-active', active).attr('aria-selected', active ? 'true' : 'false');
		});
	}

	function initMobileView() {
		setMobileView('editor');
		$('.mobile-view-toggle').on('click', '.mobile-view-btn', function () {
			setMobileView($(this).data('view'));
		});
		window.matchMedia(MOBILE_MQ).addEventListener('change', function (e) {
			if (e.matches) {
				setSidebarOpen(false);
				setMobileView('editor');
			} else {
				$('body').removeClass('mobile-view-preview mobile-view-editor');
				setSidebarOpen(storageGet(SIDEBAR_KEY, '1') !== '0');
			}
		});
	}

	/* ── Document history (localStorage) ───────────────── */

/* ===== src: app/js/src/core/40-docs.js ===== */
/* ── 40-docs.js ──
   Document history store, File System Access handles, open/save to disk, list UI, bootstrap. */
	var docsState = { items: [], activeId: null };

	function normalizeSourcePath(sourcePath) {
		if (!sourcePath) return '';
		return String(sourcePath).replace(/\\/g, '/').toLowerCase();
	}

	function findDocBySourcePath(sourcePath) {
		var wanted = normalizeSourcePath(sourcePath);
		if (!wanted) return null;
		for (var i = 0; i < docsState.items.length; i++) {
			var doc = docsState.items[i];
			if (doc.sourcePath && normalizeSourcePath(doc.sourcePath) === wanted) {
				return doc;
			}
		}
		return null;
	}

	function isBlankStarterDoc(doc) {
		if (!doc || doc.sourcePath || fileHandlesByDocId[doc.id]) return false;
		var content = String(doc.content || '').trim();
		if (!content) return true;
		if (content === '# Markdown Tools\n\nStart writing…') return true;
		return doc.title === UNTITLED && content.length < 48;
	}

	/* Persist File System Access handles in IndexedDB (survives reload — unlike localStorage,
	   which cannot JSON-serialize a FileSystemFileHandle) so "Save" reuses the *same* file
	   instead of falling back to a Save-As picker that may land in the wrong folder. */
	var HANDLE_DB_NAME = 'rtlmd-handles';
	var HANDLE_DB_STORE = 'handles';
	var handleDbPromise = null;

	function openHandleDb() {
		if (!('indexedDB' in window)) return Promise.resolve(null);
		if (handleDbPromise) return handleDbPromise;
		handleDbPromise = new Promise(function (resolve) {
			try {
				var req = indexedDB.open(HANDLE_DB_NAME, 1);
				req.onupgradeneeded = function () {
					if (!req.result.objectStoreNames.contains(HANDLE_DB_STORE)) {
						req.result.createObjectStore(HANDLE_DB_STORE);
					}
				};
				req.onsuccess = function () { resolve(req.result); };
				req.onerror = function () { resolve(null); };
			} catch (e) {
				resolve(null);
			}
		});
		return handleDbPromise;
	}

	function storeFileHandleRecord(docId, handle) {
		return openHandleDb().then(function (db) {
			if (!db) return;
			try {
				var tx = db.transaction(HANDLE_DB_STORE, 'readwrite');
				tx.objectStore(HANDLE_DB_STORE).put(handle, docId);
			} catch (e) { /* ponytail: handle not structured-clonable in this browser */ }
		});
	}

	function loadFileHandleRecord(docId) {
		return openHandleDb().then(function (db) {
			if (!db) return null;
			return new Promise(function (resolve) {
				try {
					var tx = db.transaction(HANDLE_DB_STORE, 'readonly');
					var req = tx.objectStore(HANDLE_DB_STORE).get(docId);
					req.onsuccess = function () { resolve(req.result || null); };
					req.onerror = function () { resolve(null); };
				} catch (e) {
					resolve(null);
				}
			});
		});
	}

	function deleteFileHandleRecord(docId) {
		return openHandleDb().then(function (db) {
			if (!db) return;
			try {
				var tx = db.transaction(HANDLE_DB_STORE, 'readwrite');
				tx.objectStore(HANDLE_DB_STORE).delete(docId);
			} catch (e) { /* ignore */ }
		});
	}

	function attachFileHandle(doc, handle) {
		if (!doc || !handle) return;
		fileHandlesByDocId[doc.id] = handle;
		storeFileHandleRecord(doc.id, handle);
	}

	function getFileHandle(doc) {
		if (!doc) return null;
		return fileHandlesByDocId[doc.id] || null;
	}

	/* showOpenFilePicker/showSaveFilePicker (and, in practice, requestPermission too) throw
	   "Must be handling a user gesture" unless called near-synchronously inside the
	   click/keydown handler. Any IndexedDB round-trip in between breaks that, so handle
	   restoration must happen *ahead of time* (in the background, on doc load) — never
	   inside saveActiveDocToDisk() itself. queryPermission (unlike requestPermission) never
	   needs a gesture, so it's safe to call here. */
	function prefetchFileHandle(doc) {
		if (!doc || !doc.sourcePath || fileHandlesByDocId[doc.id]) return;
		loadFileHandleRecord(doc.id).then(function (handle) {
			if (!handle || fileHandlesByDocId[doc.id]) return;
			if (typeof handle.queryPermission !== 'function') {
				fileHandlesByDocId[doc.id] = handle;
				return;
			}
			return handle.queryPermission({ mode: 'readwrite' }).then(function (state) {
				if (state === 'granted') fileHandlesByDocId[doc.id] = handle;
				/* else: leave unset — Save falls back to a fresh Save-As picker,
				   still triggered directly from the click/keydown gesture. */
			});
		}).catch(function () { /* ignore — fall back to Save-As at save time */ });
	}

	function canWriteDocToDisk(doc) {
		if (!doc) return false;
		if (getFileHandle(doc)) return true;
		if (!doc.sourcePath) return false;
		if (window.rtlmdDesktop && typeof window.rtlmdDesktop.saveFile === 'function') return true;
		if (supportsSaveFilePicker()) return true;
		return false;
	}

	function supportsOpenFilePicker() {
		return typeof window.showOpenFilePicker === 'function';
	}

	function supportsSaveFilePicker() {
		return typeof window.showSaveFilePicker === 'function';
	}

	function openExternalMarkdownFile(payload) {
		if (!payload || typeof payload.content !== 'string') return;

		var existing = findDocBySourcePath(payload.path);
		if (existing) {
			persistActiveFromEditor({ silentList: true });
			if (existing.pinned) {
				loadDocIntoEditor(existing);
				if (payload.handle) attachFileHandle(existing, payload.handle);
				return;
			}
			existing.content = payload.content;
			markDocSavedToDisk(existing, payload.content);
			existing.updatedAt = Date.now();
			if (payload.handle) attachFileHandle(existing, payload.handle);
			writeDocs(docsState.items);
			loadDocIntoEditor(existing);
			return;
		}

		persistActiveFromEditor({ silentList: true });

		if (docsState.items.length === 1 && isBlankStarterDoc(docsState.items[0])) {
			var starter = docsState.items[0];
			if (starter.pinned) {
				createDoc(payload.content, payload.name || titleFromContent(payload.content), {
					sourcePath: payload.path,
					titleLocked: true,
					fileHandle: payload.handle
				});
				return;
			}
			starter.content = payload.content;
			starter.title = payload.name || titleFromContent(payload.content) || UNTITLED;
			starter.titleLocked = true;
			starter.sourcePath = payload.path;
			markDocSavedToDisk(starter, payload.content);
			starter.updatedAt = Date.now();
			if (payload.handle) attachFileHandle(starter, payload.handle);
			writeDocs(docsState.items);
			loadDocIntoEditor(starter);
			return;
		}

		createDoc(payload.content, payload.name || titleFromContent(payload.content), {
			sourcePath: payload.path,
			titleLocked: true,
			fileHandle: payload.handle
		});
	}

	function readBrowserFileAsPayload(file, handle) {
		return file.text().then(function (content) {
			var base = String(file.name || 'document').replace(/\.(md|markdown|mdown|mkd|mkdn)$/i, '');
			return {
				path: handle && handle.name ? handle.name : (file.name || base),
				name: base,
				content: content,
				handle: handle || null
			};
		});
	}

	function openMarkdownFromDisk() {
		if (window.rtlmdDesktop && typeof window.rtlmdDesktop.openFileDialog === 'function') {
			return window.rtlmdDesktop.openFileDialog().then(function (payloads) {
				if (!payloads || !payloads.length) return;
				payloads.forEach(function (payload) {
					openExternalMarkdownFile(payload);
				});
			}).catch(function (err) {
				window.alert('Could not open file:\n' + (err && err.message ? err.message : String(err)));
			});
		}

		if (supportsOpenFilePicker()) {
			return window.showOpenFilePicker({
				multiple: true,
				types: MD_OPEN_TYPES,
				excludeAcceptAllOption: false
			}).then(function (handles) {
				return Promise.all(handles.map(function (handle) {
					return handle.getFile().then(function (file) {
						return readBrowserFileAsPayload(file, handle);
					});
				}));
			}).then(function (payloads) {
				payloads.forEach(function (payload) {
					openExternalMarkdownFile(payload);
				});
			}).catch(function (err) {
				if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;
				window.alert('Could not open file:\n' + (err && err.message ? err.message : String(err)));
			});
		}

		var input = document.getElementById('doc-file-input');
		if (input) {
			input.value = '';
			input.click();
		}
		return Promise.resolve();
	}

	function onDocFileInputChange(e) {
		var input = e.target;
		var files = input && input.files ? Array.prototype.slice.call(input.files, 0) : [];
		if (!files.length) return;
		Promise.all(files.map(function (file) {
			return readBrowserFileAsPayload(file, null);
		})).then(function (payloads) {
			payloads.forEach(function (payload) {
				/* Legacy file input cannot write back — open as editable history docs. */
				openExternalMarkdownFile({
					path: null,
					name: payload.name,
					content: payload.content,
					handle: null
				});
			});
		}).catch(function (err) {
			window.alert('Could not open file:\n' + (err && err.message ? err.message : String(err)));
		}).then(function () {
			input.value = '';
		});
	}

	function writeViaFileHandle(handle, content) {
		return handle.createWritable().then(function (writable) {
			return writable.write(content).then(function () {
				return writable.close();
			});
		});
	}

	function pickSaveHandleForDoc(doc) {
		if (!supportsSaveFilePicker()) return Promise.resolve(null);
		var suggested = doc.sourcePath || (slugifyFilename(doc.title || UNTITLED) + '.md');
		if (!/\.(md|markdown|mdown|mkd|mkdn)$/i.test(suggested)) {
			suggested += '.md';
		}
		return window.showSaveFilePicker({
			suggestedName: suggested.replace(/^.*[\\/]/, ''),
			types: MD_OPEN_TYPES
		}).then(function (handle) {
			attachFileHandle(doc, handle);
			doc.sourcePath = handle.name || suggested;
			doc.titleLocked = true;
			return handle;
		}).catch(function (err) {
			if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return null;
			throw err;
		});
	}

	function flushPendingExternalFiles() {
		while (pendingExternalFiles.length) {
			openExternalMarkdownFile(pendingExternalFiles.shift());
		}
	}

	function initDesktopBridge() {
		if (!window.rtlmdDesktop || typeof window.rtlmdDesktop.onOpenFile !== 'function') return;
		window.rtlmdDesktop.onOpenFile(function (payload) {
			pendingExternalFiles.push(payload);
			if (docsState.items.length) {
				flushPendingExternalFiles();
			}
		});
	}

	function uid() {
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	}

	function titleFromContent(md) {
		var text = String(md || '');
		var heading = text.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/m);
		if (heading) {
			var h = heading[1].replace(/[*_`~#\[\]]/g, '').trim();
			if (h) return h.slice(0, 80);
		}
		var lines = text.trim().split(/\r?\n/);
		var first = '';
		for (var i = 0; i < lines.length; i++) {
			if (lines[i].trim()) {
				first = lines[i];
				break;
			}
		}
		if (!first) return UNTITLED;
		return first.replace(/^#+\s*/, '').trim().slice(0, 80) || UNTITLED;
	}

	function slugifyFilename(title) {
		var s = String(title || UNTITLED)
			.replace(/[\\/:*?"<>|]+/g, '-')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '');
		return (s || 'markdown-tools').slice(0, 60);
	}

	function readDocsRaw() {
		try {
			var raw = storageGet(DOCS_KEY, null);
			if (!raw) return null;
			var parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : null;
		} catch (e) {
			return null;
		}
	}

	function writeDocs(items) {
		docsState.items = items;
		var serialized;
		try {
			serialized = JSON.stringify(items);
		} catch (e) {
			window.alert('Could not save history (document data could not be serialized).');
			return false;
		}
		/* P0 fix: storageSet() used to swallow quota/private-mode errors internally, and
		   this function never actually checked for failure — it just returned true
		   unconditionally, so a full-storage save looked "successful" while nothing was
		   actually persisted. The in-memory edit is still safe in docsState.items above,
		   but the caller must know a reload/close will lose it. */
		var saved = storageSet(DOCS_KEY, serialized);
		if (!saved) {
			var msg = typeof window.rtlmdT === 'function'
				? window.rtlmdT('storageFullWarning')
				: 'Browser storage is full — this change was NOT saved. Delete old documents/large pasted images, or export a backup, then try again.';
			window.alert(msg);
			return false;
		}
		return true;
	}

	function sortDocs(items) {
		/* ponytail: pinned first, then stable creation order */
		return items.slice().sort(function (a, b) {
			var pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
			if (pin) return pin;
			return (b.createdAt || 0) - (a.createdAt || 0);
		});
	}

	function findDoc(id) {
		for (var i = 0; i < docsState.items.length; i++) {
			if (docsState.items[i].id === id) return docsState.items[i];
		}
		return null;
	}

	function formatDocTime(ts) {
		try {
			return new Date(ts).toLocaleString(undefined, {
				month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
			});
		} catch (e) {
			return '';
		}
	}

	function isActiveDocDiskDirty() {
		var doc = findDoc(docsState.activeId);
		if (!doc || !canWriteDocToDisk(doc)) return false;
		var content = $editor && $editor.length ? $editor.val() : doc.content;
		return content !== doc.lastSavedToDisk;
	}

	function isDocDiskDirty(doc) {
		if (!doc || !canWriteDocToDisk(doc)) return false;
		return doc.content !== doc.lastSavedToDisk;
	}

	function markDocSavedToDisk(doc, content) {
		if (!doc) return;
		doc.lastSavedToDisk = content;
	}

	function refreshActiveTitleUi(flash) {
		var doc = findDoc(docsState.activeId);
		var el = document.getElementById('active-doc-title');
		if (!el || !doc) return;
		var title = doc.title || UNTITLED;
		var dirty = isActiveDocDiskDirty();
		el.textContent = dirty ? title + ' ●' : title;
		el.title = doc.sourcePath || title;
		el.classList.toggle('is-dirty', dirty);
		if (flash === 'saved') {
			el.classList.add('is-saved-flash');
			clearTimeout(refreshActiveTitleUi._flashTimer);
			refreshActiveTitleUi._flashTimer = setTimeout(function () {
				el.classList.remove('is-saved-flash');
			}, 1400);
		}
	}

	function updateActiveTitleUi(/* title */) {
		refreshActiveTitleUi();
	}

	function saveActiveDocToDisk() {
		var doc = findDoc(docsState.activeId);
		if (!doc) return Promise.resolve(false);
		if (doc.pinned) {
			return Promise.resolve(false);
		}

		var content = $editor && $editor.length ? $editor.val() : doc.content;

		function finishSave() {
			doc.content = content;
			markDocSavedToDisk(doc, content);
			doc.updatedAt = Date.now();
			writeDocs(docsState.items);
			storageSet(STORAGE_KEY, content);
			refreshActiveTitleUi('saved');
			renderDocList();
			if (typeof window.rtlmdOnDiskSaved === 'function') {
				window.rtlmdOnDiskSaved(doc);
			}
			return true;
		}

		/* Browser: reuse the real file handle if it's already in memory (restored ahead of
		   time by prefetchFileHandle() when the doc loaded — NOT here, since any async
		   detour, e.g. an IndexedDB round-trip, right before showSaveFilePicker() makes
		   Chrome reject it with "Must be handling a user gesture to show a file picker"). */
		var handle = getFileHandle(doc);
		if (handle) {
			return writeViaFileHandle(handle, content).then(finishSave).catch(function (err) {
				window.alert('Could not save file:\n' + (err && err.message ? err.message : String(err)));
				return false;
			});
		}

		if (doc.sourcePath && window.rtlmdDesktop && typeof window.rtlmdDesktop.saveFile === 'function') {
			/* Desktop app: writes by absolute path directly, no handle needed. */
			return window.rtlmdDesktop.saveFile(doc.sourcePath, content).then(finishSave).catch(function (err) {
				window.alert('Could not save file:\n' + (err && err.message ? err.message : String(err)));
				return false;
			});
		}

		if (!supportsSaveFilePicker()) return Promise.resolve(false);

		/* No usable handle recovered — falls back to Save-As (may create a new file if the
		   original's permission wasn't remembered by the browser). Called directly, still
		   inside the same click/keydown gesture. */
		return pickSaveHandleForDoc(doc).then(function (picked) {
			if (!picked) return false;
			return writeViaFileHandle(picked, content).then(finishSave);
		}).catch(function (err) {
			window.alert('Could not save file:\n' + (err && err.message ? err.message : String(err)));
			return false;
		});
	}

	function renderDocList() {
		var $list = $('#doc-list');
		var $empty = $('#doc-empty');
		if (!$list.length) return;

		var items = sortDocs(docsState.items);
		$list.empty();
		$empty.toggleClass('hidden', items.length > 0);

		items.forEach(function (doc) {
			var active = doc.id === docsState.activeId;
			var $li = $('<li class="doc-item" role="listitem"></li>');
			if (active) $li.addClass('is-active');
			if (doc.pinned) $li.addClass('is-pinned');
			$li.attr('data-id', doc.id);

			var $open = $('<button type="button" class="doc-open"></button>');
			var listTitle = doc.title || UNTITLED;
			if (isDocDiskDirty(doc)) listTitle += ' ●';
			$open.append($('<span class="doc-title"></span>').text(listTitle));
			$open.append($('<span class="doc-meta"></span>').text(formatDocTime(doc.createdAt || doc.updatedAt)));
			$open.attr('title', doc.sourcePath || doc.title || UNTITLED);

			var lockSvg = doc.pinned
				? '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>'
				: '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>';

			var $pin = $('<button type="button" class="doc-pin icon-btn-xs"></button>')
				.toggleClass('is-pinned', !!doc.pinned)
				.attr('title', doc.pinned ? 'Unlock (allow edits)' : 'Lock (pin & freeze edits)')
				.attr('aria-label', doc.pinned ? 'Unlock document' : 'Lock document')
				.attr('aria-pressed', doc.pinned ? 'true' : 'false')
				.html(lockSvg);

			var $del = $('<button type="button" class="doc-delete icon-btn-xs" title="Delete">×</button>');
			if (doc.pinned) {
				$del.prop('disabled', true).addClass('is-locked').attr('title', 'Unlock before deleting');
			}

			var $actions = $('<div class="doc-actions"></div>');
			$actions.append(
				$pin,
				$('<button type="button" class="doc-duplicate icon-btn-xs" title="Duplicate">⧉</button>'),
				$('<button type="button" class="doc-rename icon-btn-xs" title="Rename">✎</button>'),
				$del
			);

			$li.append($open, $actions);
			$list.append($li);
		});
	}

	function shouldAutoTitle(doc, opts) {
		opts = opts || {};
		return !opts.keepTitle && !doc.titleLocked;
	}

	function setEditorLocked(locked) {
		if (!$editor || !$editor.length) return;
		$editor.prop('readonly', !!locked);
		$('#textbox').toggleClass('is-locked', !!locked);
		$('.md-toolbar .md-tool').prop('disabled', !!locked);
		$('#doc-save').prop('disabled', !!locked);
	}

	function syncActiveEditorLock() {
		var doc = findDoc(docsState.activeId);
		setEditorLocked(!!(doc && doc.pinned));
	}

	function persistActiveFromEditor(opts) {
		opts = opts || {};
		if (!$editor || !$editor.length || !docsState.activeId) return;
		var doc = findDoc(docsState.activeId);
		if (!doc) return;
		if (doc.pinned) {
			/* Locked: keep stored content; snap editor back if it drifted. */
			if ($editor.val() !== doc.content) {
				$editor.val(doc.content || '');
				if (!opts.silentList) renderPreview();
			}
			updateActiveTitleUi(doc.title);
			if (!opts.silentList) renderDocList();
			return;
		}
		var content = $editor.val();
		doc.content = content;
		doc.updatedAt = Date.now();
		if (shouldAutoTitle(doc, opts)) {
			doc.title = titleFromContent(content);
		}
		writeDocs(docsState.items);
		storageSet(STORAGE_KEY, content);
		updateActiveTitleUi(doc.title);
		if (!opts.silentList) renderDocList();
	}

	function loadDocIntoEditor(doc, opts) {
		opts = opts || {};
		docsState.activeId = doc.id;
		storageSet(ACTIVE_ID_KEY, doc.id);
		if ($editor && $editor.length) {
			$editor.val(doc.content || '');
		}
		syncActiveEditorLock();
		updateActiveTitleUi(doc.title || UNTITLED);
		storageSet(STORAGE_KEY, doc.content || '');
		if (!opts.skipRender) renderPreview();
		renderDocList();
		/* Background restore only — never inside the Save click/keydown handler itself. */
		prefetchFileHandle(doc);
	}

	function createDoc(content, title, opts) {
		opts = opts || {};
		persistActiveFromEditor({ silentList: true });
		var items = docsState.items.slice();
		if (items.length >= MAX_DOCS) {
			items = sortDocs(items);
			var victims = items.filter(function (d) {
				return d.id !== docsState.activeId && !d.pinned;
			});
			while (items.length >= MAX_DOCS && victims.length) {
				var drop = victims.pop();
				items = items.filter(function (d) { return d.id !== drop.id; });
				delete fileHandlesByDocId[drop.id];
				deleteFileHandleRecord(drop.id);
			}
			if (items.length >= MAX_DOCS) {
				window.alert('Document limit (' + MAX_DOCS + ') reached. Unlock or delete one first.');
				return null;
			}
		}
		var now = Date.now();
		var doc = {
			id: uid(),
			title: title || titleFromContent(content || '') || UNTITLED,
			content: content || '',
			pinned: false,
			snapshots: [],
			updatedAt: now,
			createdAt: now
		};
		if (opts.sourcePath) doc.sourcePath = opts.sourcePath;
		if (opts.titleLocked) doc.titleLocked = true;
		if (opts.sourcePath || opts.fileHandle) markDocSavedToDisk(doc, doc.content);
		if (opts.fileHandle) attachFileHandle(doc, opts.fileHandle);
		items.unshift(doc);
		writeDocs(items);
		loadDocIntoEditor(doc);
		return doc;
	}

	function openDoc(id) {
		if (!id || id === docsState.activeId) return;
		if (!confirmLeaveIfDiskDirty()) return;
		var doc = findDoc(id);
		if (!doc) return;
		persistActiveFromEditor({ silentList: true });
		loadDocIntoEditor(doc);
		if (isMobile()) {
			setSidebarOpen(false);
		}
	}

	function renameDoc(id) {
		var doc = findDoc(id);
		if (!doc) return;
		var next = window.prompt('Document name:', doc.title || UNTITLED);
		if (next === null) return;
		next = String(next).trim().slice(0, 80);
		if (!next) next = UNTITLED;
		doc.title = next;
		doc.titleLocked = true;
		writeDocs(docsState.items);
		if (doc.id === docsState.activeId) updateActiveTitleUi(doc.title);
		renderDocList();
	}

	function togglePinDoc(id) {
		var doc = findDoc(id);
		if (!doc) return;
		if (doc.id === docsState.activeId && !doc.pinned) {
			persistActiveFromEditor({ silentList: true });
		}
		doc.pinned = !doc.pinned;
		writeDocs(docsState.items);
		renderDocList();
		if (doc.id === docsState.activeId) {
			if (doc.pinned && $editor && $editor.length) {
				$editor.val(doc.content || '');
				renderPreview();
			}
			syncActiveEditorLock();
			refreshActiveTitleUi();
		}
	}

	function deleteDoc(id) {
		if (docsState.items.length <= 1) {
			window.alert('At least one document must remain.');
			return;
		}
		var doc = findDoc(id);
		if (!doc) return;
		if (doc.pinned) {
			window.alert('Unlock "' + (doc.title || UNTITLED) + '" before deleting it.');
			return;
		}
		if (!window.confirm('Delete "' + (doc.title || UNTITLED) + '"?')) return;
		var wasActive = doc.id === docsState.activeId;
		var items = docsState.items.filter(function (d) { return d.id !== id; });
		delete fileHandlesByDocId[id];
		deleteFileHandleRecord(id);
		writeDocs(items);
		if (wasActive) {
			loadDocIntoEditor(sortDocs(items)[0]);
		} else {
			renderDocList();
		}
	}

	function migrateLegacyContent() {
		var legacy = storageGet(STORAGE_KEY, null);
		if (!legacy) legacy = storageGet('content', null);
		if (legacy === null || legacy === '') return null;
		return {
			id: uid(),
			title: titleFromContent(legacy),
			content: legacy,
			pinned: false,
			updatedAt: Date.now(),
			createdAt: Date.now()
		};
	}

	function ensureDocsBootstrapped(seedContent) {
		var existing = readDocsRaw();
		if (existing && existing.length) {
			docsState.items = existing.map(function (d) {
				return {
					id: d.id || uid(),
					title: d.title || titleFromContent(d.content) || UNTITLED,
					content: typeof d.content === 'string' ? d.content : '',
					pinned: !!d.pinned,
					sourcePath: d.sourcePath || null,
					titleLocked: !!d.titleLocked,
					lastSavedToDisk: typeof d.lastSavedToDisk === 'string' ? d.lastSavedToDisk : null,
					snapshots: Array.isArray(d.snapshots) ? d.snapshots : [],
					updatedAt: d.updatedAt || Date.now(),
					createdAt: d.createdAt || d.updatedAt || Date.now()
				};
			});
			docsState.items.forEach(function (doc) {
				if (doc.sourcePath && doc.lastSavedToDisk === null) {
					markDocSavedToDisk(doc, doc.content);
				}
			});
			writeDocs(docsState.items);
			var wanted = storageGet(ACTIVE_ID_KEY, null);
			var active = (wanted && findDoc(wanted)) || sortDocs(docsState.items)[0];
			loadDocIntoEditor(active, { skipRender: false });
			return;
		}

		var migrated = migrateLegacyContent();
		if (migrated) {
			writeDocs([migrated]);
			loadDocIntoEditor(migrated);
			return;
		}

		var content = typeof seedContent === 'string' ? seedContent : '';
		var doc = {
			id: uid(),
			title: titleFromContent(content),
			content: content,
			pinned: false,
			updatedAt: Date.now(),
			createdAt: Date.now()
		};
		writeDocs([doc]);
		loadDocIntoEditor(doc);
	}

	function bindDocsUi() {
		$('#doc-new').on('click', function () {
			if (!confirmLeaveIfDiskDirty()) return;
			createDoc('# New document\n\n');
		});

		$('#doc-open').on('click', function () {
			if (!confirmLeaveIfDiskDirty()) return;
			openMarkdownFromDisk();
		});

		$('#doc-save').on('click', function () {
			persistActiveFromEditor();
			saveActiveDocToDisk();
		});

		$('#doc-file-input').on('change', onDocFileInputChange);

		$('#doc-list').on('click', '.doc-open', function () {
			openDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-duplicate', function (e) {
			e.stopPropagation();
			if (typeof window.rtlmdDuplicateDoc === 'function') {
				window.rtlmdDuplicateDoc($(this).closest('.doc-item').data('id'));
			}
		});

		$('#doc-list').on('click', '.doc-rename', function (e) {
			e.stopPropagation();
			renameDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-pin', function (e) {
			e.stopPropagation();
			togglePinDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-delete', function (e) {
			e.stopPropagation();
			deleteDoc($(this).closest('.doc-item').data('id'));
		});

		$('#sidebar-toggle').on('click', function () {
			if (isFullview()) {
				setFullview(false);
				setSidebarOpen(true);
				return;
			}
			setSidebarOpen(document.documentElement.classList.contains('sidebar-collapsed'));
		});

		$('#sidebar-backdrop').on('click', function () {
			setSidebarOpen(false);
		});

		$(window).on('beforeunload', function (e) {
			persistActiveFromEditor({ silentList: true, keepTitle: false });
			if (isActiveDocDiskDirty()) {
				e.preventDefault();
				e.returnValue = '';
			}
		});
	}

/* ===== src: app/js/src/core/50-selfcheck.js ===== */
/* ── 50-selfcheck.js ──
   ?selfcheck=1 regression guards (titles, escape, sanitize, word export…). */
	function runDocsSelfCheck() {
		var fails = [];
		function ok(cond, msg) {
			if (!cond) fails.push(msg);
		}
		ok(titleFromContent('# Hello world\n\nx') === 'Hello world', 'heading title');
		ok(titleFromContent('   ') === UNTITLED, 'empty title');
		ok(titleFromContent('First line\nsecond') === 'First line', 'first line title');
		ok(!shouldAutoTitle({ titleLocked: true }, {}), 'locked title skips auto');
		ok(shouldAutoTitle({}, {}), 'unlocked title still auto');
		ok(!!uid() && uid() !== uid(), 'uid uniqueness');
		ok(slugifyFilename('a/b:c').indexOf('/') === -1, 'slugify');
		ok(sortDocs([
			{ id: 'a', createdAt: 1 },
			{ id: 'b', createdAt: 3 },
			{ id: 'c', createdAt: 2 }
		]).map(function (d) { return d.id; }).join('') === 'bca', 'sort by createdAt');
		ok(sortDocs([
			{ id: 'a', createdAt: 3, pinned: false },
			{ id: 'b', createdAt: 1, pinned: true },
			{ id: 'c', createdAt: 2, pinned: false }
		]).map(function (d) { return d.id; }).join('') === 'bac', 'pinned first');
		ok(wrapSelection('hi', '**', '**') === '**hi**', 'wrap selection');
		ok(prefixLines('a\nb', '- ') === '- a\n- b', 'prefix lines');
		ok(escapeHtml('<?php $t->id()') === '&lt;?php $t-&gt;id()', 'escape php fence');
		ok(parseMarkdown('```php\n<?php\n$table->id();\n```').indexOf('&lt;?php') !== -1, 'php fence stays text');
		ok(parseMarkdown('```php\n<?php\n$table->id();\n```').indexOf('language-php"><code') === -1, 'php fence no nest leak');
		(function () {
			var html = parseMarkdown("x `'y'` z");
			ok(html.indexOf('&amp;#39;') === -1 && html.indexOf('&amp;amp;') === -1, 'codespan no double-escape');
			var probe = document.createElement('div');
			probe.innerHTML = html;
			var codeEl = probe.querySelector('code.codespan');
			ok(!!codeEl && codeEl.textContent === "'y'", 'codespan keeps quotes');
		})();
		(function () {
			/* Regression guard: a literal `$$...$$`/`$...$` shown as *code* (explaining
			   KaTeX/shell syntax, prices in a code sample, etc.) must stay literal text —
			   not be treated as real math — and must never corrupt/truncate the rest of
			   the document (reported real-world case: pasting a message that contained
			   `` `$$E=mc^2$$` `` inside a sentence blanked out everything after it). */
			var html = parseMarkdown(
				'before (`$$E=mc^2$$`, `$a+b$`) after\n\n' +
				'```\ncode with $$still not math$$ and $1 too\n```\n\n' +
				'tail paragraph stays visible'
			);
			ok(html.indexOf('katex') === -1, 'code-fenced/code-span $ is not treated as math');
			ok(html.indexOf('rtlmd-math-ph') === -1, 'no leftover math placeholder markers');
			ok(html.indexOf('tail paragraph stays visible') !== -1, 'content after inline code with $ is not swallowed');
		})();
		(function () {
			/* P0 security regression guard: untrusted raw HTML in a document (e.g. a
			   downloaded/shared .md file) must never reach the live DOM unsanitized. */
			var html = parseMarkdown(
				'<script>window.__rtlmdXssProbe = 1;<\/script>\n\n' +
				'![x](javascript:alert(1))\n\n' +
				'<img src="x" onerror="window.__rtlmdXssProbe = 1">'
			);
			ok(html.indexOf('<script') === -1, 'sanitize strips <script> tags');
			ok(html.indexOf('onerror') === -1, 'sanitize strips inline event-handler attributes');
			ok(html.indexOf('javascript:') === -1, 'sanitize strips javascript: URIs');
		})();
		(function () {
			var el = document.createElement('code');
			el.textContent = "'این سند خرید' and $x";
			enhanceCodeBidi(el);
			var bdi = el.querySelector('bdi.code-bidi');
			ok(!!bdi && bdi.textContent === 'این سند خرید', 'code bidi wraps Persian run');
			ok(el.textContent.indexOf('$x') !== -1, 'code bidi keeps Latin token');
		})();
		ok(storageGet(SCROLL_SYNC_KEY, '0') === '0' || storageGet(SCROLL_SYNC_KEY, '0') === '1', 'scroll sync pref');
		ok(typeof setScrollSync === 'function' && scrollSyncOn === (storageGet(SCROLL_SYNC_KEY, '0') === '1'), 'scroll sync default wiring');
		var ranges = sourceBlockRanges('# Title\n\nHello\n');
		ok(ranges.length === 2 && ranges[0].start === 1 && ranges[1].start === 3, 'scroll sync block ranges');
		(function () {
			/* Word export guard: the .doc payload must be self-contained and styled. */
			var w = buildWordDocument('Selfcheck');
			ok(w.indexOf('<style>') !== -1 && w.indexOf('.markdown-body h1') !== -1, 'word export embeds stylesheet');
			ok(w.indexOf('WordSection1') !== -1, 'word export has Word section/page setup');
			ok(w.indexOf('<script') === -1, 'word export strips scripts');
			ok(w.indexOf('code-copy') === -1 && w.indexOf('code-lang') === -1, 'word export strips preview-only code chrome');
		})();
		if (fails.length) {
			console.error('[rtlmd selfcheck] FAIL', fails);
			window.alert('Self-check failed: ' + fails.join(', '));
		} else {
			console.info('[rtlmd selfcheck] OK');
		}
	}

/* ===== src: app/js/src/core/60-editor-preview.js ===== */
/* ── 60-editor-preview.js ──
   Editor binding base, renderPreview() pipeline, code copy buttons, clipboard. */
	var $editor = null;
	var rafPending = false;

	function renderPreview() {
		if (!$editor || !$editor.length) return;
		try {
			$('#output').html(parseMarkdown($editor.val()));
		} catch (err) {
			$('#output').html('<p class="render-error">Markdown render error</p>');
			scrollMapReady = false;
			return;
		}
		highlightCode();
		attachCodeCopyButtons();
		renderMermaid();
		refreshScrollMaps();
		if (typeof window.rtlmdAfterPreview === 'function') {
			window.rtlmdAfterPreview();
		}
	}

	function attachCodeCopyButtons() {
		$('#output pre.code-block').each(function () {
			var pre = this;
			if (pre.querySelector('.code-copy')) return;
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'code-copy';
			btn.textContent = 'Copy';
			btn.setAttribute('aria-label', 'Copy code');
			btn.addEventListener('click', function () {
				var code = pre.querySelector('code');
				var text = code ? code.textContent : '';
				copyText(text).then(function () {
					btn.textContent = 'Copied';
					btn.classList.add('is-copied');
					setTimeout(function () {
						btn.textContent = 'Copy';
						btn.classList.remove('is-copied');
					}, 1200);
				}).catch(function () {
					btn.textContent = 'Failed';
					setTimeout(function () { btn.textContent = 'Copy'; }, 1200);
				});
			});
			pre.insertBefore(btn, pre.firstChild);
		});
	}

	function copyText(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(text);
		}
		return new Promise(function (resolve, reject) {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			try {
				if (!document.execCommand('copy')) throw new Error('copy failed');
				resolve();
			} catch (e) {
				reject(e);
			} finally {
				ta.remove();
			}
		});
	}

/* ===== src: app/js/src/core/70-toolbar.js ===== */
/* ── 70-toolbar.js ──
   Markdown toolbar actions (bold, lists, table, task…). */
	function wrapSelection(selected, before, after) {
		return before + (selected || '') + after;
	}

	function prefixLines(selected, prefix) {
		var src = selected || '';
		if (!src) return prefix;
		return src.split(/\r?\n/).map(function (line) {
			return prefix + line;
		}).join('\n');
	}

	function applyMdTool(action) {
		if (!$editor || !$editor.length) return;
		var active = findDoc(docsState.activeId);
		if (active && active.pinned) return;
		var el = $editor[0];
		var start = el.selectionStart;
		var end = el.selectionEnd;
		var value = el.value;
		var selected = value.slice(start, end);
		var insert = '';
		var cursor = null;

		switch (action) {
			case 'bold':
				insert = wrapSelection(selected || 'bold', '**', '**');
				break;
			case 'italic':
				insert = wrapSelection(selected || 'italic', '*', '*');
				break;
			case 'heading':
				insert = selected ? prefixLines(selected, '## ') : '## Heading';
				break;
			case 'code':
				insert = wrapSelection(selected || 'code', '`', '`');
				break;
			case 'codeblock':
				insert = '```\n' + (selected || 'code') + '\n```';
				break;
			case 'link':
				insert = '[' + (selected || 'text') + '](https://)';
				cursor = start + insert.lastIndexOf('https://') + 'https://'.length;
				break;
			case 'ul':
				insert = selected ? prefixLines(selected, '- ') : '- item';
				break;
			case 'ol':
				insert = selected ? prefixLines(selected, '1. ') : '1. item';
				break;
			case 'quote':
				insert = selected ? prefixLines(selected, '> ') : '> quote';
				break;
			case 'hr':
				insert = '\n\n---\n\n';
				break;
			case 'strike':
				insert = wrapSelection(selected || 'text', '~~', '~~');
				break;
			case 'table':
				insert = selected || '| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |';
				break;
			case 'task':
				insert = selected ? prefixLines(selected, '- [ ] ') : '- [ ] Task';
				break;
			case 'image':
				insert = '![' + (selected || 'alt') + '](https://)';
				cursor = start + insert.lastIndexOf('https://') + 'https://'.length;
				break;
			default:
				return;
		}

		el.value = value.slice(0, start) + insert + value.slice(end);
		var nextPos = cursor != null ? cursor : start + insert.length;
		el.focus();
		el.setSelectionRange(nextPos, nextPos);
		onEditorChange();
	}

	function bindMarkdownToolbar() {
		$('.md-toolbar').on('click', '.md-tool', function () {
			applyMdTool($(this).data('md'));
		});
	}

/* ===== src: app/js/src/core/80-export.js ===== */
/* ── 80-export.js ──
   Standalone exports: HTML/Markdown/PDF/image, Word-HTML (.doc) builder, editor change loop. */
	function saveContent() {
		persistActiveFromEditor({ silentList: true });
		var doc = findDoc(docsState.activeId);
		if (!doc) return;
		var $active = $('#doc-list .doc-item.is-active');
		if (!$active.length) return;
		$active.find('.doc-title').text(doc.title || UNTITLED);
		$active.find('.doc-meta').text(formatDocTime(doc.createdAt || doc.updatedAt));
		$active.find('.doc-open').attr('title', doc.title || UNTITLED);
	}

	function downloadFile(content, filename, type) {
		var blob = new Blob([content], { type: type + ';charset=utf-8' });
		var url = URL.createObjectURL(blob);
		var link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 0);
	}

	function downloadDataUrl(dataUrl, filename) {
		var link = document.createElement('a');
		link.href = dataUrl;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	function loadScriptOnce(src, globalName) {
		if (globalName && window[globalName]) return Promise.resolve();
		var existing = document.querySelector('script[data-rtlmd-src="' + src + '"]');
		if (existing) {
			return new Promise(function (resolve, reject) {
				if (globalName && window[globalName]) return resolve();
				existing.addEventListener('load', function () { resolve(); });
				existing.addEventListener('error', reject);
			});
		}
		return new Promise(function (resolve, reject) {
			var script = document.createElement('script');
			script.src = src;
			script.async = true;
			script.setAttribute('data-rtlmd-src', src);
			script.onload = function () { resolve(); };
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}

	function prepareExportRoot() {
		var clone = document.getElementById('output').cloneNode(true);
		$(clone).find('script').remove();
		$(clone).find('.code-copy').remove();
		$(clone).find('[data-cursor-ref]').removeAttr('data-cursor-ref');
		$(clone).find('[tabindex]').removeAttr('tabindex');
		return clone;
	}

	function exportNeedsMermaid(root) {
		var wraps = root.querySelectorAll('.mermaid-wrap');
		for (var i = 0; i < wraps.length; i++) {
			if (!wraps[i].querySelector('svg')) return true;
		}
		return false;
	}

	function exportNeedsPrism(root) {
		return !!root.querySelector('pre.code-block code');
	}

	/* ponytail: standalone export CSS — mirrors preview styles without daisyui */
	function exportStylesheet(forPrint) {
		return [
			'@font-face{font-family:Vazirmatn;src:local("Vazirmatn"),local("Tahoma");font-weight:400;font-style:normal}',
			'@font-face{font-family:"Fira Code";src:local("Fira Code"),local(Consolas);font-weight:400;font-style:normal}',
			forPrint ? '@page{size:A4;margin:1.4cm 1.2cm}' : '',
			'*{box-sizing:border-box}',
			'html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}',
			'body{margin:0;padding:' + (forPrint ? '0' : '2rem') + ';font-family:Vazirmatn,Tahoma,sans-serif;font-size:' + (forPrint ? '11pt' : '1.0625rem') + ';line-height:1.85;color:#18181b;background:#fff;direction:' + contentDir + '}',
			'.markdown-body{max-width:' + (forPrint ? 'none' : '52rem') + ';margin:0 auto;overflow-wrap:break-word}',
			'.markdown-body>:first-child{margin-top:0}',
			'.markdown-body>:last-child{margin-bottom:0}',
			'.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4,.markdown-body h5,.markdown-body h6{font-weight:700;line-height:1.35;margin:1.4em 0 .55em;page-break-after:avoid;break-after:avoid-page}',
			'.markdown-body h1{font-size:1.7em;padding-bottom:.3em;border-bottom:2px solid #e4e4e7}',
			'.markdown-body h2{font-size:1.35em;padding-bottom:.25em;border-bottom:1px solid #e4e4e7}',
			'.markdown-body h3{font-size:1.15em}',
			'.markdown-body p{margin:0 0 1em}',
			'.markdown-body a{color:#2563eb}',
			'.markdown-body ul,.markdown-body ol{margin:0 0 1em;padding-inline-start:1.6em;list-style-position:outside}',
			'.markdown-body ul{list-style-type:disc}',
			'.markdown-body ol{list-style-type:decimal}',
			'.markdown-body li{display:list-item;margin-bottom:.4em}',
			'.markdown-body blockquote{margin:0 0 1em;padding:.45em 0 .45em 1.1em;border-inline-start:4px solid #93c5fd;opacity:.95;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body hr{border:none;border-top:1px solid #e4e4e7;margin:1.75em 0}',
			'.markdown-body img{max-width:100%;height:auto;border-radius:.35rem;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body code:not(pre code){direction:ltr;unicode-bidi:isolate;font-family:"Fira Code",Vazirmatn,Consolas,monospace;font-size:.88em;padding:.15em .45em;border-radius:.3em;color:#3f3f46;background:#f4f4f5;border:1px solid #d4d4d8}',
			'.markdown-body pre.code-block{direction:ltr;unicode-bidi:isolate;text-align:left;position:relative;margin:.65em 0 1em;padding:0;border-radius:.45rem;overflow:hidden;border:1px solid #334155;background:#1e293b!important;box-shadow:none;line-height:1.6;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body pre.code-block .code-lang{position:absolute;top:0;inset-inline-end:0;z-index:1;padding:.3em .75em;font-family:"Fira Code",Consolas,monospace;font-size:.62em;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;background:rgba(0,0,0,.35);border-end-start-radius:.3rem}',
			'.markdown-body pre.code-block code{direction:ltr;unicode-bidi:isolate;display:block;font-family:"Fira Code",Vazirmatn,Consolas,monospace;font-size:' + (forPrint ? '8.5pt' : '.875em') + ';line-height:1.6;color:#e2e8f0!important;background:#1e293b!important;padding:1.1em 1.2em;white-space:' + (forPrint ? 'pre-wrap' : 'pre') + ';overflow-x:' + (forPrint ? 'visible' : 'auto') + ';tab-size:2;word-break:break-word}',
			'.markdown-body pre.code-block code .code-bidi{font-family:Vazirmatn,Tahoma,sans-serif;font-style:normal}',
			'.markdown-body .mermaid-wrap{direction:ltr;unicode-bidi:isolate;margin:0 0 1em;padding:1em .75em;overflow:hidden;border:1px solid #cbd5e1;border-radius:.45rem;background:#f8fafc;text-align:center;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body pre.mermaid{margin:0;padding:0;background:transparent;border:none;box-shadow:none;text-align:center;white-space:pre-wrap}',
			'.markdown-body .mermaid-wrap svg{max-width:100%!important;height:auto!important}',
			'.markdown-body .table-scroll{overflow-x:auto;margin:0 0 1em;border:1px solid #cbd5e1;border-radius:.35rem}',
			'.markdown-body .table-scroll table{width:max-content;min-width:100%;margin:0;border:none}',
			'.markdown-body table{width:100%;margin:0 0 1em;border-collapse:collapse;font-size:.92em;border:1.5px solid #cbd5e1;background:#fff;page-break-inside:auto}',
			'.markdown-body tr{page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body th,.markdown-body td{padding:.55em .8em;border:1px solid #cbd5e1;text-align:start;vertical-align:top}',
			'.markdown-body th{font-weight:700;background:#f1f5f9!important}',
			'.markdown-body tbody tr:nth-child(even){background:#f8fafc!important}',
			/* prism-tomorrow fallback — works offline when tokens already exported */
			'.token.comment,.token.prolog,.token.doctype,.token.cdata{color:#999}',
			'.token.punctuation{color:#ccc}',
			'.token.property,.token.tag,.token.boolean,.token.number,.token.constant,.token.symbol,.token.deleted{color:#f92672}',
			'.token.selector,.token.attr-name,.token.string,.token.char,.token.builtin,.token.inserted{color:#a6e22e}',
			'.token.operator,.token.entity,.token.url,.language-css .token.string,.style .token.string{color:#f8f8f2}',
			'.token.atrule,.token.attr-value,.token.keyword{color:#66d9ef}',
			'.token.function,.token.class-name{color:#e6db74}',
			'.token.regex,.token.important,.token.variable{color:#fd971f}',
			forPrint ? [
				'@media print{',
				'a{color:inherit;text-decoration:none}',
				'a[href]::after{content:none!important}',
				'pre.code-block,.mermaid-wrap,blockquote,img{page-break-inside:avoid;break-inside:avoid-page}',
				'h1,h2,h3,h4{page-break-after:avoid;break-after:avoid-page}',
				'}'
			].join('') : ''
		].join('');
	}

	/* ponytail: Word (.doc) export — Word-HTML with embedded styles.
	   Unlike the live preview (tailwind/daisyui classes), the .doc file must be
	   self-contained: Word has no access to the app CSS, understands only a
	   subset of CSS (no logical properties, no :not(), no flex), and prints
	   dark code themes badly — so this ships a dedicated light, print-safe
	   stylesheet plus Word section/page metadata. */
	function wordStylesheet() {
		var rtl = contentDir === 'rtl';
		var listSide = rtl ? 'margin-right:1.6em;margin-left:0' : 'margin-left:1.6em;margin-right:0';
		var quoteBorder = rtl ? 'border-right:4px solid #93c5fd' : 'border-left:4px solid #93c5fd';
		var quotePad = rtl ? 'padding:.45em 1em .45em 0' : 'padding:.45em 0 .45em 1em';
		/* ponytail: explicit physical alignment — Word maps h1-h6 to its built-in
		   Heading styles (left-aligned), so without this RTL headings fall back
		   to left while body paragraphs follow dir. Applied on the container for
		   inheritance plus directly on headings to beat the built-in styles. */
		var baseAlign = rtl ? 'text-align:right' : 'text-align:left';
		return [
			'@page WordSection1{size:595.3pt 841.9pt;margin:72pt 72pt 72pt 72pt;mso-header-margin:35.4pt;mso-footer-margin:35.4pt}',
			'div.WordSection1{page:WordSection1}',
			'body{margin:0;padding:0;font-family:Vazirmatn,Tahoma,Arial,sans-serif;font-size:11pt;line-height:1.8;color:#18181b;background:#fff;direction:' + contentDir + ';mso-bidi-font-family:Tahoma}',
			'.markdown-body{max-width:100%;margin:0;overflow-wrap:break-word;word-wrap:break-word;' + baseAlign + '}',
			'.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4,.markdown-body h5,.markdown-body h6{font-family:Vazirmatn,Tahoma,Arial,sans-serif;font-weight:700;line-height:1.4;margin:1.2em 0 .5em;color:#18181b;mso-bidi-font-weight:bold;page-break-after:avoid;' + baseAlign + '}',
			'.markdown-body h1{font-size:20pt;padding-bottom:.25em;border-bottom:2px solid #e4e4e7}',
			'.markdown-body h2{font-size:16pt;padding-bottom:.2em;border-bottom:1px solid #e4e4e7}',
			'.markdown-body h3{font-size:13pt}',
			'.markdown-body h4{font-size:11.5pt}',
			'.markdown-body h5,.markdown-body h6{font-size:11pt}',
			'.markdown-body p{margin:0 0 1em}',
			'.markdown-body ul,.markdown-body ol{margin:0 0 1em;' + listSide + ';padding:0}',
			'.markdown-body li{margin-bottom:.35em}',
			'.markdown-body a{color:#2563eb;text-decoration:underline}',
			'.markdown-body blockquote{margin:0 0 1em;' + quotePad + ';' + quoteBorder + ';color:#334155;background:#f8fafc}',
			'.markdown-body hr{border:none;border-top:1px solid #cbd5e1;margin:1.5em 0}',
			'.markdown-body img{max-width:100%;height:auto}',
			'.markdown-body table{width:100%;margin:0 0 1em;border-collapse:collapse;font-size:10pt;border:1.5pt solid #94a3b8;background:#fff}',
			'.markdown-body th,.markdown-body td{padding:6pt 8pt;border:1pt solid #94a3b8;vertical-align:top}',
			'.markdown-body th{font-weight:700;background:#e2e8f0;mso-shading:rgb(226,232,240)}',
			'.markdown-body tbody tr{background:#fff}',
			/* inline code — simple selector on purpose (Word ignores :not()) */
			'.markdown-body code{font-family:Consolas,"Courier New",monospace;font-size:9.5pt;color:#3f3f46;background:#f4f4f5;border:1pt solid #d4d4d8}',
			'.markdown-body pre{margin:.7em 0 1em;padding:10pt 12pt;background:#f4f4f5;border:1pt solid #cbd5e1;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;text-align:left;direction:ltr}',
			'.markdown-body pre code{font-family:Consolas,"Courier New",monospace;font-size:9.5pt;color:#18181b;background:transparent;border:none}',
			/* neutralize dark prism token colors — Word file ships no prism theme */
			'.markdown-body .token{color:#18181b!important;background:transparent!important}',
			'.markdown-body .code-bidi{font-family:Vazirmatn,Tahoma,Arial,sans-serif}',
			'.markdown-body .mermaid-wrap{margin:0 0 1em;padding:10pt;border:1pt solid #cbd5e1;background:#f8fafc;text-align:center}',
			'.markdown-body .mermaid-wrap svg{max-width:100%;height:auto}',
			'.markdown-body .katex{font-size:1em}',
			'.markdown-body input{vertical-align:middle}'
		].join('');
	}

	function resolveWordUrl(url) {
		if (!url || url.charAt(0) === '#') return url;
		if (/^(data|blob|https?|file|ftp|mailto):/i.test(url)) return url;
		try {
			if (typeof location !== 'undefined' && location.href) return new URL(url, location.href).href;
		} catch (e) { /* keep original */ }
		return url;
	}

	/* Strip preview-only / interactive nodes and make resource URLs absolute so the
	   downloaded .doc renders away from the app (Word resolves relative URLs
	   against the local file, which would break images/links). */
	function sanitizeWordClone(root) {
		var i, j, nodes;
		nodes = root.querySelectorAll('script,style,button,.code-copy,.code-lang,.mermaid-toolbar,.preview-toc,.toc-toggle-btn');
		for (i = 0; i < nodes.length; i++) {
			if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
		}
		/* mermaid: drop zoom toolbar/viewport wrappers, keep the rendered svg */
		nodes = root.querySelectorAll('.mermaid-wrap');
		for (i = 0; i < nodes.length; i++) {
			var wrap = nodes[i];
			wrap.removeAttribute('data-mermaid-enhanced');
			wrap.removeAttribute('data-processed');
			var svg = wrap.querySelector('svg');
			if (svg) {
				wrap.innerHTML = '';
				wrap.appendChild(svg.cloneNode(true));
			} else {
				var stale = wrap.querySelectorAll('.mermaid-viewport,.mermaid-stage');
				for (j = 0; j < stale.length; j++) {
					var st = stale[j];
					while (st.firstChild) st.parentNode.insertBefore(st.firstChild, st);
					if (st.parentNode) st.parentNode.removeChild(st);
				}
			}
		}
		/* table-scroll wrapper only makes sense with app CSS overflow — unwrap it */
		nodes = root.querySelectorAll('.table-scroll');
		for (i = 0; i < nodes.length; i++) {
			var box = nodes[i];
			while (box.firstChild) box.parentNode.insertBefore(box.firstChild, box);
			if (box.parentNode) box.parentNode.removeChild(box);
		}
		nodes = root.querySelectorAll('img');
		for (i = 0; i < nodes.length; i++) {
			var img = nodes[i];
			try {
				var src = img.getAttribute('src');
				if (src) img.setAttribute('src', resolveWordUrl(src));
			} catch (e) { /* keep */ }
			img.removeAttribute('srcset');
			img.removeAttribute('sizes');
			img.removeAttribute('loading');
		}
		nodes = root.querySelectorAll('a');
		for (i = 0; i < nodes.length; i++) {
			try {
				var href = nodes[i].getAttribute('href');
				if (href && href.charAt(0) !== '#') nodes[i].setAttribute('href', resolveWordUrl(href));
			} catch (e) { /* keep */ }
		}
		nodes = root.querySelectorAll('[contenteditable],[draggable],[spellcheck]');
		for (i = 0; i < nodes.length; i++) {
			nodes[i].removeAttribute('contenteditable');
			nodes[i].removeAttribute('draggable');
			nodes[i].removeAttribute('spellcheck');
		}
		return root;
	}

	function buildWordDocument(title) {
		var root = sanitizeWordClone(prepareExportRoot());
		var dir = contentDir;
		var pageLang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) || 'fa';
		var safeTitle = escapeHtml(title || 'Markdown Tools');
		return '<!DOCTYPE html>' +
			'<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
			'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
			'xmlns="http://www.w3.org/TR/REC-html40" lang="' + pageLang + '" dir="' + dir + '">' +
			'<head><meta charset="utf-8">' +
			'<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' +
			'<meta name="ProgId" content="Word.Document">' +
			'<meta name="Generator" content="Markdown Tools">' +
			'<title>' + safeTitle + '</title>' +
			'<style>' + wordStylesheet() + '</style>' +
			'<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View>' +
			'<w:DoNotHyphenateCaps/>' +
			'<w:Compatibility><w:BreakWrappedTables/><w:SnapToGridInCell/>' +
			'<w:WrapTextWithPunct/><w:UseAsianBreakRules/></w:Compatibility>' +
			'</w:WordDocument></xml><![endif]-->' +
			'</head><body><div class="WordSection1"><div class="markdown-body" dir="' + dir + '">' +
			root.innerHTML +
			'</div></div></body></html>';
	}

	function exportHeadAssets(needsPrism) {
		if (!needsPrism) return '';
		return '<link rel="stylesheet" href="' + PRISM_THEME_DARK + '">';
	}

	function exportBodyScripts(needsPrism, needsMermaid) {
		var parts = [];
		if (needsPrism) {
			parts.push('<script src="' + PRISM + 'prism.min.js"><\/script>');
			parts.push('<script src="' + PRISM + 'components/prism-markup.min.js"><\/script>');
			parts.push('<script src="' + PRISM + 'components/prism-clike.min.js"><\/script>');
			parts.push('<script src="' + PRISM + 'components/prism-markup-templating.min.js"><\/script>');
			parts.push('<script src="' + PRISM + 'plugins/autoloader/prism-autoloader.min.js"><\/script>');
			parts.push('<script>Prism.plugins.autoloader.languages_path="' + PRISM + 'components/";' +
				'document.querySelectorAll("pre.code-block code").forEach(function(el){try{Prism.highlightElement(el)}catch(e){}});<\/script>');
		}
		if (needsMermaid) {
			parts.push('<script src="' + VENDOR + 'mermaid/mermaid.min.js"><\/script>');
			parts.push('<script>mermaid.initialize({startOnLoad:false,theme:"default",securityLevel:"loose",fontFamily:"Vazirmatn, Tahoma, sans-serif"});' +
				'mermaid.run({nodes:document.querySelectorAll("pre.mermaid:not([data-processed])")}).catch(function(){});<\/script>');
		}
		return parts.join('');
	}

	function buildExportDocument(forPrint) {
		var root = prepareExportRoot();
		/* ponytail: PDF uses already-rendered tokens/SVG — skip CDN scripts so print isn't raced */
		var needsPrism = !forPrint && exportNeedsPrism(root);
		var needsMermaid = exportNeedsMermaid(root);

		return '<!doctype html><html lang="fa" dir="' + contentDir + '"><head>' +
			'<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
			'<title>Markdown Tools</title>' +
			exportHeadAssets(needsPrism) +
			'<style>' + exportStylesheet(forPrint) + '</style>' +
			'</head><body><article class="markdown-body">' + root.innerHTML + '</article>' +
			exportBodyScripts(needsPrism, needsMermaid) +
			'</body></html>';
	}

	function exportHtml() {
		var name = slugifyFilename(findDoc(docsState.activeId) && findDoc(docsState.activeId).title) + '.html';
		downloadFile(buildExportDocument(false), name, 'text/html');
	}

	function exportMarkdown() {
		var name = slugifyFilename(findDoc(docsState.activeId) && findDoc(docsState.activeId).title) + '.md';
		downloadFile($editor ? $editor.val() : '', name, 'text/markdown');
	}

	function whenPrintReady(win) {
		var doc = win.document;
		var fontsReady = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
		var images = Array.prototype.slice.call(doc.images || []);
		var imagesReady = Promise.all(images.map(function (img) {
			if (img.complete) return Promise.resolve();
			return new Promise(function (resolve) {
				img.onload = img.onerror = resolve;
			});
		}));
		return Promise.all([fontsReady, imagesReady]);
	}

	function exportPdf() {
		var html = buildExportDocument(true);
		var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
		var url = URL.createObjectURL(blob);
		var printWindow = window.open(url, '_blank');
		if (!printWindow) {
			URL.revokeObjectURL(url);
			window.alert('Allow pop-ups to export PDF.');
			return;
		}

		var printed = false;
		function cleanup() {
			try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
		}
		function doPrint() {
			if (printed) return;
			printed = true;
			try {
				printWindow.focus();
				printWindow.print();
			} catch (e) { /* ponytail: some browsers block print */ }
		}

		function start() {
			whenPrintReady(printWindow).then(function () {
				setTimeout(doPrint, 120);
			}).catch(function () {
				setTimeout(doPrint, 300);
			});
		}

		printWindow.addEventListener('afterprint', function () {
			cleanup();
			try { printWindow.close(); } catch (e) { /* ignore */ }
		});

		if (printWindow.document.readyState === 'complete') {
			start();
		} else {
			printWindow.addEventListener('load', start);
			setTimeout(start, 1500);
		}
	}

	/* html-to-image downscales when side × pixelRatio > 16384; browsers cap canvas ~32767px/side. */
	var HTML_TO_IMAGE_MAX_SIDE = 16384;
	var BROWSER_MAX_CANVAS_SIDE = 32767;

	function imageExportTargetPixelRatio() {
		return Math.min(3, Math.max(window.devicePixelRatio || 1, 2));
	}

	function imageExportTileCssHeight(pixelRatio) {
		return Math.floor(HTML_TO_IMAGE_MAX_SIDE / pixelRatio) - 32;
	}

	function imageExportSegmentCssHeight(pixelRatio) {
		return Math.floor(BROWSER_MAX_CANVAS_SIDE / pixelRatio) - 32;
	}

	function imageExportSliceCanvas(node, fullWidth, fullHeight, offsetY, sliceH, pixelRatio, bg) {
		/* translateY in html-to-image only renders for offset 0; shift children instead. */
		var wrap = document.createElement('div');
		wrap.setAttribute('data-rtlmd-export-slice', '1');
		wrap.style.cssText = 'position:relative;margin-top:-' + offsetY + 'px;width:100%;box-sizing:border-box;';
		var kids = Array.prototype.slice.call(node.childNodes);
		kids.forEach(function (child) {
			wrap.appendChild(child);
		});
		node.appendChild(wrap);
		node.style.height = sliceH + 'px';
		node.style.overflow = 'hidden';

		return window.htmlToImage.toCanvas(node, {
			width: fullWidth,
			height: sliceH,
			pixelRatio: pixelRatio,
			backgroundColor: bg,
			cacheBust: true,
			preferredFontFormat: 'woff2'
		}).then(function (canvas) {
			var inner = Array.prototype.slice.call(wrap.childNodes);
			inner.forEach(function (child) {
				node.appendChild(child);
			});
			wrap.remove();
			node.style.height = fullHeight + 'px';
			node.style.overflow = 'visible';
			return canvas;
		}, function (err) {
			try {
				if (wrap.parentNode === node) {
					var inner = Array.prototype.slice.call(wrap.childNodes);
					inner.forEach(function (child) {
						node.appendChild(child);
					});
					wrap.remove();
				}
				node.style.height = fullHeight + 'px';
				node.style.overflow = 'visible';
			} catch (e) { /* ignore restore errors */ }
			throw err;
		});
	}

	function imageExportSegmentCanvas(node, fullWidth, fullHeight, segmentY, segmentH, pixelRatio, bg) {
		var tileH = imageExportTileCssHeight(pixelRatio);
		var tiles = [];
		var y = 0;

		function captureNextTile() {
			if (y >= segmentH) {
				var outW = Math.ceil(fullWidth * pixelRatio);
				var outH = Math.ceil(segmentH * pixelRatio);
				var out = document.createElement('canvas');
				out.width = outW;
				out.height = outH;
				var ctx = out.getContext('2d');
				if (bg) {
					ctx.fillStyle = bg;
					ctx.fillRect(0, 0, outW, outH);
				}
				tiles.forEach(function (t) {
					ctx.drawImage(t.canvas, 0, Math.round(t.y * pixelRatio));
				});
				return Promise.resolve(out);
			}
			var h = Math.min(tileH, segmentH - y);
			var offsetY = segmentY + y;
			return imageExportSliceCanvas(node, fullWidth, fullHeight, offsetY, h, pixelRatio, bg).then(function (canvas) {
				tiles.push({ canvas: canvas, y: y, h: h });
				y += h;
				return captureNextTile();
			});
		}

		return captureNextTile();
	}

	function canvasToPngDataUrl(canvas) {
		var url = canvas.toDataURL('image/png');
		if (!url || url.length < 64 || url === 'data:,') {
			throw new Error('PNG encode failed');
		}
		return url;
	}

	function downloadDataUrlsSequential(items) {
		var i = 0;
		function next() {
			if (i >= items.length) return Promise.resolve();
			var item = items[i];
			i += 1;
			downloadDataUrl(item.dataUrl, item.filename);
			return new Promise(function (resolve) {
				setTimeout(resolve, 320);
			}).then(next);
		}
		return next();
	}

	function exportImagePngFiles(node, fullWidth, fullHeight, bg) {
		var pixelRatio = imageExportTargetPixelRatio();
		var segmentH = imageExportSegmentCssHeight(pixelRatio);
		var segments = [];
		var sy;
		for (sy = 0; sy < fullHeight; sy += segmentH) {
			segments.push({
				y: sy,
				h: Math.min(segmentH, fullHeight - sy)
			});
		}

		var base = slugifyFilename(findDoc(docsState.activeId) && findDoc(docsState.activeId).title);
		var outputs = [];
		var chain = Promise.resolve();

		segments.forEach(function (seg, idx) {
			chain = chain.then(function () {
				return imageExportSegmentCanvas(node, fullWidth, fullHeight, seg.y, seg.h, pixelRatio, bg).then(function (canvas) {
					var part = segments.length === 1
						? base + '.png'
						: base + '-part-' + String(idx + 1).padStart(2, '0') + '.png';
					outputs.push({ dataUrl: canvasToPngDataUrl(canvas), filename: part });
				});
			});
		});

		return chain.then(function () {
			return downloadDataUrlsSequential(outputs).then(function () {
				return segments.length;
			});
		});
	}

	function exportImage() {
		var node = document.getElementById('output');
		if (!node) return;

		var btn = document.querySelector('[data-export="image"]');
		if (btn) btn.disabled = true;

		var prev = {
			height: node.style.height,
			maxHeight: node.style.maxHeight,
			overflow: node.style.overflow
		};
		var fullWidth = Math.max(node.scrollWidth, node.clientWidth);
		var fullHeight = Math.max(node.scrollHeight, node.clientHeight);
		/* ponytail: expand scroll box so full content is captured, not just viewport */
		node.style.height = fullHeight + 'px';
		node.style.maxHeight = 'none';
		node.style.overflow = 'visible';

		var bg = window.getComputedStyle(node).backgroundColor || '#ffffff';

		var fontsReady = document.fonts && document.fonts.ready
			? document.fonts.ready
			: Promise.resolve();

		loadScriptOnce(
			VENDOR + 'html-to-image/html-to-image.js',
			'htmlToImage'
		).then(function () {
			if (!window.htmlToImage || !window.htmlToImage.toCanvas) {
				throw new Error('html-to-image unavailable');
			}
			return fontsReady.then(function () {
				return exportImagePngFiles(node, fullWidth, fullHeight, bg);
			});
		}).then(function (partCount) {
			if (partCount > 1) {
				window.alert(
					'سند بلند است؛ ' + partCount + ' تصویر PNG با کیفیت بالا دانلود شد (هر بخش حدود ' +
					Math.round(imageExportSegmentCssHeight(imageExportTargetPixelRatio()) / 1000) + ' هزار پیکسل).'
				);
			}
		}).catch(function () {
			window.alert('Image export failed. Try again.');
		}).then(function () {
			node.style.height = prev.height;
			node.style.maxHeight = prev.maxHeight;
			node.style.overflow = prev.overflow;
			if (btn) btn.disabled = false;
		});
	}

	function exportResult(format) {
		if (format === 'html') exportHtml();
		if (format === 'markdown') exportMarkdown();
		if (format === 'pdf') exportPdf();
		if (format === 'image') exportImage();
		if (format === 'docx' && typeof window.rtlmdExportDocx === 'function') {
			window.rtlmdExportDocx();
		}
	}

	function debounce(fn, ms) {
		var timer;
		return function () {
			clearTimeout(timer);
			timer = setTimeout(fn, ms);
		};
	}

	var scheduleSave = debounce(saveContent, 400);

	function onEditorChange() {
		var active = findDoc(docsState.activeId);
		if (active && active.pinned) {
			if ($editor && $editor.val() !== active.content) {
				$editor.val(active.content || '');
			}
			return;
		}
		if (!rafPending) {
			rafPending = true;
			requestAnimationFrame(function () {
				rafPending = false;
				renderPreview();
			});
		}
		scheduleSave();
		refreshActiveTitleUi();
	}

	function bindEditorEvents() {
		$editor = $('#textbox textarea');
		$editor.on('input', onEditorChange);
		$editor.on('compositionend', onEditorChange);
		$editor.on('keyup paste cut', onEditorChange);
		$editor.on('scroll', function () {
			onScrollSyncScroll(true);
		});
		$('#output').on('scroll', function () {
			onScrollSyncScroll(false);
		});
		$(window).on('resize', debounce(function () {
			if (scrollSyncOn) rebuildEditorLineYs();
		}, 150));
		$editor.on('keydown', function (e) {
			var active = findDoc(docsState.activeId);
			if (active && active.pinned) {
				if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
					/* ponytail: e.code is the physical key (layout-independent) — e.key
					   depends on the active keyboard layout (e.g. Persian) and would
					   silently fail to match, letting the browser's own shortcut fire. */
					var lockCode = e.code;
					if (lockCode === 'KeyB' || lockCode === 'KeyI' || lockCode === 'KeyK') {
						e.preventDefault();
					}
				}
				return;
			}
			if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
			var code = e.code;
			if (code === 'KeyB') {
				e.preventDefault();
				applyMdTool('bold');
			} else if (code === 'KeyI') {
				e.preventDefault();
				applyMdTool('italic');
			} else if (code === 'KeyK') {
				e.preventDefault();
				applyMdTool('link');
			}
		});
		bindMarkdownToolbar();
	}

	function loadInitialContent() {
		var existing = readDocsRaw();
		if (existing && existing.length) {
			ensureDocsBootstrapped();
			flushPendingExternalFiles();
			return;
		}

		var legacy = storageGet(STORAGE_KEY, null) || storageGet('content', null);
		if (legacy !== null && legacy !== '') {
			ensureDocsBootstrapped();
			flushPendingExternalFiles();
			return;
		}

		if (pendingExternalFiles.length) {
			ensureDocsBootstrapped('');
			flushPendingExternalFiles();
			return;
		}

		$.get(INIT_URL)
			.done(function (data) {
				ensureDocsBootstrapped(data);
				flushPendingExternalFiles();
			})
			.fail(function () {
				ensureDocsBootstrapped('# Markdown Tools\n\nStart writing…');
				flushPendingExternalFiles();
			});
	}

/* ===== src: app/js/src/core/90-boot.js ===== */
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

/* ===== src: app/js/src/extras/00-vars.js ===== */
/* ── 00-vars.js ──
   Shared module state (api handle) + localStorage keys. */

	var api = null;
	var LANG_KEY = 'rtlmd-lang';
	var SPELL_KEY = 'rtlmd-spellcheck';
	var AUTOSAVE_KEY = 'rtlmd-autosave-disk';
	var TOC_KEY = 'rtlmd-toc';
	var LINE_NUM_KEY = 'rtlmd-line-numbers';
	var MAX_SNAPSHOTS = 15;
	var mathPlaceholders = [];

/* ===== src: app/js/src/extras/10-i18n.js ===== */
/* ── 10-i18n.js ──
   en/fa string packs, lang()/t(), window.rtlmdT hook, document templates. */
	var STR = {
		en: {
			files: 'Files', editor: 'Editor', preview: 'Preview', editTab: 'Edit',
			searchDocs: 'Search documents…', openFolder: 'Open folder', backupExport: 'Export backup',
			backupImport: 'Import backup', newFromTemplate: 'New from template', settings: 'Settings',
			find: 'Find', replace: 'Replace', findNext: 'Next', findPrev: 'Previous', replaceOne: 'Replace',
			replaceAll: 'Replace all', close: 'Close', toc: 'Contents', wordCount: 'words',
			charCount: 'chars', readTime: 'min read', unsavedDiskLeave: 'This file has unsaved changes on disk. Leave anyway?',
			snapshot: 'Snapshot', restoreSnapshot: 'Restore snapshot', spellcheck: 'Spellcheck',
			autosaveDisk: 'Autosave to disk (linked files)', lineNumbers: 'Line numbers', language: 'Language',
			langEn: 'English', langFa: 'Persian', templateBlank: 'Blank', templateNote: 'Note',
			templateMeeting: 'Meeting', templateReadme: 'README', templateReport: 'Report',
			noSnapshots: 'No snapshots yet.', snapshotSaved: 'Snapshot saved.',
			duplicate: 'Duplicate', openFile: 'Open file', newDoc: 'New document', save: 'Save',
			exportDocx: 'Word (.docx)', frontMatter: 'Metadata',
			wordExportFailed: 'Word export failed. Please try again.',
			storageFullWarning: 'Browser storage is full — this change was NOT saved. Delete old documents or large pasted images, or export a backup, then try again.'
		},
		fa: {
			files: 'فایل‌ها', editor: 'ویرایشگر', preview: 'پیش‌نمایش', editTab: 'ویرایش',
			searchDocs: 'جستجو در اسناد…', openFolder: 'باز کردن پوشه', backupExport: 'خروجی پشتیبان',
			backupImport: 'ورود پشتیبان', newFromTemplate: 'سند از قالب', settings: 'تنظیمات',
			find: 'جستجو', replace: 'جایگزینی', findNext: 'بعدی', findPrev: 'قبلی', replaceOne: 'جایگزین',
			replaceAll: 'همه', close: 'بستن', toc: 'فهرست', wordCount: 'کلمه',
			charCount: 'کاراکتر', readTime: 'دقیقه مطالعه', unsavedDiskLeave: 'تغییرات ذخیره‌نشده روی دیسک دارید. خارج شوید؟',
			snapshot: 'نسخه', restoreSnapshot: 'بازیابی نسخه', spellcheck: 'املاء',
			autosaveDisk: 'ذخیره خودکار روی دیسک', lineNumbers: 'شماره خط', language: 'زبان',
			langEn: 'English', langFa: 'فارسی', templateBlank: 'خالی', templateNote: 'یادداشت',
			templateMeeting: 'جلسه', templateReadme: 'README', templateReport: 'گزارش',
			noSnapshots: 'نسخه‌ای نیست.', snapshotSaved: 'نسخه ذخیره شد.',
			duplicate: 'کپی', openFile: 'باز کردن فایل', newDoc: 'سند جدید', save: 'ذخیره',
			exportDocx: 'Word (.docx)', frontMatter: 'متادیتا',
			wordExportFailed: 'خروجی Word ناموفق بود. لطفاً دوباره تلاش کنید.',
			storageFullWarning: 'فضای ذخیره‌سازی مرورگر پر است — این تغییر ذخیره نشد. چند سند قدیمی یا تصویر بزرگ چسبانده‌شده را حذف کنید یا یک پشتیبان خروجی بگیرید و دوباره تلاش کنید.'
		}
	};

	function lang() {
		return storageGet(LANG_KEY, 'fa') === 'en' ? 'en' : 'fa';
	}

	function t(key) {
		var pack = STR[lang()] || STR.en;
		return pack[key] || STR.en[key] || key;
	}

	window.rtlmdT = t;

	var TEMPLATES = {
		blank: '# New document\n\n',
		note: '# یادداشت\n\n- \n\n',
		meeting: '# جلسه\n\n**تاریخ:** \n\n**حاضرین:** \n\n## دستور\n\n1. \n\n## تصمیمات\n\n- \n',
		readme: '# Project\n\n## Overview\n\n## Install\n\n```bash\n\n```\n',
		report: '# گزارش\n\n## خلاصه\n\n## جزئیات\n\n## نتیجه\n\n'
	};

/* ===== src: app/js/src/extras/20-math-markdown.js ===== */
/* ── 20-math-markdown.js ──
   Front-matter split, KaTeX math placeholders, pre/postprocess hooks. */
	function splitFrontMatter(src) {
		var text = String(src || '');
		if (!/^---\r?\n/.test(text)) return { meta: null, body: text };
		var m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
		if (!m) return { meta: null, body: text };
		return { meta: m[1], body: text.slice(m[0].length) };
	}

	function parseSimpleYaml(yaml) {
		var out = {};
		String(yaml || '').split(/\r?\n/).forEach(function (line) {
			var p = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$/);
			if (p) out[p[1]] = p[2].replace(/^["']|["']$/g, '');
		});
		return out;
	}

	/* Markers use a plain div/span with a data attribute (not an HTML comment) because
	   the render pipeline now runs everything through DOMPurify before this postprocess
	   step — and sanitizers strip HTML comments outright (a long-standing IE/mXSS attack
	   vector), which would silently swallow every math placeholder. */
	function mathPlaceholderTag(display) {
		return display ? 'div' : 'span';
	}

	/* Pre-existing bug (not introduced by the DOMPurify change, just surfaced by it):
	   the $/$$ math scanner below runs on the *raw* markdown text, before `marked` has
	   any concept of code spans/fences. So a literal `$$E=mc^2$$` written inside
	   backticks — to *show* KaTeX syntax as code, exactly like explaining this feature —
	   got treated as real math. That splices an HTML placeholder tag into the middle of
	   a backtick span, which corrupts the span for marked's inline lexer and can swallow
	   most of the remaining document into one broken <code> run (the "half the content
	   disappeared" symptom). Fenced code blocks and inline code spans must never be
	   scanned for math, so they're protected (swapped for opaque tokens) first and
	   restored verbatim afterward. */
	function protectCodeRegions(text, regex, store) {
		return text.replace(regex, function (match) {
			var i = store.length;
			store.push(match);
			return '\u0000CODE' + i + '\u0000';
		});
	}

	function restoreCodeRegions(text, store) {
		if (!store.length) return text;
		return text.replace(/\u0000CODE(\d+)\u0000/g, function (_, idx) {
			var raw = store[Number(idx)];
			return raw === undefined ? '' : raw;
		});
	}

	var FENCE_RE = /(^|\n)[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]{0,3}\2[ \t]*(?=\n|$)/g;
	var INLINE_CODE_RE = /(`+)[\s\S]*?\1/g;

	/* Word-boundary test for `**bold**` finishing (below): any letter/number
	   in any script, plus underscore. Intraword runs like 2**3**4 stay literal. */
	function isStrongWordChar(ch) {
		return !!ch && /[\p{L}\p{N}_]/u.test(ch);
	}

	/* Matches one `**...**` span on the code-PROTECTED source, where inline code
	   and fences are opaque  tokens (they contain no asterisks, so spans
	   never open or close inside code). Content may hold code tokens, single
	   newlines and any non-`*` chars — but no blank line and no nested `*`. */
	var STRONG_SPAN_RE = /\*\*((?:[^*\n]|\n(?!\n)|[^\0]*\0)+?)\*\*/g;

	function strongSpanHasMultilineCode(inner, codeStore) {
		var m;
		var re = /CODE(\d+)/g;
		while ((m = re.exec(inner))) {
			var raw = codeStore[Number(m[1])];
			if (raw !== undefined && raw.indexOf('\n') !== -1) return true;
		}
		return false;
	}

	/* Convert the `**bold**` spans that marked's own tokenizer leaves literal
	   (e.g. a closer preceded by `)` and followed by `،`) into real <strong>,
	   eagerly, so preview and Word agree. The inner markdown is parsed with the
	   real marked pipeline and flows through the normal DOMPurify pass with
	   everything else — no second sanitizer needed.
	   Rejected (left for marked, i.e. today's behavior): native `***a***`,
	   `**a *b* c**`, spans nested inside a rejected outer (the scan re-tries
	   from just past the rejected opener, so inner pairs still convert),
	   intraword 2**3**4, escaped \**, spans across blank lines, and spans
	   swallowing multiline code. */
	function convertLiteralStrong(body, codeStore) {
		if (typeof marked === 'undefined' || typeof marked.parseInline !== 'function') return body;
		if (body.indexOf('**') === -1) return body;
		var out = '';
		var pos = 0;
		var m;
		STRONG_SPAN_RE.lastIndex = 0;
		while ((m = STRONG_SPAN_RE.exec(body))) {
			if (m.index < pos) continue;
			var inner = m[1];
			var before = m.index > 0 ? body.charAt(m.index - 1) : '';
			var afterIdx = m.index + m[0].length;
			var after = afterIdx < body.length ? body.charAt(afterIdx) : '';
			var ok = before !== '*' && after !== '*' && before !== '\\' &&
				!isStrongWordChar(before) && !isStrongWordChar(after) &&
				!strongSpanHasMultilineCode(inner, codeStore);
			if (!ok) {
				STRONG_SPAN_RE.lastIndex = m.index + 2;
				continue;
			}
			out += body.slice(pos, m.index);
			out += '<strong>' + marked.parseInline(restoreCodeRegions(inner, codeStore)) + '</strong>';
			pos = afterIdx;
			STRONG_SPAN_RE.lastIndex = pos;
		}
		return out + body.slice(pos);
	}

	function preprocessMarkdown(src) {
		mathPlaceholders = [];
		var parts = splitFrontMatter(src);
		var body = parts.body;

		/* Order matters: extract whole fenced blocks first so the inline-code regex
		   below never runs its backtick matching across (or inside) a fence's content. */
		var codeStore = [];
		body = protectCodeRegions(body, FENCE_RE, codeStore);
		body = protectCodeRegions(body, INLINE_CODE_RE, codeStore);

		body = body.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
			var i = mathPlaceholders.length;
			mathPlaceholders.push({ display: true, tex: tex.trim() });
			return '\n\n<div class="rtlmd-math-ph" data-math-index="' + i + '"></div>\n\n';
		});

		body = body.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, function (m, pre, tex) {
			var i = mathPlaceholders.length;
			mathPlaceholders.push({ display: false, tex: tex.trim() });
			return pre + '<span class="rtlmd-math-ph" data-math-index="' + i + '"></span>';
		});

		/* Finish `**bold**` spans marked leaves literal (code is still protected
		   above, math placeholders are already extracted, so neither is harmed). */
		body = convertLiteralStrong(body, codeStore);

		/* Put the protected code back exactly as written — never math-processed. */
		body = restoreCodeRegions(body, codeStore);

		if (parts.meta) {
			window.__rtlmdFrontMatter = parseSimpleYaml(parts.meta);
		} else {
			window.__rtlmdFrontMatter = null;
		}
		return body;
	}

	function renderKatex(tex, display) {
		if (typeof katex === 'undefined') {
			return '<code>' + tex.replace(/</g, '&lt;') + '</code>';
		}
		try {
			return katex.renderToString(tex, {
				displayMode: !!display,
				throwOnError: false,
				output: 'html'
			});
		} catch (e) {
			return '<code>' + tex.replace(/</g, '&lt;') + '</code>';
		}
	}

	function postprocessMarkdownHtml(html) {
		if (!mathPlaceholders.length) return html;
		/* DOM-based replacement (not string/regex matching) so this stays correct no
		   matter how the sanitizer reorders/re-serializes the placeholder's attributes. */
		var wrap = document.createElement('div');
		wrap.innerHTML = html;
		var placeholders = wrap.querySelectorAll('.rtlmd-math-ph');
		placeholders.forEach(function (el) {
			var idx = Number(el.getAttribute('data-math-index'));
			var item = mathPlaceholders[idx];
			if (!item) {
				el.remove();
				return;
			}
			var replacement = document.createElement(mathPlaceholderTag(item.display));
			replacement.className = item.display ? 'math-block' : 'math-inline';
			replacement.setAttribute('dir', 'ltr');
			replacement.innerHTML = renderKatex(item.tex, item.display);
			el.replaceWith(replacement);
		});
		return wrap.innerHTML;
	}

	window.rtlmdPreprocessMarkdown = preprocessMarkdown;
	window.rtlmdPostprocessMarkdownHtml = postprocessMarkdownHtml;

/* ===== src: app/js/src/extras/30-content-widgets.js ===== */
/* ── 30-content-widgets.js ──
   i18n apply, word count, TOC build/toggle, front-matter banner. */
	function applyI18n() {
		document.querySelectorAll('[data-i18n]').forEach(function (el) {
			var key = el.getAttribute('data-i18n');
			if (key) el.textContent = t(key);
		});
		document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
			var key = el.getAttribute('data-i18n-placeholder');
			if (key) el.setAttribute('placeholder', t(key));
		});
		document.querySelectorAll('[data-i18n-title]').forEach(function (el) {
			var key = el.getAttribute('data-i18n-title');
			if (key) el.setAttribute('title', t(key));
		});
		document.documentElement.lang = lang();
	}

	function countStats(text) {
		var s = String(text || '');
		var chars = s.length;
		var words = (s.trim().match(/[^\s]+/g) || []).length;
		var mins = Math.max(1, Math.ceil(words / 200));
		return { words: words, chars: chars, mins: mins };
	}

	function updateWordCount() {
		var el = document.getElementById('editor-stats');
		if (!el || !api) return;
		var ed = api.getEditor();
		var text = ed && ed.length ? ed.val() : '';
		var st = countStats(text);
		el.textContent = st.words + ' ' + t('wordCount') + ' · ' + st.chars + ' ' + t('charCount') +
			' · ~' + st.mins + ' ' + t('readTime');
	}

	function tocEnabledInSettings() {
		return storageGet(TOC_KEY, '1') !== '0';
	}

	function syncTocVisibility() {
		var nav = document.getElementById('preview-toc');
		if (!nav) return;
		var toggleBtn = document.getElementById('toc-toggle');
		var full = document.body.classList.contains('fullview');
		var hasList = !!nav.querySelector('.toc-list');
		var show = full && tocEnabledInSettings() && hasList;
		nav.classList.toggle('hidden', !show);
		if (toggleBtn) {
			var canToggle = full && hasList;
			toggleBtn.classList.toggle('hidden', !canToggle);
			toggleBtn.classList.toggle('is-active', show);
			toggleBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
		}
	}

	function buildTocFromHtml() {
		var out = document.getElementById('output');
		var nav = document.getElementById('preview-toc');
		if (!out || !nav) return;
		var heading = nav.querySelector('.toc-heading');
		nav.innerHTML = '';
		if (heading) nav.appendChild(heading);
		var heads = out.querySelectorAll('h1,h2,h3,h4');
		if (!heads.length) {
			syncTocVisibility();
			return;
		}
		var ul = document.createElement('ul');
		ul.className = 'toc-list';
		heads.forEach(function (h, i) {
			if (!h.id) h.id = 'rtlmd-h-' + i;
			var li = document.createElement('li');
			li.className = 'toc-l' + h.tagName.slice(1);
			var a = document.createElement('a');
			a.href = '#' + h.id;
			a.textContent = h.textContent;
			a.addEventListener('click', function (e) {
				e.preventDefault();
				h.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
			li.appendChild(a);
			ul.appendChild(li);
		});
		nav.appendChild(ul);
		syncTocVisibility();
	}

	window.rtlmdOnFullviewChange = function () {
		syncTocVisibility();
	};

	function closeToc() {
		storageSet(TOC_KEY, '0');
		syncTocVisibility();
	}

	function toggleToc() {
		storageSet(TOC_KEY, tocEnabledInSettings() ? '0' : '1');
		syncTocVisibility();
	}

	function renderFrontMatterBanner() {
		var host = document.getElementById('front-matter-banner');
		if (!host) return;
		var fm = window.__rtlmdFrontMatter;
		if (!fm || !Object.keys(fm).length) {
			host.classList.add('hidden');
			host.innerHTML = '';
			return;
		}
		host.classList.remove('hidden');
		var rows = Object.keys(fm).map(function (k) {
			return '<tr><th>' + k + '</th><td>' + String(fm[k]).replace(/</g, '&lt;') + '</td></tr>';
		}).join('');
		host.innerHTML = '<div class="fm-title">' + t('frontMatter') + '</div><table><tbody>' + rows + '</tbody></table>';
	}

/* ===== src: app/js/src/extras/40-find-images.js ===== */
/* ── 40-find-images.js ──
   Doc-list search filter, image paste/drop, find & replace panel. */
	function filterDocList(query) {
		var q = String(query || '').trim().toLowerCase();
		document.querySelectorAll('#doc-list .doc-item').forEach(function (li) {
			var id = li.getAttribute('data-id');
			var doc = api && id ? api.findDoc(id) : null;
			var title = (li.querySelector('.doc-title') || {}).textContent || '';
			var show = !q || title.toLowerCase().indexOf(q) !== -1 ||
				(doc && (doc.content || '').toLowerCase().indexOf(q) !== -1);
			li.classList.toggle('hidden-by-search', !show);
		});
	}

	function insertImageMarkdown(dataUrl, alt) {
		if (!api) return;
		var ed = api.getEditor();
		if (!ed || !ed.length) return;
		var el = ed[0];
		var md = '\n\n![' + (alt || 'image') + '](' + dataUrl + ')\n\n';
		var start = el.selectionStart;
		var val = el.value;
		el.value = val.slice(0, start) + md + val.slice(el.selectionEnd);
		el.focus();
		el.selectionStart = el.selectionEnd = start + md.length;
		api.onEditorChange();
	}

	function readFileAsDataUrl(file) {
		return new Promise(function (resolve, reject) {
			var reader = new FileReader();
			reader.onload = function () { resolve(reader.result); };
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	function bindImagePasteDrop() {
		var box = document.getElementById('textbox');
		if (!box) return;
		box.addEventListener('paste', function (e) {
			var items = e.clipboardData && e.clipboardData.items;
			if (!items) return;
			for (var i = 0; i < items.length; i++) {
				if (items[i].type.indexOf('image') === 0) {
					var file = items[i].getAsFile();
					if (!file) continue;
					e.preventDefault();
					readFileAsDataUrl(file).then(function (url) {
						insertImageMarkdown(url, 'pasted-image');
					});
					return;
				}
			}
		});
		box.addEventListener('dragover', function (e) {
			if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) {
				e.preventDefault();
			}
		});
		box.addEventListener('drop', function (e) {
			var files = e.dataTransfer && e.dataTransfer.files;
			if (!files || !files.length) return;
			var file = files[0];
			if (!file.type || file.type.indexOf('image') !== 0) return;
			e.preventDefault();
			readFileAsDataUrl(file).then(function (url) {
				insertImageMarkdown(url, file.name || 'image');
			});
		});
	}

	var findState = { idx: 0 };

	function getFindMatches(text, needle, caseSensitive) {
		if (!needle) return [];
		var src = String(text || '');
		var hay = caseSensitive ? src : src.toLowerCase();
		var n = caseSensitive ? needle : needle.toLowerCase();
		var out = [];
		var pos = 0;
		while (pos <= hay.length) {
			var at = hay.indexOf(n, pos);
			if (at === -1) break;
			out.push({ start: at, end: at + needle.length });
			pos = at + (needle.length || 1);
		}
		return out;
	}

	function applyFindHighlight() {
		/* selection-based find — no overlay */
	}

	function runFind(direction) {
		if (!api) return;
		var ed = api.getEditor();
		if (!ed || !ed.length) return;
		var el = ed[0];
		var needle = (document.getElementById('find-input') || {}).value || '';
		if (!needle) return;
		var caseBox = document.getElementById('find-case');
		var matches = getFindMatches(el.value, needle, caseBox && caseBox.checked);
		if (!matches.length) return;
		if (direction === 'next') findState.idx = (findState.idx + 1) % matches.length;
		else findState.idx = (findState.idx - 1 + matches.length) % matches.length;
		var m = matches[findState.idx];
		el.focus();
		el.setSelectionRange(m.start, m.end);
		var lineH = parseFloat(getComputedStyle(el).lineHeight) || 20;
		el.scrollTop = Math.max(0, (el.value.slice(0, m.start).split('\n').length - 3) * lineH);
	}

	function runReplace(all) {
		if (!api) return;
		var ed = api.getEditor();
		if (!ed || !ed.length) return;
		var el = ed[0];
		var needle = (document.getElementById('find-input') || {}).value || '';
		var repl = (document.getElementById('replace-input') || {}).value || '';
		if (!needle) return;
		var caseBox = document.getElementById('find-case');
		var val = el.value;
		if (all) {
			var re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseBox && caseBox.checked ? 'g' : 'gi');
			el.value = val.replace(re, repl);
		} else {
			var start = el.selectionStart;
			var end = el.selectionEnd;
			var slice = val.slice(start, end);
			var matches = caseBox && caseBox.checked ? slice === needle : slice.toLowerCase() === needle.toLowerCase();
			if (matches) {
				el.value = val.slice(0, start) + repl + val.slice(end);
				el.setSelectionRange(start, start + repl.length);
			} else {
				runFind('next');
				return;
			}
		}
		api.onEditorChange();
	}

	function toggleFindPanel(show) {
		var panel = document.getElementById('find-panel');
		if (!panel) return;
		panel.classList.toggle('hidden', show === false);
		if (show !== false) {
			panel.classList.remove('hidden');
			var input = document.getElementById('find-input');
			if (input) input.focus();
		}
	}

/* ===== src: app/js/src/extras/50-snapshots.js ===== */
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

/* ===== src: app/js/src/extras/60-export-word.js ===== */
/* ── 60-export-word.js ──
   Real .docx export (lazy OOXML bundle) with styled .doc fallback. */
	var WORD_BUNDLE_SRC = 'assets/vendor/docx/word-docx.bundle.js';
	var WORD_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	var wordBundlePromise = null;

	/* Real .docx export is lazy-loaded so the ~400 KB OOXML engine never slows
	   down startup; the bundle is same-origin + SW-precached, so offline works. */
	function ensureWordBundle() {
		if (window.RtlmWordDocx && typeof window.RtlmWordDocx.buildDocxBlob === 'function') {
			return Promise.resolve();
		}
		if (wordBundlePromise) return wordBundlePromise;
		wordBundlePromise = new Promise(function (resolve, reject) {
			var s = document.createElement('script');
			s.src = WORD_BUNDLE_SRC;
			s.onload = function () {
				if (window.RtlmWordDocx && typeof window.RtlmWordDocx.buildDocxBlob === 'function') resolve();
				else reject(new Error('word bundle has no api'));
			};
			s.onerror = function () { reject(new Error('word bundle failed to load')); };
			document.head.appendChild(s);
		});
		return wordBundlePromise;
	}

	function downloadBlob(blob, filename, type) {
		var out = blob instanceof Blob ? blob : new Blob([blob], { type: type });
		var url = URL.createObjectURL(out);
		var a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
	}

	function legacyWordDoc(doc) {
		var styledHtml = null;
		if (api && typeof api.buildWordDocument === 'function') {
			try { styledHtml = api.buildWordDocument(doc.title); } catch (e) { styledHtml = null; }
		}
		if (!styledHtml) {
			var raw = document.getElementById('output').innerHTML;
			styledHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body dir="' +
				api.getContentDir() + '">' + raw + '</body></html>';
		}
		api.downloadFile('﻿' + styledHtml, api.slugifyFilename(doc.title) + '.doc', 'application/msword');
	}

	window.rtlmdExportDocx = function () {
		if (!api) return;
		var doc = api.findDoc(api.docsState.activeId);
		if (!doc) return;
		var btn = document.querySelector('[data-export="docx"]');
		if (btn) btn.disabled = true;
		function done() { if (btn) btn.disabled = false; }
		ensureWordBundle().then(function () {
			return window.RtlmWordDocx.buildDocxBlob({
				title: doc.title,
				dir: api.getContentDir(),
				html: document.getElementById('output').innerHTML
			});
		}).then(function (blob) {
			downloadBlob(blob, api.slugifyFilename(doc.title) + '.docx', WORD_DOCX_MIME);
			done();
		}).catch(function () {
			/* offline-safe fallback: styled Word-HTML (.doc) */
			try {
				legacyWordDoc(doc);
			} catch (e) {
				window.alert(t('wordExportFailed'));
			}
			done();
		});
	};

/* ===== src: app/js/src/extras/70-backup-folder.js ===== */
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

/* ===== src: app/js/src/extras/80-settings.js ===== */
/* ── 80-settings.js ──
   Line numbers, disk autosave, spellcheck pref, settings dialog. */
	function syncLineNumbers() {
		var ta = document.querySelector('#textbox textarea');
		var gutter = document.getElementById('line-numbers');
		if (!ta || !gutter) return;
		if (storageGet(LINE_NUM_KEY, '0') !== '1') {
			gutter.classList.add('hidden');
			return;
		}
		gutter.classList.remove('hidden');
		var lines = String(ta.value || '').split('\n').length;
		var nums = [];
		for (var i = 1; i <= lines; i++) nums.push(i);
		gutter.textContent = nums.join('\n');
		gutter.scrollTop = ta.scrollTop;
	}

	function bindLineNumbers() {
		var ta = document.querySelector('#textbox textarea');
		if (!ta) return;
		ta.addEventListener('scroll', syncLineNumbers);
		ta.addEventListener('input', syncLineNumbers);
	}

	var autosaveTimer = null;
	function setupAutosave() {
		clearInterval(autosaveTimer);
		if (storageGet(AUTOSAVE_KEY, '0') !== '1') return;
		autosaveTimer = setInterval(function () {
			if (!api || !api.isActiveDocDiskDirty()) return;
			var doc = api.findDoc(api.docsState.activeId);
			if (!doc || !api.canWriteDocToDisk(doc)) return;
			api.persistActiveFromEditor({ silentList: true });
			api.saveActiveDocToDisk();
		}, 45000);
	}

	function applySpellcheckPref() {
		var ta = document.querySelector('#textbox textarea');
		if (!ta) return;
		ta.spellcheck = storageGet(SPELL_KEY, '0') === '1';
	}

	function openSettings() {
		var dlg = document.getElementById('settings-dialog');
		if (!dlg) return;
		dlg.querySelector('#set-lang').value = lang();
		dlg.querySelector('#set-spell').checked = storageGet(SPELL_KEY, '0') === '1';
		dlg.querySelector('#set-autosave').checked = storageGet(AUTOSAVE_KEY, '0') === '1';
		dlg.querySelector('#set-linenum').checked = storageGet(LINE_NUM_KEY, '0') === '1';
		dlg.querySelector('#set-toc').checked = storageGet(TOC_KEY, '1') !== '0';
		dlg.showModal();
	}

	function saveSettingsFromDialog() {
		var dlg = document.getElementById('settings-dialog');
		if (!dlg) return;
		storageSet(LANG_KEY, dlg.querySelector('#set-lang').value);
		storageSet(SPELL_KEY, dlg.querySelector('#set-spell').checked ? '1' : '0');
		storageSet(AUTOSAVE_KEY, dlg.querySelector('#set-autosave').checked ? '1' : '0');
		storageSet(LINE_NUM_KEY, dlg.querySelector('#set-linenum').checked ? '1' : '0');
		storageSet(TOC_KEY, dlg.querySelector('#set-toc').checked ? '1' : '0');
		applyI18n();
		applySpellcheckPref();
		setupAutosave();
		syncLineNumbers();
		syncTocVisibility();
		dlg.close();
	}

/* ===== src: app/js/src/extras/90-init.js ===== */
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

}());
