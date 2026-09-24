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
