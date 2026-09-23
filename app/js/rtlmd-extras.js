(function () {
	'use strict';

	var api = null;
	var LANG_KEY = 'rtlmd-lang';
	var SPELL_KEY = 'rtlmd-spellcheck';
	var AUTOSAVE_KEY = 'rtlmd-autosave-disk';
	var TOC_KEY = 'rtlmd-toc';
	var LINE_NUM_KEY = 'rtlmd-line-numbers';
	var MAX_SNAPSHOTS = 15;
	var mathPlaceholders = [];

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
			exportDocx: 'Word', frontMatter: 'Metadata'
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
			exportDocx: 'Word', frontMatter: 'متادیتا'
		}
	};

	function storageGet(key, fallback) {
		try {
			var v = localStorage.getItem(key);
			return v !== null ? v : fallback;
		} catch (e) {
			return fallback;
		}
	}

	function storageSet(key, val) {
		try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
	}

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

	function preprocessMarkdown(src) {
		mathPlaceholders = [];
		var parts = splitFrontMatter(src);
		var body = parts.body;

		body = body.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
			var i = mathPlaceholders.length;
			mathPlaceholders.push({ display: true, tex: tex.trim() });
			return '\n\n<p><!--RTLMD_MATH_' + i + '--></p>\n\n';
		});

		body = body.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, function (m, pre, tex) {
			var i = mathPlaceholders.length;
			mathPlaceholders.push({ display: false, tex: tex.trim() });
			return pre + '<!--RTLMD_MATH_' + i + '-->';
		});

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
		html = html.replace(/<!--RTLMD_MATH_(\d+)-->/g, function (_, idx) {
			var item = mathPlaceholders[Number(idx)];
			if (!item) return '';
			var rendered = renderKatex(item.tex, item.display);
			return item.display
				? '<div class="math-block" dir="ltr">' + rendered + '</div>'
				: '<span class="math-inline" dir="ltr">' + rendered + '</span>';
		});
		return html;
	}

	window.rtlmdPreprocessMarkdown = preprocessMarkdown;
	window.rtlmdPostprocessMarkdownHtml = postprocessMarkdownHtml;

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
		var full = document.body.classList.contains('fullview');
		var hasList = !!nav.querySelector('.toc-list');
		var show = full && tocEnabledInSettings() && hasList;
		nav.classList.toggle('hidden', !show);
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

	window.rtlmdExportDocx = function () {
		if (!api) return;
		var doc = api.findDoc(api.docsState.activeId);
		if (!doc) return;
		var html = document.getElementById('output').innerHTML;
		var wrap = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body dir="' +
			api.getContentDir() + '">' + html + '</body></html>';
		var blob = new Blob(['\ufeff', wrap], { type: 'application/msword' });
		var url = URL.createObjectURL(blob);
		var a = document.createElement('a');
		a.href = url;
		a.download = api.slugifyFilename(doc.title) + '.doc';
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 0);
	};

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

	function hookRenderPreview() {
		window.rtlmdAfterPreview = function () {
			renderFrontMatterBanner();
			if (storageGet(TOC_KEY, '1') !== '0') buildTocFromHtml();
			updateWordCount();
			syncLineNumbers();
		};
	}

	function bindUi() {
		document.getElementById('btn-settings').addEventListener('click', openSettings);
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
