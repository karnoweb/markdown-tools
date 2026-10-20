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
		/* Wrap full RTL comment bodies in a single <bdi class="code-bidi" dir="rtl"> per line
		   (keeping //, #, /* markers on the left in LTR) so mixed Persian+English comments stay in RTL order. */
		var comments = codeEl.querySelectorAll('.token.comment');
		for (var c = 0; c < comments.length; c++) {
			var cEl = comments[c];
			var cText = cEl.textContent || '';
			if (!RTL_CHAR_RE.test(cText) || cEl.children.length > 0) continue;
			var lines = cText.split('\n');
			var cFrag = document.createDocumentFragment();
			for (var l = 0; l < lines.length; l++) {
				if (l > 0) cFrag.appendChild(document.createTextNode('\n'));
				var line = lines[l];
				if (!RTL_CHAR_RE.test(line)) {
					cFrag.appendChild(document.createTextNode(line));
					continue;
				}
				var cm = line.match(/^(\s*(?:\/\/+|#+|\/\*+|\*+|<!--+|--+)\s*)([\s\S]*?)(\s*(?:\*\/|-->)\s*)?$/);
				var prefix = cm ? cm[1] : '';
				var body = cm ? cm[2] : line;
				var suffix = (cm && cm[3]) ? cm[3] : '';
				if (prefix) cFrag.appendChild(document.createTextNode(prefix));
				if (body) {
					var cBdi = document.createElement('bdi');
					cBdi.className = 'code-bidi';
					cBdi.setAttribute('dir', 'rtl');
					cBdi.textContent = flipArrowsInRtlText(body);
					cFrag.appendChild(cBdi);
				}
				if (suffix) cFrag.appendChild(document.createTextNode(suffix));
			}
			cEl.textContent = '';
			cEl.appendChild(cFrag);
		}

		var walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT, null);
		var nodes = [];
		while (walker.nextNode()) nodes.push(walker.currentNode);
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			if (node.parentElement && node.parentElement.closest('bdi.code-bidi')) continue;
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
				bdi.setAttribute('dir', 'rtl');
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

	/* Mermaid edge labels (-->|...|) do not support backslash-escaped pipes (\|);
	   authors write \| out of Markdown-table habit, causing Mermaid 11 parse errors. */
	function normalizeMermaidSource(src) {
		return String(src || '').replace(/\\\|/g, '#124;');
	}

	function isMermaidErrorSvg(svg) {
		if (!svg) return false;
		if (svg.getAttribute('aria-roledescription') === 'error') return true;
		return !!svg.querySelector('.error-icon, .error-text');
	}

	function enhanceMermaidBidi(svg) {
		if (!svg || isMermaidErrorSvg(svg)) return;
		var fos = svg.querySelectorAll('foreignObject');
		for (var i = 0; i < fos.length; i++) {
			var fo = fos[i];
			var text = fo.textContent || '';
			var hasRtl = RTL_CHAR_RE.test(text);
			var dir = hasRtl ? 'rtl' : 'ltr';
			var innerEls = fo.querySelectorAll('div, span, p');
			for (var j = 0; j < innerEls.length; j++) {
				var el = innerEls[j];
				var elHasRtl = RTL_CHAR_RE.test(el.textContent || '');
				var elDir = elHasRtl ? 'rtl' : (hasRtl ? 'rtl' : 'ltr');
				el.setAttribute('dir', elDir);
				el.style.direction = elDir;
				el.style.unicodeBidi = 'isolate';
			}
			var inlineTags = fo.querySelectorAll('strong, b, em, i, code, a');
			for (var k = 0; k < inlineTags.length; k++) {
				inlineTags[k].style.unicodeBidi = 'isolate';
			}
			if (hasRtl) {
				var walker = document.createTreeWalker(fo, NodeFilter.SHOW_TEXT, null);
				var tNodes = [];
				while (walker.nextNode()) tNodes.push(walker.currentNode);
				for (var n = 0; n < tNodes.length; n++) {
					tNodes[n].nodeValue = flipArrowsInRtlText(tNodes[n].nodeValue);
				}
			}
		}

		var svgTexts = svg.querySelectorAll('text');
		for (var t = 0; t < svgTexts.length; t++) {
			var tEl = svgTexts[t];
			if (tEl.closest('foreignObject')) continue;
			if (!RTL_CHAR_RE.test(tEl.textContent || '')) continue;
			tEl.setAttribute('direction', 'rtl');
			tEl.style.direction = 'rtl';
			tEl.style.unicodeBidi = 'isolate';
			var tw = document.createTreeWalker(tEl, NodeFilter.SHOW_TEXT, null);
			var sNodes = [];
			while (tw.nextNode()) sNodes.push(tw.currentNode);
			for (var m = 0; m < sNodes.length; m++) {
				sNodes[m].nodeValue = flipArrowsInRtlText(sNodes[m].nodeValue);
			}
		}
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
				fontFamily: typeof mermaidFontFamily === 'function' ? mermaidFontFamily() : 'Vazirmatn, Tahoma, sans-serif'
			});
			var list = Array.prototype.slice.call(nodes);
			var chain = Promise.resolve();
			list.forEach(function (pre) {
				var raw = pre.getAttribute('data-mermaid-raw') || pre.textContent || '';
				if (!pre.getAttribute('data-mermaid-raw')) {
					pre.setAttribute('data-mermaid-raw', raw);
				}
				var clean = normalizeMermaidSource(raw);
				pre.textContent = clean;
				var wrap = pre.closest('.mermaid-wrap');
				if (wrap && RTL_CHAR_RE.test(clean)) {
					wrap.setAttribute('data-mermaid-rtl', '1');
				}
				chain = chain.then(function () {
					return Promise.resolve(mermaid.run({ nodes: [pre] })).catch(function () {
						/* bad diagram syntax on this node — continue rendering remaining diagrams */
					});
				});
			});
			chain.then(function () {
				enhanceMermaidDiagrams();
				if (scrollSyncOn) refreshScrollMaps();
			});
		} catch (e) { /* ponytail: mermaid unavailable */ }
	}

	function normalizeMermaidSvgDimensions(svg) {
		var vb = svg.getAttribute('viewBox');
		if (!vb) return;
		var parts = vb.trim().split(/[\s,]+/);
		if (parts.length !== 4) return;
		var w = parseFloat(parts[2]);
		var h = parseFloat(parts[3]);
		if (w > 0 && h > 0) {
			svg.setAttribute('width', String(Math.ceil(w)));
			svg.setAttribute('height', String(Math.ceil(h)));
			svg.style.maxWidth = '100%';
			svg.style.height = 'auto';
		}
	}

	function enhanceMermaidDiagrams() {
		document.querySelectorAll('#output .mermaid-wrap').forEach(function (wrap) {
			if (wrap.dataset.mermaidEnhanced === '1') return;
			var svg = wrap.querySelector('svg');
			if (!svg || isMermaidErrorSvg(svg)) return;
			wrap.dataset.mermaidEnhanced = '1';
			enhanceMermaidBidi(svg);
			normalizeMermaidSvgDimensions(svg);

			var toolbar = document.createElement('div');
			toolbar.className = 'mermaid-toolbar';
			toolbar.setAttribute('role', 'toolbar');
			toolbar.setAttribute('aria-label', 'Diagram zoom');
			toolbar.innerHTML =
				'<button type="button" class="mermaid-zoom-btn" data-action="out" title="Zoom out" aria-label="Zoom out">−</button>' +
				'<button type="button" class="mermaid-zoom-btn mermaid-zoom-btn--label" data-action="reset" title="Reset zoom" aria-label="Reset zoom">100%</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-action="in" title="Zoom in" aria-label="Zoom in">+</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-action="fit" title="Fit width" aria-label="Fit width">Fit</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-action="full" title="Lightbox view (click or double-click diagram)" aria-label="Open lightbox">⛶</button>';

			var viewport = document.createElement('div');
			viewport.className = 'mermaid-viewport';
			var stage = document.createElement('div');
			stage.className = 'mermaid-stage';

			var pre = wrap.querySelector('pre.mermaid') || svg;
			wrap.insertBefore(toolbar, pre);
			wrap.insertBefore(viewport, pre);
			stage.appendChild(pre);
			viewport.appendChild(stage);

			var scale = 1;
			var minScale = 0.2;
			var maxScale = 6;
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

			function openDiagramLightbox() {
				var cloneSvg = svg.cloneNode(true);
				var vb = cloneSvg.getAttribute('viewBox');
				if (vb) {
					var p = vb.trim().split(/[\s,]+/);
					if (p.length === 4 && parseFloat(p[2]) > 0 && parseFloat(p[3]) > 0) {
						cloneSvg.setAttribute('width', String(Math.ceil(parseFloat(p[2]))));
						cloneSvg.setAttribute('height', String(Math.ceil(parseFloat(p[3]))));
					}
				}
				cloneSvg.style.maxWidth = 'none';
				cloneSvg.style.width = '';
				cloneSvg.style.height = '';
				openMediaLightbox(cloneSvg, 'Diagram');
			}

			toolbar.addEventListener('click', function (e) {
				var btn = e.target.closest('[data-action]');
				if (!btn) return;
				e.stopPropagation();
				var action = btn.getAttribute('data-action');
				if (action === 'in') applyScale(scale * 1.2, 'top center');
				if (action === 'out') applyScale(scale / 1.2, 'top center');
				if (action === 'reset') applyScale(1, 'top center');
				if (action === 'fit') fitWidth();
				if (action === 'full') openDiagramLightbox();
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

			viewport.addEventListener('click', function (e) {
				if (e.target.closest('.mermaid-toolbar, a, button')) return;
				openDiagramLightbox();
			});
			viewport.addEventListener('dblclick', function (e) {
				if (e.target.closest('.mermaid-toolbar')) return;
				e.stopPropagation();
				openDiagramLightbox();
			});
			viewport.setAttribute('title', 'Click to zoom in lightbox');
			viewport.style.cursor = 'zoom-in';

			if (window.matchMedia('(max-width: 768px)').matches) {
				requestAnimationFrame(fitWidth);
			}
		});
	}

	function enhancePreviewImages() {
		document.querySelectorAll('#output img').forEach(function (img) {
			if (img.dataset.lightboxReady === '1') return;
			img.dataset.lightboxReady = '1';
			img.classList.add('preview-zoomable-img');
			if (!img.getAttribute('title')) {
				img.setAttribute('title', 'Click to zoom in lightbox');
			}
			img.addEventListener('click', function (e) {
				if (e.target.closest('a')) return;
				e.preventDefault();
				e.stopPropagation();
				var clone = document.createElement('img');
				clone.src = img.currentSrc || img.src;
				clone.alt = img.alt || '';
				clone.draggable = false;
				openMediaLightbox(clone, img.alt || 'Image');
			});
		});
	}

	function pinchDistance(touches) {
		var dx = touches[0].clientX - touches[1].clientX;
		var dy = touches[0].clientY - touches[1].clientY;
		return Math.hypot(dx, dy);
	}

	function openMediaLightbox(mediaEl, captionText) {
		var existing = document.querySelector('.media-lightbox');
		if (existing) existing.remove();

		var overlay = document.createElement('div');
		overlay.className = 'media-lightbox mermaid-fullscreen';
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', captionText || 'Preview');

		var bar = document.createElement('div');
		bar.className = 'media-lightbox-bar';
		bar.innerHTML =
			'<span class="media-lightbox-title">' + escapeHtml(captionText || '') + '</span>' +
			'<div class="media-lightbox-controls" role="toolbar" aria-label="Zoom controls">' +
				'<button type="button" class="mermaid-zoom-btn" data-lb="out" title="Zoom out (−)" aria-label="Zoom out">−</button>' +
				'<button type="button" class="mermaid-zoom-btn mermaid-zoom-btn--label" data-lb="reset" title="Reset 100% (0)" aria-label="Reset zoom">100%</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-lb="in" title="Zoom in (+)" aria-label="Zoom in">+</button>' +
				'<button type="button" class="mermaid-zoom-btn" data-lb="fit" title="Fit to screen" aria-label="Fit to screen">Fit</button>' +
				'<button type="button" class="mermaid-zoom-btn media-lightbox-close" data-lb="close" title="Close (Esc)" aria-label="Close">✕</button>' +
			'</div>';

		var canvas = document.createElement('div');
		canvas.className = 'media-lightbox-canvas';

		var stage = document.createElement('div');
		stage.className = 'media-lightbox-stage';
		stage.appendChild(mediaEl);
		canvas.appendChild(stage);

		overlay.appendChild(bar);
		overlay.appendChild(canvas);
		document.body.appendChild(overlay);
		document.body.classList.add('mermaid-fullscreen-open');

		var scale = 1;
		var tx = 0;
		var ty = 0;
		var minScale = 0.15;
		var maxScale = 8;
		var dragging = false;
		var dragStartX = 0;
		var dragStartY = 0;
		var startTx = 0;
		var startTy = 0;
		var pinchStart = 0;

		function renderTransform() {
			stage.style.transform = 'translate3d(' + Math.round(tx) + 'px,' + Math.round(ty) + 'px,0) scale(' + scale + ')';
			var lbl = bar.querySelector('[data-lb="reset"]');
			if (lbl) lbl.textContent = Math.round(scale * 100) + '%';
		}

		function zoomAt(nextScale, clientX, clientY) {
			nextScale = Math.min(maxScale, Math.max(minScale, nextScale));
			if (typeof clientX === 'number' && typeof clientY === 'number') {
				var rect = canvas.getBoundingClientRect();
				var cx = clientX - (rect.left + rect.width / 2);
				var cy = clientY - (rect.top + rect.height / 2);
				var ratio = nextScale / scale;
				tx = cx - (cx - tx) * ratio;
				ty = cy - (cy - ty) * ratio;
			}
			scale = nextScale;
			renderTransform();
		}

		function resetView() {
			scale = 1;
			tx = 0;
			ty = 0;
			renderTransform();
		}

		function fitToScreen() {
			scale = 1;
			tx = 0;
			ty = 0;
			stage.style.transform = 'scale(1)';
			var cRect = canvas.getBoundingClientRect();
			var mRect = mediaEl.getBoundingClientRect();
			var mw = mRect.width || 1;
			var mh = mRect.height || 1;
			var availW = Math.max(cRect.width - 48, 100);
			var availH = Math.max(cRect.height - 48, 100);
			scale = Math.min(maxScale, Math.max(minScale, Math.min(availW / mw, availH / mh, 2.2)));
			tx = 0;
			ty = 0;
			renderTransform();
		}

		bar.addEventListener('click', function (e) {
			var btn = e.target.closest('[data-lb]');
			if (!btn) return;
			var act = btn.getAttribute('data-lb');
			if (act === 'in') zoomAt(scale * 1.25);
			else if (act === 'out') zoomAt(scale / 1.25);
			else if (act === 'reset') resetView();
			else if (act === 'fit') fitToScreen();
			else if (act === 'close') close();
		});

		canvas.addEventListener('wheel', function (e) {
			e.preventDefault();
			var factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
			zoomAt(scale * factor, e.clientX, e.clientY);
		}, { passive: false });

		canvas.addEventListener('mousedown', function (e) {
			if (e.button !== 0) return;
			dragging = true;
			dragStartX = e.clientX;
			dragStartY = e.clientY;
			startTx = tx;
			startTy = ty;
			canvas.classList.add('is-dragging');
		});

		function onMouseMove(e) {
			if (!dragging) return;
			tx = startTx + (e.clientX - dragStartX);
			ty = startTy + (e.clientY - dragStartY);
			renderTransform();
		}

		function onMouseUp() {
			if (!dragging) return;
			dragging = false;
			canvas.classList.remove('is-dragging');
		}

		canvas.addEventListener('dblclick', function (e) {
			e.preventDefault();
			if (Math.abs(scale - 1) > 0.15) fitToScreen();
			else zoomAt(2, e.clientX, e.clientY);
		});

		canvas.addEventListener('touchstart', function (e) {
			if (e.touches.length === 2) {
				pinchStart = pinchDistance(e.touches);
			} else if (e.touches.length === 1) {
				dragging = true;
				dragStartX = e.touches[0].clientX;
				dragStartY = e.touches[0].clientY;
				startTx = tx;
				startTy = ty;
			}
		}, { passive: true });

		canvas.addEventListener('touchmove', function (e) {
			if (e.touches.length === 2 && pinchStart) {
				e.preventDefault();
				var dist = pinchDistance(e.touches);
				zoomAt(scale * (dist / pinchStart));
				pinchStart = dist;
			} else if (e.touches.length === 1 && dragging) {
				e.preventDefault();
				tx = startTx + (e.touches[0].clientX - dragStartX);
				ty = startTy + (e.touches[0].clientY - dragStartY);
				renderTransform();
			}
		}, { passive: false });

		canvas.addEventListener('touchend', function () {
			dragging = false;
			pinchStart = 0;
		});

		canvas.addEventListener('click', function (e) {
			if (e.target === canvas && Math.hypot(tx - startTx, ty - startTy) < 4) {
				close();
			}
		});

		function onKey(e) {
			if (e.key === 'Escape') close();
			else if (e.key === '+' || e.key === '=') zoomAt(scale * 1.25);
			else if (e.key === '-') zoomAt(scale / 1.25);
			else if (e.key === '0') resetView();
		}

		function close() {
			overlay.remove();
			document.body.classList.remove('mermaid-fullscreen-open');
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		}

		document.addEventListener('keydown', onKey);
		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);

		requestAnimationFrame(function () {
			if (mediaEl.tagName === 'IMG' && !mediaEl.complete) {
				mediaEl.addEventListener('load', fitToScreen, { once: true });
			} else {
				fitToScreen();
			}
		});
	}
