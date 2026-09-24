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
