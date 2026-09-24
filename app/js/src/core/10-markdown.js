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
