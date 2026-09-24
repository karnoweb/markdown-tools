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
