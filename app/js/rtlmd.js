(function () {
	'use strict';

	var INIT_URL = 'initcontent.md';
	var STORAGE_KEY = 'rtlmd-content';
	var DOCS_KEY = 'rtlmd-docs';
	var ACTIVE_ID_KEY = 'rtlmd-active-id';
	var SIDEBAR_KEY = 'rtlmd-sidebar';
	var THEME_KEY = 'rtlmd-theme';
	var DIR_KEY = 'rtlmd-dir';
	var FONT_KEY = 'rtlmd-font-size';
	var FULLVIEW_KEY = 'rtlmd-fullview';
	var MAX_DOCS = 40;
	var UNTITLED = 'Untitled';

	var DARK_THEMES = {
		dark: 1, night: 1, dracula: 1, dim: 1, nord: 1, sunset: 1,
		forest: 1, luxury: 1, coffee: 1, business: 1, halloween: 1,
		synthwave: 1, black: 1, cyberpunk: 1,
		'karnoweb-dark': 1
	};

	var PRISM_THEME_DARK = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css';
	var PRISM_THEME_LIGHT = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism.min.css';

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

	var contentDir = 'rtl';

	function dirAttr() {
		return ' dir="' + contentDir + '"';
	}

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
		return '<table' + dirAttr() + '><thead>' + header + '</thead><tbody>' + body + '</tbody></table>';
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
		if (norm === 'mermaid') {
			return '<div class="mermaid-wrap" dir="ltr"><pre class="mermaid">' + code + '</pre></div>';
		}
		var langAttr = norm || 'none';
		var label = norm
			? '<span class="code-lang" dir="ltr">' + norm + '</span>'
			: '';
		return '<pre dir="ltr" class="code-block language-' + langAttr + '">' +
			label +
			'<code dir="ltr" class="language-' + langAttr + '">' + code + '</code></pre>';
	};

	renderer.codespan = function (code) {
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

	function parseMarkdown(src) {
		return marked.parse(src);
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
		} catch (e) { /* ponytail: quota/private mode */ }
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
		return storageGet(THEME_KEY, 'karnoweb-dark');
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

	function highlightCode() {
		if (typeof Prism === 'undefined') return;
		$('#output pre.code-block code').each(function () {
			try {
				Prism.highlightElement(this);
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
			mermaid.run({ nodes: nodes }).catch(function () {
				/* ponytail: bad diagram syntax — source stays visible in pre */
			});
		} catch (e) { /* ponytail: mermaid unavailable */ }
	}

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
		$('#editor').attr('dir', dir);
		$('#dir-rtl').toggleClass('btn-active', dir === 'rtl');
		$('#dir-ltr').toggleClass('btn-active', dir === 'ltr');
		storageSet(DIR_KEY, dir);
		if (!skipRender) {
			renderPreview();
		}
	}

	function initDirection() {
		applyDirection(storageGet(DIR_KEY, 'rtl'), true);
	}

	function applyFontSize(size) {
		var large = size === 'large';
		document.documentElement.classList.toggle('font-large', large);
		$('#font-size-label').text(large ? 'Normal' : 'Large');
		$('#font-size-toggle').toggleClass('btn-active', large);
		storageSet(FONT_KEY, size);
	}

	function initFontSize() {
		applyFontSize(storageGet(FONT_KEY, 'normal'));
	}

	function setFullview(on) {
		$('body').toggleClass('fullview', on);
		$('#fullview-label').text(on ? 'Exit full preview' : 'Full preview');
		$('#fullview-icon-expand').toggleClass('hidden', on);
		$('#fullview-icon-collapse').toggleClass('hidden', !on);
		storageSet(FULLVIEW_KEY, on ? '1' : '0');
	}

	function initFullview() {
		setFullview(storageGet(FULLVIEW_KEY, '0') === '1');
	}

	function setSidebarOpen(on) {
		document.documentElement.classList.toggle('sidebar-collapsed', !on);
		$('#sidebar-toggle').attr('aria-expanded', on ? 'true' : 'false');
		var mobile = window.matchMedia('(max-width: 900px)').matches;
		$('#sidebar-backdrop').prop('hidden', !(on && mobile));
		storageSet(SIDEBAR_KEY, on ? '1' : '0');
	}

	function initSidebar() {
		var open = storageGet(SIDEBAR_KEY, '1') !== '0';
		setSidebarOpen(open);
	}

	/* ── Document history (localStorage) ───────────────── */
	var docsState = { items: [], activeId: null };

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
		try {
			storageSet(DOCS_KEY, JSON.stringify(items));
			return true;
		} catch (e) {
			window.alert('Could not save history (browser storage may be full).');
			return false;
		}
	}

	function sortDocs(items) {
		/* ponytail: stable order by creation time — editing must not reshuffle the list */
		return items.slice().sort(function (a, b) {
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

	function updateActiveTitleUi(title) {
		var el = document.getElementById('active-doc-title');
		if (!el) return;
		el.textContent = title || '';
		el.title = title || '';
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
			$li.attr('data-id', doc.id);

			var $open = $('<button type="button" class="doc-open"></button>');
			$open.append($('<span class="doc-title"></span>').text(doc.title || UNTITLED));
			$open.append($('<span class="doc-meta"></span>').text(formatDocTime(doc.createdAt || doc.updatedAt)));
			$open.attr('title', doc.title || UNTITLED);

			var $actions = $('<div class="doc-actions"></div>');
			$actions.append(
				$('<button type="button" class="doc-rename icon-btn-xs" title="Rename">✎</button>'),
				$('<button type="button" class="doc-delete icon-btn-xs" title="Delete">×</button>')
			);

			$li.append($open, $actions);
			$list.append($li);
		});
	}

	function persistActiveFromEditor(opts) {
		opts = opts || {};
		if (!$editor || !$editor.length || !docsState.activeId) return;
		var doc = findDoc(docsState.activeId);
		if (!doc) return;
		var content = $editor.val();
		doc.content = content;
		doc.updatedAt = Date.now();
		if (!opts.keepTitle) {
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
		updateActiveTitleUi(doc.title || UNTITLED);
		storageSet(STORAGE_KEY, doc.content || '');
		if (!opts.skipRender) renderPreview();
		renderDocList();
	}

	function createDoc(content, title) {
		persistActiveFromEditor({ silentList: true });
		var items = docsState.items.slice();
		if (items.length >= MAX_DOCS) {
			items = sortDocs(items);
			var victims = items.filter(function (d) { return d.id !== docsState.activeId; });
			while (items.length >= MAX_DOCS && victims.length) {
				var drop = victims.pop();
				items = items.filter(function (d) { return d.id !== drop.id; });
			}
			if (items.length >= MAX_DOCS) {
				window.alert('Document limit (' + MAX_DOCS + ') reached. Delete one first.');
				return null;
			}
		}
		var now = Date.now();
		var doc = {
			id: uid(),
			title: title || titleFromContent(content || '') || UNTITLED,
			content: content || '',
			updatedAt: now,
			createdAt: now
		};
		items.unshift(doc);
		writeDocs(items);
		loadDocIntoEditor(doc);
		return doc;
	}

	function openDoc(id) {
		if (!id || id === docsState.activeId) return;
		var doc = findDoc(id);
		if (!doc) return;
		persistActiveFromEditor({ silentList: true });
		loadDocIntoEditor(doc);
		if (window.matchMedia('(max-width: 900px)').matches) {
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
		writeDocs(docsState.items);
		if (doc.id === docsState.activeId) updateActiveTitleUi(doc.title);
		renderDocList();
	}

	function deleteDoc(id) {
		if (docsState.items.length <= 1) {
			window.alert('At least one document must remain.');
			return;
		}
		var doc = findDoc(id);
		if (!doc) return;
		if (!window.confirm('Delete "' + (doc.title || UNTITLED) + '"?')) return;
		var wasActive = doc.id === docsState.activeId;
		var items = docsState.items.filter(function (d) { return d.id !== id; });
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
					updatedAt: d.updatedAt || Date.now(),
					createdAt: d.createdAt || d.updatedAt || Date.now()
				};
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
			updatedAt: Date.now(),
			createdAt: Date.now()
		};
		writeDocs([doc]);
		loadDocIntoEditor(doc);
	}

	function bindDocsUi() {
		$('#doc-new').on('click', function () {
			createDoc('# New document\n\n');
		});

		$('#doc-list').on('click', '.doc-open', function () {
			openDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-rename', function (e) {
			e.stopPropagation();
			renameDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-delete', function (e) {
			e.stopPropagation();
			deleteDoc($(this).closest('.doc-item').data('id'));
		});

		$('#sidebar-toggle').on('click', function () {
			setSidebarOpen(document.documentElement.classList.contains('sidebar-collapsed'));
		});

		$('#sidebar-backdrop').on('click', function () {
			setSidebarOpen(false);
		});

		$(window).on('beforeunload', function () {
			persistActiveFromEditor({ silentList: true, keepTitle: false });
		});
	}

	function runDocsSelfCheck() {
		var fails = [];
		function ok(cond, msg) {
			if (!cond) fails.push(msg);
		}
		ok(titleFromContent('# Hello world\n\nx') === 'Hello world', 'heading title');
		ok(titleFromContent('   ') === UNTITLED, 'empty title');
		ok(titleFromContent('First line\nsecond') === 'First line', 'first line title');
		ok(!!uid() && uid() !== uid(), 'uid uniqueness');
		ok(slugifyFilename('a/b:c').indexOf('/') === -1, 'slugify');
		ok(sortDocs([
			{ id: 'a', createdAt: 1 },
			{ id: 'b', createdAt: 3 },
			{ id: 'c', createdAt: 2 }
		]).map(function (d) { return d.id; }).join('') === 'bca', 'sort by createdAt');
		if (fails.length) {
			console.error('[rtlmd selfcheck] FAIL', fails);
			window.alert('Self-check failed: ' + fails.join(', '));
		} else {
			console.info('[rtlmd selfcheck] OK');
		}
	}

	var $editor = null;
	var rafPending = false;

	function renderPreview() {
		if (!$editor || !$editor.length) return;
		try {
			$('#output').html(parseMarkdown($editor.val()));
		} catch (err) {
			$('#output').html('<p class="render-error">Markdown render error</p>');
			return;
		}
		highlightCode();
		renderMermaid();
	}

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
			'@import url("https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css");',
			'@import url("https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&display=swap");',
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
			'.markdown-body ul,.markdown-body ol{margin:0 0 1em;padding-inline-start:1.6em}',
			'.markdown-body li{margin-bottom:.4em}',
			'.markdown-body blockquote{margin:0 0 1em;padding:.45em 0 .45em 1.1em;border-inline-start:4px solid #93c5fd;opacity:.95;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body hr{border:none;border-top:1px solid #e4e4e7;margin:1.75em 0}',
			'.markdown-body img{max-width:100%;height:auto;border-radius:.35rem;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body code:not(pre code){direction:ltr;unicode-bidi:isolate;font-family:"Fira Code",Consolas,monospace;font-size:.88em;padding:.15em .45em;border-radius:.3em;color:#3f3f46;background:#f4f4f5;border:1px solid #d4d4d8}',
			'.markdown-body pre.code-block{direction:ltr;unicode-bidi:isolate;text-align:left;position:relative;margin:.65em 0 1em;padding:0;border-radius:.45rem;overflow:hidden;border:1px solid #334155;background:#1e293b!important;box-shadow:none;line-height:1.6;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body pre.code-block .code-lang{position:absolute;top:0;inset-inline-end:0;z-index:1;padding:.3em .75em;font-family:"Fira Code",Consolas,monospace;font-size:.62em;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;background:rgba(0,0,0,.35);border-end-start-radius:.3rem}',
			'.markdown-body pre.code-block code{direction:ltr;display:block;font-family:"Fira Code",Consolas,monospace;font-size:' + (forPrint ? '8.5pt' : '.875em') + ';line-height:1.6;color:#e2e8f0!important;background:#1e293b!important;padding:1.1em 1.2em;white-space:' + (forPrint ? 'pre-wrap' : 'pre') + ';overflow-x:' + (forPrint ? 'visible' : 'auto') + ';tab-size:2;word-break:break-word}',
			'.markdown-body .mermaid-wrap{direction:ltr;unicode-bidi:isolate;margin:0 0 1em;padding:1em .75em;overflow:hidden;border:1px solid #cbd5e1;border-radius:.45rem;background:#f8fafc;text-align:center;page-break-inside:avoid;break-inside:avoid}',
			'.markdown-body pre.mermaid{margin:0;padding:0;background:transparent;border:none;box-shadow:none;text-align:center;white-space:pre-wrap}',
			'.markdown-body .mermaid-wrap svg{max-width:100%!important;height:auto!important}',
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

	function exportHeadAssets(needsPrism) {
		if (!needsPrism) return '';
		return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/prism-tomorrow.min.css">';
	}

	function exportBodyScripts(needsPrism, needsMermaid) {
		var parts = [];
		if (needsPrism) {
			parts.push('<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"><\/script>');
			parts.push('<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-markup.min.js"><\/script>');
			parts.push('<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-clike.min.js"><\/script>');
			parts.push('<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-markup-templating.min.js"><\/script>');
			parts.push('<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"><\/script>');
			parts.push('<script>Prism.plugins.autoloader.languages_path="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/";' +
				'document.querySelectorAll("pre.code-block code").forEach(function(el){try{Prism.highlightElement(el)}catch(e){}});<\/script>');
		}
		if (needsMermaid) {
			parts.push('<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.0/dist/mermaid.min.js"><\/script>');
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

		loadScriptOnce(
			'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js',
			'htmlToImage'
		).then(function () {
			if (!window.htmlToImage || !window.htmlToImage.toPng) {
				throw new Error('html-to-image unavailable');
			}
			return window.htmlToImage.toPng(node, {
				width: fullWidth,
				height: fullHeight,
				pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
				backgroundColor: bg,
				cacheBust: true
			});
		}).then(function (dataUrl) {
			var name = slugifyFilename(findDoc(docsState.activeId) && findDoc(docsState.activeId).title) + '.png';
			downloadDataUrl(dataUrl, name);
		}).catch(function () {
			window.alert('Image export failed. Check your connection and try again.');
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
		if (!rafPending) {
			rafPending = true;
			requestAnimationFrame(function () {
				rafPending = false;
				renderPreview();
			});
		}
		scheduleSave();
	}

	function bindEditorEvents() {
		$editor = $('#textbox textarea');
		$editor.on('input', onEditorChange);
		$editor.on('compositionend', onEditorChange);
		$editor.on('keyup paste cut', onEditorChange);
	}

	function loadInitialContent() {
		var existing = readDocsRaw();
		if (existing && existing.length) {
			ensureDocsBootstrapped();
			return;
		}

		var legacy = storageGet(STORAGE_KEY, null) || storageGet('content', null);
		if (legacy !== null && legacy !== '') {
			ensureDocsBootstrapped();
			return;
		}

		$.get(INIT_URL)
			.done(function (data) {
				ensureDocsBootstrapped(data);
			})
			.fail(function () {
				ensureDocsBootstrapped('# Markdown Tools\n\nStart writing…');
			});
	}

	function initUI() {
		initTheme();
		initDirection();
		initFontSize();
		initFullview();
		initSidebar();
		bindDocsUi();

		$('#dir-rtl').on('click', function () { applyDirection('rtl'); });
		$('#dir-ltr').on('click', function () { applyDirection('ltr'); });

		$('#theme-toggle').on('change', function () {
			applyTheme(this.checked ? 'karnoweb' : 'karnoweb-dark');
		});

		$('#palette-select').on('change', function () {
			applyTheme(this.value);
		});

		$('#font-size-toggle').on('click', function () {
			var next = document.documentElement.classList.contains('font-large') ? 'normal' : 'large';
			applyFontSize(next);
		});

		$('#fullview-toggle').on('click', function () {
			setFullview(!$('body').hasClass('fullview'));
		});

		$('[data-export]').on('click', function () {
			exportResult($(this).data('export'));
		});

		$(document).on('keydown', function (e) {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
				e.preventDefault();
				persistActiveFromEditor();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !e.shiftKey) {
				e.preventDefault();
				createDoc('# New document\n\n');
				return;
			}
			if (e.key === 'Escape') {
				if ($('body').hasClass('fullview')) {
					setFullview(false);
				} else if (window.matchMedia('(max-width: 900px)').matches &&
					!document.documentElement.classList.contains('sidebar-collapsed')) {
					setSidebarOpen(false);
				}
			}
		});

		if (/[?&]selfcheck=1(?:&|$)/.test(location.search)) {
			runDocsSelfCheck();
		}
	}

	$(document).ready(function () {
		bindEditorEvents();
		initUI();
		loadInitialContent();
	});
}());
