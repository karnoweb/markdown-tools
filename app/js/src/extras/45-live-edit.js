/* ── 45-live-edit.js ──
   Optional "Live" view mode: the rendered preview is edited in place.
   The Markdown textarea stays the single source of truth. Every top-level preview
   block is mapped to its source range [data-src-start, data-src-end); only blocks the
   user actually types in are converted back (HTML → Markdown via Turndown) and spliced
   into that range, so untouched parts of the document are never rewritten.
   Blocks that cannot round-trip safely (code, tables, math, mermaid, images, raw HTML)
   are edited as source through a small textarea (double-click). */
	var VIEW_MODE_KEY = 'rtlmd-view-mode';
	var LIVE_TURNDOWN_SRC = 'assets/vendor/turndown/turndown.min.js';
	var LIVE_PLACEHOLDER = '&nbsp;';
	var LIVE_EDITABLE_TAGS = { P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, BLOCKQUOTE: 1 };
	var LIVE_INLINE_OK = {
		P: 1, H1: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1,
		STRONG: 1, B: 1, EM: 1, I: 1, DEL: 1, S: 1, A: 1, CODE: 1, BR: 1, INPUT: 1
	};

	var liveTurndown = null;
	var liveTurndownPromise = null;
	var liveFocusStart = null;
	var liveInputTimer = null;
	var liveBound = false;

	Object.assign(STR.en, {
		clearDoc: 'Clear', clearHint: 'Clear the whole document (a snapshot is saved first)',
		clearConfirm: 'Clear the entire document? A snapshot will be saved so you can restore it.',
		viewMode: 'View mode', viewModeSplit: 'Split (editor + preview)',
		viewModeLive: 'Live (edit the preview directly)',
		liveUnmapped: 'Live editing unavailable for this document (unsupported structure). Switch to Split mode.',
		livePasteHint: 'Paste Markdown here (Ctrl+V) or click to start typing',
		liveSrcHint: 'Double-click to edit source'
	});
	Object.assign(STR.fa, {
		clearDoc: 'پاک‌کردن', clearHint: 'پاک‌کردن کل سند (قبلش یک نسخه ذخیره می‌شود)',
		clearConfirm: 'کل سند پاک شود؟ قبلش یک نسخه ذخیره می‌شود تا بتوانید بازیابی کنید.',
		viewMode: 'حالت نمایش', viewModeSplit: 'دوتایی (ویرایشگر + پیش‌نمایش)',
		viewModeLive: 'زنده (ویرایش مستقیم پیش‌نمایش)',
		liveUnmapped: 'ویرایش زنده برای این سند ممکن نیست (ساختار پشتیبانی‌نشده). به حالت دوتایی بروید.',
		livePasteHint: 'Markdown را اینجا پیست کنید (Ctrl+V) یا شروع به نوشتن کنید',
		liveSrcHint: 'برای ویرایش سورس دوبار کلیک کنید'
	});

	function liveActive() {
		return document.body.classList.contains('live-mode');
	}

	function liveLocked() {
		var doc = findDoc(docsState.activeId);
		return !!(doc && doc.pinned);
	}

	function liveOut() {
		return document.getElementById('output');
	}

	/* ── Turndown (lazy, classic script — same pattern as ensureWordBundle) ── */
	function liveBuildTurndown() {
		var td = new window.TurndownService({
			headingStyle: 'atx',
			hr: '---',
			bulletListMarker: '-',
			codeBlockStyle: 'fenced',
			emDelimiter: '*',
			strongDelimiter: '**',
			linkStyle: 'inlined'
		});
		td.addRule('liveStrike', {
			filter: ['del', 's'],
			replacement: function (content) { return '~~' + content + '~~'; }
		});
		td.addRule('liveTaskBox', {
			filter: function (node) { return node.nodeName === 'INPUT' && node.type === 'checkbox'; },
			replacement: function (content, node) { return (node.checked ? '[x]' : '[ ]') + ' '; }
		});
		/* Turndown's default is "-   item" (3 spaces); the app's docs use "- item". */
		td.addRule('liveListItem', {
			filter: 'li',
			replacement: function (content, node, options) {
				var prefix = options.bulletListMarker + ' ';
				var parent = node.parentNode;
				if (parent && parent.nodeName === 'OL') {
					var start = parent.getAttribute('start');
					var index = Array.prototype.indexOf.call(parent.children, node);
					prefix = (start ? Number(start) + index : index + 1) + '. ';
				}
				var pad = new Array(prefix.length + 1).join(' ');
				content = content.replace(/^\n+/, '').replace(/\n+$/, '\n').replace(/\n/gm, '\n' + pad);
				return prefix + content + (node.nextSibling && !/\n$/.test(content) ? '\n' : '');
			}
		});
		return td;
	}

	function liveEnsureTurndown() {
		if (liveTurndown) return Promise.resolve();
		if (window.TurndownService) {
			liveTurndown = liveBuildTurndown();
			return Promise.resolve();
		}
		if (liveTurndownPromise) return liveTurndownPromise;
		liveTurndownPromise = new Promise(function (resolve, reject) {
			var s = document.createElement('script');
			s.src = LIVE_TURNDOWN_SRC;
			s.onload = function () {
				if (!window.TurndownService) {
					liveTurndownPromise = null;
					reject(new Error('turndown has no api'));
					return;
				}
				liveTurndown = liveBuildTurndown();
				resolve();
			};
			s.onerror = function () {
				liveTurndownPromise = null;
				reject(new Error('turndown failed to load'));
			};
			document.head.appendChild(s);
		});
		return liveTurndownPromise;
	}

	/* HTML → Markdown for one preview block. Wrapped in a div because Turndown
	   ignores the root element's own tag and only converts its children. */
	function liveToMarkdown(el) {
		var wrap = document.createElement('div');
		var clone = el.cloneNode(true);
		clone.removeAttribute('contenteditable');
		wrap.appendChild(clone);
		return liveTurndown.turndown(wrap).replace(/\u00a0/g, ' ').trim();
	}

	/* ── Source mapping ── */
	/* Top-level marked tokens → absolute [start, end) offsets in the editor text.
	   Returns null if the lexer's raw text can't be found verbatim in the source
	   (tabs / whitespace-only lines are rewritten by marked) — then live editing is
	   refused rather than risking a write to the wrong range. */
	function liveBlockRanges(src) {
		var parts = splitFrontMatter(src);
		var body = parts.body;
		var base = src.length - body.length;
		var tokens = marked.lexer(body);
		var ranges = [];
		var pos = 0;
		for (var i = 0; i < tokens.length; i++) {
			var tok = tokens[i];
			if (tok.type === 'space') continue;
			var raw = tok.raw || '';
			var idx = body.indexOf(raw, pos);
			if (idx < 0) return null;
			var end = idx + raw.length;
			pos = end;
			while (end > idx && body.charAt(end - 1) === '\n') end--;
			ranges.push({ start: base + idx, end: base + end, type: tok.type });
		}
		return ranges;
	}

	function liveIsEditable(el) {
		if (!LIVE_EDITABLE_TAGS[el.tagName]) return false;
		var all = el.querySelectorAll('*');
		for (var i = 0; i < all.length; i++) {
			var node = all[i];
			if (!LIVE_INLINE_OK[node.tagName]) return false;
			if (node.tagName === 'INPUT' && node.type !== 'checkbox') return false;
		}
		return true;
	}

	function liveSetHint(text) {
		var el = document.getElementById('live-hint');
		if (!el) return;
		el.textContent = text || '';
		el.classList.toggle('hidden', !text);
	}

	function liveAfterPreview() {
		var out = liveOut();
		if (!out) return;
		if (!liveActive()) {
			liveSetHint('');
			out.removeAttribute('data-empty-hint');
			return;
		}
		var src = $editor.val();
		out.setAttribute('data-empty-hint', src.trim() ? '' : t('livePasteHint'));
		var ranges = liveBlockRanges(src);
		var kids = out.children;
		if (!ranges || ranges.length !== kids.length) {
			liveSetHint(t('liveUnmapped'));
			return;
		}
		liveSetHint('');
		var locked = liveLocked();
		var canEdit = !!liveTurndown && !locked;
		for (var i = 0; i < kids.length; i++) {
			var kid = kids[i];
			kid.setAttribute('data-src-start', String(ranges[i].start));
			kid.setAttribute('data-src-end', String(ranges[i].end));
			kid.setAttribute('data-src-type', ranges[i].type);
			if (!canEdit) continue;
			if (liveIsEditable(kid)) {
				kid.setAttribute('contenteditable', 'true');
				kid.setAttribute('spellcheck', 'false');
			} else {
				kid.classList.add('live-src');
				kid.setAttribute('title', t('liveSrcHint'));
			}
		}
		if (liveFocusStart !== null) {
			var want = String(liveFocusStart);
			liveFocusStart = null;
			for (var j = 0; j < kids.length; j++) {
				if (kids[j].getAttribute('data-src-start') !== want) continue;
				var target = kids[j];
				if (target.getAttribute('contenteditable') !== 'true') break;
				if (src.slice(ranges[j].start, ranges[j].end) === LIVE_PLACEHOLDER) {
					target.innerHTML = '';
					target.setAttribute('data-live-ph', '');
					/* dirty on purpose: if left empty, focusout removes the placeholder block */
					target.__liveDirty = true;
				}
				target.focus();
				var sel = window.getSelection();
				var range = document.createRange();
				range.selectNodeContents(target);
				range.collapse(true);
				sel.removeAllRanges();
				sel.addRange(range);
				if (target.scrollIntoView) target.scrollIntoView({ block: 'nearest' });
				break;
			}
		}
	}

	/* ── Source writes ── */
	function liveAfterWrite() {
		scheduleSave();
		refreshActiveTitleUi();
		updateWordCount();
	}

	function liveReplaceRange(start, end, text) {
		var v = $editor.val();
		$editor.val(v.slice(0, start) + text + v.slice(end));
		liveAfterWrite();
	}

	/* Cut [start,end) plus one adjoining blank-line separator. */
	function liveRemoveRange(start, end) {
		var v = $editor.val();
		if (v.slice(start - 2, start) === '\n\n') start -= 2;
		else if (v.slice(end, end + 2) === '\n\n') end += 2;
		liveReplaceRange(start, end, '');
	}

	function liveBlockFor(node) {
		var out = liveOut();
		var el = node && node.nodeType === 1 ? node : (node && node.parentElement);
		while (el && el.parentElement !== out) el = el.parentElement;
		return el && el.hasAttribute('data-src-start') ? el : null;
	}

	function liveRange(block) {
		return {
			start: parseInt(block.getAttribute('data-src-start'), 10),
			end: parseInt(block.getAttribute('data-src-end'), 10)
		};
	}

	/* Write one edited block back into the source. Returns the markdown written
	   ('' if the block is empty — the caller decides whether to delete it). */
	function liveWriteBlock(block) {
		if (!block || !block.isConnected || !block.__liveDirty || !liveTurndown) return null;
		var md = liveToMarkdown(block);
		if (!md) return '';
		var r = liveRange(block);
		var cur = $editor.val().slice(r.start, r.end);
		if (md !== cur) {
			var delta = md.length - (r.end - r.start);
			liveReplaceRange(r.start, r.end, md);
			block.setAttribute('data-src-end', String(r.start + md.length));
			for (var s = block.nextElementSibling; s; s = s.nextElementSibling) {
				if (!s.hasAttribute('data-src-start')) continue;
				s.setAttribute('data-src-start', String(parseInt(s.getAttribute('data-src-start'), 10) + delta));
				s.setAttribute('data-src-end', String(parseInt(s.getAttribute('data-src-end'), 10) + delta));
			}
		}
		block.removeAttribute('data-live-ph');
		if (/^H[1-6]$/.test(block.tagName) && typeof buildTocFromHtml === 'function') buildTocFromHtml();
		return md;
	}

	function liveFinalizeBlock(block) {
		if (!block || !block.isConnected || !block.__liveDirty) return;
		var md = liveWriteBlock(block);
		block.__liveDirty = false;
		if (md === null) return;
		if (md === '') {
			var r = liveRange(block);
			liveRemoveRange(r.start, r.end);
			renderPreview();
			return;
		}
		/* Re-render only if the edit changed the block's structure (e.g. a paragraph
		   that now lexes as 2 blocks); otherwise the DOM is already correct and a
		   re-render would swallow the click that moved focus away. */
		var toks = marked.lexer(md).filter(function (tok) { return tok.type !== 'space'; });
		if (toks.length !== 1 || toks[0].type !== block.getAttribute('data-src-type')) {
			renderPreview();
		}
	}

	/* ── Enter splits a paragraph/heading into two source blocks ── */
	/* Works on clones only: the live DOM is untouched until the source is rewritten
	   and the preview re-rendered, so an early return can never leave a half-edited block. */
	function liveSplitBlock(block) {
		var sel = window.getSelection();
		if (!sel.rangeCount) return;
		var caret = sel.getRangeAt(0);
		if (!block.contains(caret.startContainer) || !block.contains(caret.endContainer)) return;
		var headR = document.createRange();
		headR.selectNodeContents(block);
		headR.setEnd(caret.startContainer, caret.startOffset);
		var tailR = document.createRange();
		tailR.selectNodeContents(block);
		tailR.setStart(caret.endContainer, caret.endOffset);
		var head = block.cloneNode(false);
		head.appendChild(headR.cloneContents());
		var tail = document.createElement('p');
		tail.appendChild(tailR.cloneContents());
		var beforeMd = liveToMarkdown(head);
		var afterMd = liveToMarkdown(tail);
		var r = liveRange(block);
		var text;
		var focusAt;
		if (!beforeMd && !afterMd) return;
		if (!beforeMd) {
			/* caret at the very start: add an empty paragraph above, keep the block */
			var whole = liveToMarkdown(block);
			text = LIVE_PLACEHOLDER + '\n\n' + whole;
			focusAt = r.start + LIVE_PLACEHOLDER.length + 2;
		} else {
			text = beforeMd + '\n\n' + (afterMd || LIVE_PLACEHOLDER);
			focusAt = r.start + beforeMd.length + 2;
		}
		liveReplaceRange(r.start, r.end, text);
		block.__liveDirty = false;
		liveFocusStart = focusAt;
		renderPreview();
	}
	/* ── Multi-line paste = Markdown: becomes new source blocks ── */
	function liveSetSource(text) {
		$editor.val(text);
		liveAfterWrite();
		renderPreview();
	}

	function liveCleanPaste(text) {
		return String(text || '').replace(/\r\n?/g, '\n').replace(/\s+$/, '');
	}

	function liveAppendMarkdown(text) {
		text = liveCleanPaste(text);
		if (!text) return;
		var src = $editor.val();
		var base = src.trim() ? src.replace(/\s+$/, '') + '\n\n' : '';
		liveSetSource(base + text + '\n');
	}

	function liveInsertAfter(block, text) {
		text = liveCleanPaste(text);
		if (!text) return;
		liveWriteBlock(block);
		block.__liveDirty = false;
		var r = liveRange(block);
		var v = $editor.val();
		var emptyPh = block.hasAttribute('data-live-ph') && !block.textContent.trim();
		if (emptyPh) liveSetSource(v.slice(0, r.start) + text + v.slice(r.end));
		else liveSetSource(v.slice(0, r.end) + '\n\n' + text + v.slice(r.end));
	}

	/* ── Source editing for blocks that cannot round-trip ── */
	function liveEditSource(block) {
		if (block.__liveEditing) return;
		block.__liveEditing = true;
		var r = liveRange(block);
		var original = $editor.val().slice(r.start, r.end);
		var ta = document.createElement('textarea');
		ta.className = 'live-src-edit';
		ta.setAttribute('dir', 'ltr');
		ta.setAttribute('spellcheck', 'false');
		ta.value = original;
		var done = false;

		function fit() {
			ta.style.height = 'auto';
			ta.style.height = (ta.scrollHeight + 2) + 'px';
		}

		function close(commit) {
			if (done) return;
			done = true;
			block.__liveEditing = false;
			var next = ta.value.replace(/\s+$/, '');
			ta.remove();
			block.style.display = '';
			if (!commit || next === original) return;
			if (!next.trim()) liveRemoveRange(r.start, r.end);
			else liveReplaceRange(r.start, r.end, next);
			renderPreview();
		}

		ta.addEventListener('input', fit);
		ta.addEventListener('blur', function () { close(true); });
		ta.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') {
				e.preventDefault();
				close(false);
			} else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				close(true);
			}
		});
		block.style.display = 'none';
		block.parentNode.insertBefore(ta, block);
		fit();
		ta.focus();
	}

	/* ── Events (delegated on #output once; the node itself is never replaced) ── */
	function liveBindEvents() {
		if (liveBound) return;
		var out = liveOut();
		if (!out) return;
		liveBound = true;

		out.addEventListener('input', function (e) {
			if (!liveActive() || e.isComposing) return;
			var block = liveBlockFor(e.target);
			if (!block || block.getAttribute('contenteditable') !== 'true') return;
			block.__liveDirty = true;
			clearTimeout(liveInputTimer);
			liveInputTimer = setTimeout(function () { liveWriteBlock(block); }, 250);
		});

		out.addEventListener('compositionend', function (e) {
			var block = liveActive() && liveBlockFor(e.target);
			if (!block || block.getAttribute('contenteditable') !== 'true') return;
			block.__liveDirty = true;
			clearTimeout(liveInputTimer);
			liveInputTimer = setTimeout(function () { liveWriteBlock(block); }, 250);
		});

		out.addEventListener('focusout', function (e) {
			if (!liveActive()) return;
			var block = liveBlockFor(e.target);
			if (!block || block.getAttribute('contenteditable') !== 'true') return;
			clearTimeout(liveInputTimer);
			liveFinalizeBlock(block);
		});

		out.addEventListener('keydown', function (e) {
			if (!liveActive()) return;
			var block = liveBlockFor(e.target);
			if (!block || block.getAttribute('contenteditable') !== 'true') return;
			if (e.key === 'Escape') {
				block.blur();
				return;
			}
			if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && !e.isComposing &&
				/^(P|H[1-6])$/.test(block.tagName)) {
				e.preventDefault();
				liveSplitBlock(block);
			}
		});

		out.addEventListener('paste', function (e) {
			if (!liveActive()) return;
			var block = liveBlockFor(e.target);
			if (!block || block.getAttribute('contenteditable') !== 'true') return;
			var text = e.clipboardData && e.clipboardData.getData('text/plain');
			if (!text) return;
			e.preventDefault();
			if (/\n/.test(text.replace(/\n+$/, ''))) liveInsertAfter(block, text);
			else document.execCommand('insertText', false, text);
		});

		out.addEventListener('dblclick', function (e) {
			if (!liveActive() || liveLocked()) return;
			var block = liveBlockFor(e.target);
			if (block && block.classList.contains('live-src')) {
				e.preventDefault();
				liveEditSource(block);
			}
		});

		/* Paste with nothing focused (the "paste a whole .md" case) → append as blocks. */
		document.addEventListener('paste', function (e) {
			if (!liveActive() || liveLocked()) return;
			var tgt = e.target;
			if (tgt && tgt.closest && tgt.closest('input,textarea,select,dialog,[contenteditable="true"]')) return;
			var text = e.clipboardData && e.clipboardData.getData('text/plain');
			if (!text) return;
			e.preventDefault();
			liveAppendMarkdown(text);
		});

		/* Click on the empty-state hint: create the first paragraph. */
		out.addEventListener('click', function (e) {
			if (!liveActive() || liveLocked() || e.target !== out || $editor.val().trim()) return;
			$editor.val(LIVE_PLACEHOLDER + '\n');
			liveFocusStart = 0;
			renderPreview();
		});
	}

	function clearActiveDocument() {
		var doc = findDoc(docsState.activeId);
		if (!doc || doc.pinned) {
			window.alert(t('snapshotLocked'));
			return;
		}
		if (!$editor.val().trim()) return;
		if (!window.confirm(t('clearConfirm'))) return;
		if (api) api.persistActiveFromEditor({ silentList: true });
		pushSnapshot(doc, 'clear');
		$editor.val('');
		liveAfterWrite();
		renderPreview();
	}

	function normalizeViewMode(mode) {
		return mode === 'live' ? 'live' : 'split';
	}

	function applyViewMode(mode, skipRender) {
		mode = normalizeViewMode(mode);
		storageSet(VIEW_MODE_KEY, mode);
		document.body.classList.toggle('live-mode', mode === 'live');
		var sel = document.getElementById('set-viewmode');
		if (sel) sel.value = mode;
		if (mode === 'live') {
			liveBindEvents();
			liveEnsureTurndown().then(liveAfterPreview, function () {});
		}
		if (!skipRender && api && api.renderPreview) api.renderPreview();
	}
