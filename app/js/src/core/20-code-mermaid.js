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
