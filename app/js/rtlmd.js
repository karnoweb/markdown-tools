(function () {
	'use strict';

	var INIT_URL = 'initcontent.md';
	var STORAGE_KEY = 'rtlmd-content';
	var THEME_KEY = 'rtlmd-theme';
	var DIR_KEY = 'rtlmd-dir';
	var FONT_KEY = 'rtlmd-font-size';
	var FULLVIEW_KEY = 'rtlmd-fullview';

	var DARK_THEMES = {
		dark: 1, night: 1, dracula: 1, dim: 1, nord: 1, sunset: 1,
		forest: 1, luxury: 1, coffee: 1, business: 1, halloween: 1,
		synthwave: 1, black: 1, cyberpunk: 1
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
			return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
		$('#font-size-label').text(large ? 'عادی' : 'بزرگ');
		$('#font-size-toggle').toggleClass('btn-active', large);
		storageSet(FONT_KEY, size);
	}

	function initFontSize() {
		applyFontSize(storageGet(FONT_KEY, 'normal'));
	}

	function setFullview(on) {
		$('body').toggleClass('fullview', on);
		$('#fullview-label').text(on ? 'بازگشت به ویرایش' : 'نمایش کامل');
		$('#fullview-icon-expand').toggleClass('hidden', on);
		$('#fullview-icon-collapse').toggleClass('hidden', !on);
		storageSet(FULLVIEW_KEY, on ? '1' : '0');
	}

	function initFullview() {
		setFullview(storageGet(FULLVIEW_KEY, '0') === '1');
	}

	var $editor = null;
	var rafPending = false;

	function renderPreview() {
		if (!$editor || !$editor.length) return;
		try {
			$('#output').html(parseMarkdown($editor.val()));
		} catch (err) {
			$('#output').html('<p class="render-error">خطا در رندر markdown</p>');
			return;
		}
		highlightCode();
		renderMermaid();
	}

	function saveContent() {
		if (!$editor || !$editor.length) return;
		storageSet(STORAGE_KEY, $editor.val());
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
		downloadFile(buildExportDocument(false), 'markdown-tools.html', 'text/html');
	}

	function exportMarkdown() {
		downloadFile($editor ? $editor.val() : '', 'markdown-tools.md', 'text/markdown');
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
			window.alert('برای خروجی PDF، اجازه بازشدن پنجره جدید را فعال کنید.');
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

	function exportResult(format) {
		if (format === 'html') exportHtml();
		if (format === 'markdown') exportMarkdown();
		if (format === 'pdf') exportPdf();
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
		var stored = storageGet(STORAGE_KEY, null);
		if (!stored) {
			stored = storageGet('content', null);
		}

		if (stored !== null && stored !== '') {
			$('#textbox textarea').val(stored);
			renderPreview();
			return;
		}

		$.get(INIT_URL)
			.done(function (data) {
				$('#textbox textarea').val(data);
				renderPreview();
			})
			.fail(function () {
				$('#textbox textarea').val('# Markdown Tools\n\nشروع به نوشتن کنید…');
				renderPreview();
			});
	}

	function initUI() {
		initTheme();
		initDirection();
		initFontSize();
		initFullview();

		$('#dir-rtl').on('click', function () { applyDirection('rtl'); });
		$('#dir-ltr').on('click', function () { applyDirection('ltr'); });

		$('#theme-toggle').on('change', function () {
			applyTheme(this.checked ? 'light' : 'dark');
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
			if (e.key === 'Escape' && $('body').hasClass('fullview')) {
				setFullview(false);
			}
		});
	}

	$(document).ready(function () {
		bindEditorEvents();
		initUI();
		loadInitialContent();
	});
}());
