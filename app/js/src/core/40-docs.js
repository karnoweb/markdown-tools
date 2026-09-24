/* ── 40-docs.js ──
   Document history store, File System Access handles, open/save to disk, list UI, bootstrap. */
	var docsState = { items: [], activeId: null };

	function normalizeSourcePath(sourcePath) {
		if (!sourcePath) return '';
		return String(sourcePath).replace(/\\/g, '/').toLowerCase();
	}

	function findDocBySourcePath(sourcePath) {
		var wanted = normalizeSourcePath(sourcePath);
		if (!wanted) return null;
		for (var i = 0; i < docsState.items.length; i++) {
			var doc = docsState.items[i];
			if (doc.sourcePath && normalizeSourcePath(doc.sourcePath) === wanted) {
				return doc;
			}
		}
		return null;
	}

	function isBlankStarterDoc(doc) {
		if (!doc || doc.sourcePath || fileHandlesByDocId[doc.id]) return false;
		var content = String(doc.content || '').trim();
		if (!content) return true;
		if (content === '# Markdown Tools\n\nStart writing…') return true;
		return doc.title === UNTITLED && content.length < 48;
	}

	/* Persist File System Access handles in IndexedDB (survives reload — unlike localStorage,
	   which cannot JSON-serialize a FileSystemFileHandle) so "Save" reuses the *same* file
	   instead of falling back to a Save-As picker that may land in the wrong folder. */
	var HANDLE_DB_NAME = 'rtlmd-handles';
	var HANDLE_DB_STORE = 'handles';
	var handleDbPromise = null;

	function openHandleDb() {
		if (!('indexedDB' in window)) return Promise.resolve(null);
		if (handleDbPromise) return handleDbPromise;
		handleDbPromise = new Promise(function (resolve) {
			try {
				var req = indexedDB.open(HANDLE_DB_NAME, 1);
				req.onupgradeneeded = function () {
					if (!req.result.objectStoreNames.contains(HANDLE_DB_STORE)) {
						req.result.createObjectStore(HANDLE_DB_STORE);
					}
				};
				req.onsuccess = function () { resolve(req.result); };
				req.onerror = function () { resolve(null); };
			} catch (e) {
				resolve(null);
			}
		});
		return handleDbPromise;
	}

	function storeFileHandleRecord(docId, handle) {
		return openHandleDb().then(function (db) {
			if (!db) return;
			try {
				var tx = db.transaction(HANDLE_DB_STORE, 'readwrite');
				tx.objectStore(HANDLE_DB_STORE).put(handle, docId);
			} catch (e) { /* ponytail: handle not structured-clonable in this browser */ }
		});
	}

	function loadFileHandleRecord(docId) {
		return openHandleDb().then(function (db) {
			if (!db) return null;
			return new Promise(function (resolve) {
				try {
					var tx = db.transaction(HANDLE_DB_STORE, 'readonly');
					var req = tx.objectStore(HANDLE_DB_STORE).get(docId);
					req.onsuccess = function () { resolve(req.result || null); };
					req.onerror = function () { resolve(null); };
				} catch (e) {
					resolve(null);
				}
			});
		});
	}

	function deleteFileHandleRecord(docId) {
		return openHandleDb().then(function (db) {
			if (!db) return;
			try {
				var tx = db.transaction(HANDLE_DB_STORE, 'readwrite');
				tx.objectStore(HANDLE_DB_STORE).delete(docId);
			} catch (e) { /* ignore */ }
		});
	}

	function attachFileHandle(doc, handle) {
		if (!doc || !handle) return;
		fileHandlesByDocId[doc.id] = handle;
		storeFileHandleRecord(doc.id, handle);
	}

	function getFileHandle(doc) {
		if (!doc) return null;
		return fileHandlesByDocId[doc.id] || null;
	}

	/* showOpenFilePicker/showSaveFilePicker (and, in practice, requestPermission too) throw
	   "Must be handling a user gesture" unless called near-synchronously inside the
	   click/keydown handler. Any IndexedDB round-trip in between breaks that, so handle
	   restoration must happen *ahead of time* (in the background, on doc load) — never
	   inside saveActiveDocToDisk() itself. queryPermission (unlike requestPermission) never
	   needs a gesture, so it's safe to call here. */
	function prefetchFileHandle(doc) {
		if (!doc || !doc.sourcePath || fileHandlesByDocId[doc.id]) return;
		loadFileHandleRecord(doc.id).then(function (handle) {
			if (!handle || fileHandlesByDocId[doc.id]) return;
			if (typeof handle.queryPermission !== 'function') {
				fileHandlesByDocId[doc.id] = handle;
				return;
			}
			return handle.queryPermission({ mode: 'readwrite' }).then(function (state) {
				if (state === 'granted') fileHandlesByDocId[doc.id] = handle;
				/* else: leave unset — Save falls back to a fresh Save-As picker,
				   still triggered directly from the click/keydown gesture. */
			});
		}).catch(function () { /* ignore — fall back to Save-As at save time */ });
	}

	function canWriteDocToDisk(doc) {
		if (!doc) return false;
		if (getFileHandle(doc)) return true;
		if (!doc.sourcePath) return false;
		if (window.rtlmdDesktop && typeof window.rtlmdDesktop.saveFile === 'function') return true;
		if (supportsSaveFilePicker()) return true;
		return false;
	}

	function supportsOpenFilePicker() {
		return typeof window.showOpenFilePicker === 'function';
	}

	function supportsSaveFilePicker() {
		return typeof window.showSaveFilePicker === 'function';
	}

	function openExternalMarkdownFile(payload) {
		if (!payload || typeof payload.content !== 'string') return;

		var existing = findDocBySourcePath(payload.path);
		if (existing) {
			persistActiveFromEditor({ silentList: true });
			if (existing.pinned) {
				loadDocIntoEditor(existing);
				if (payload.handle) attachFileHandle(existing, payload.handle);
				return;
			}
			existing.content = payload.content;
			markDocSavedToDisk(existing, payload.content);
			existing.updatedAt = Date.now();
			if (payload.handle) attachFileHandle(existing, payload.handle);
			writeDocs(docsState.items);
			loadDocIntoEditor(existing);
			return;
		}

		persistActiveFromEditor({ silentList: true });

		if (docsState.items.length === 1 && isBlankStarterDoc(docsState.items[0])) {
			var starter = docsState.items[0];
			if (starter.pinned) {
				createDoc(payload.content, payload.name || titleFromContent(payload.content), {
					sourcePath: payload.path,
					titleLocked: true,
					fileHandle: payload.handle
				});
				return;
			}
			starter.content = payload.content;
			starter.title = payload.name || titleFromContent(payload.content) || UNTITLED;
			starter.titleLocked = true;
			starter.sourcePath = payload.path;
			markDocSavedToDisk(starter, payload.content);
			starter.updatedAt = Date.now();
			if (payload.handle) attachFileHandle(starter, payload.handle);
			writeDocs(docsState.items);
			loadDocIntoEditor(starter);
			return;
		}

		createDoc(payload.content, payload.name || titleFromContent(payload.content), {
			sourcePath: payload.path,
			titleLocked: true,
			fileHandle: payload.handle
		});
	}

	function readBrowserFileAsPayload(file, handle) {
		return file.text().then(function (content) {
			var base = String(file.name || 'document').replace(/\.(md|markdown|mdown|mkd|mkdn)$/i, '');
			return {
				path: handle && handle.name ? handle.name : (file.name || base),
				name: base,
				content: content,
				handle: handle || null
			};
		});
	}

	function openMarkdownFromDisk() {
		if (window.rtlmdDesktop && typeof window.rtlmdDesktop.openFileDialog === 'function') {
			return window.rtlmdDesktop.openFileDialog().then(function (payloads) {
				if (!payloads || !payloads.length) return;
				payloads.forEach(function (payload) {
					openExternalMarkdownFile(payload);
				});
			}).catch(function (err) {
				window.alert('Could not open file:\n' + (err && err.message ? err.message : String(err)));
			});
		}

		if (supportsOpenFilePicker()) {
			return window.showOpenFilePicker({
				multiple: true,
				types: MD_OPEN_TYPES,
				excludeAcceptAllOption: false
			}).then(function (handles) {
				return Promise.all(handles.map(function (handle) {
					return handle.getFile().then(function (file) {
						return readBrowserFileAsPayload(file, handle);
					});
				}));
			}).then(function (payloads) {
				payloads.forEach(function (payload) {
					openExternalMarkdownFile(payload);
				});
			}).catch(function (err) {
				if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return;
				window.alert('Could not open file:\n' + (err && err.message ? err.message : String(err)));
			});
		}

		var input = document.getElementById('doc-file-input');
		if (input) {
			input.value = '';
			input.click();
		}
		return Promise.resolve();
	}

	function onDocFileInputChange(e) {
		var input = e.target;
		var files = input && input.files ? Array.prototype.slice.call(input.files, 0) : [];
		if (!files.length) return;
		Promise.all(files.map(function (file) {
			return readBrowserFileAsPayload(file, null);
		})).then(function (payloads) {
			payloads.forEach(function (payload) {
				/* Legacy file input cannot write back — open as editable history docs. */
				openExternalMarkdownFile({
					path: null,
					name: payload.name,
					content: payload.content,
					handle: null
				});
			});
		}).catch(function (err) {
			window.alert('Could not open file:\n' + (err && err.message ? err.message : String(err)));
		}).then(function () {
			input.value = '';
		});
	}

	function writeViaFileHandle(handle, content) {
		return handle.createWritable().then(function (writable) {
			return writable.write(content).then(function () {
				return writable.close();
			});
		});
	}

	function pickSaveHandleForDoc(doc) {
		if (!supportsSaveFilePicker()) return Promise.resolve(null);
		var suggested = doc.sourcePath || (slugifyFilename(doc.title || UNTITLED) + '.md');
		if (!/\.(md|markdown|mdown|mkd|mkdn)$/i.test(suggested)) {
			suggested += '.md';
		}
		return window.showSaveFilePicker({
			suggestedName: suggested.replace(/^.*[\\/]/, ''),
			types: MD_OPEN_TYPES
		}).then(function (handle) {
			attachFileHandle(doc, handle);
			doc.sourcePath = handle.name || suggested;
			doc.titleLocked = true;
			return handle;
		}).catch(function (err) {
			if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return null;
			throw err;
		});
	}

	function flushPendingExternalFiles() {
		while (pendingExternalFiles.length) {
			openExternalMarkdownFile(pendingExternalFiles.shift());
		}
	}

	function initDesktopBridge() {
		if (!window.rtlmdDesktop || typeof window.rtlmdDesktop.onOpenFile !== 'function') return;
		window.rtlmdDesktop.onOpenFile(function (payload) {
			pendingExternalFiles.push(payload);
			if (docsState.items.length) {
				flushPendingExternalFiles();
			}
		});
	}

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
		var serialized;
		try {
			serialized = JSON.stringify(items);
		} catch (e) {
			window.alert('Could not save history (document data could not be serialized).');
			return false;
		}
		/* P0 fix: storageSet() used to swallow quota/private-mode errors internally, and
		   this function never actually checked for failure — it just returned true
		   unconditionally, so a full-storage save looked "successful" while nothing was
		   actually persisted. The in-memory edit is still safe in docsState.items above,
		   but the caller must know a reload/close will lose it. */
		var saved = storageSet(DOCS_KEY, serialized);
		if (!saved) {
			var msg = typeof window.rtlmdT === 'function'
				? window.rtlmdT('storageFullWarning')
				: 'Browser storage is full — this change was NOT saved. Delete old documents/large pasted images, or export a backup, then try again.';
			window.alert(msg);
			return false;
		}
		return true;
	}

	function sortDocs(items) {
		/* ponytail: pinned first, then stable creation order */
		return items.slice().sort(function (a, b) {
			var pin = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
			if (pin) return pin;
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

	function isActiveDocDiskDirty() {
		var doc = findDoc(docsState.activeId);
		if (!doc || !canWriteDocToDisk(doc)) return false;
		var content = $editor && $editor.length ? $editor.val() : doc.content;
		return content !== doc.lastSavedToDisk;
	}

	function isDocDiskDirty(doc) {
		if (!doc || !canWriteDocToDisk(doc)) return false;
		return doc.content !== doc.lastSavedToDisk;
	}

	function markDocSavedToDisk(doc, content) {
		if (!doc) return;
		doc.lastSavedToDisk = content;
	}

	function refreshActiveTitleUi(flash) {
		var doc = findDoc(docsState.activeId);
		var el = document.getElementById('active-doc-title');
		if (!el || !doc) return;
		var title = doc.title || UNTITLED;
		var dirty = isActiveDocDiskDirty();
		el.textContent = dirty ? title + ' ●' : title;
		el.title = doc.sourcePath || title;
		el.classList.toggle('is-dirty', dirty);
		if (flash === 'saved') {
			el.classList.add('is-saved-flash');
			clearTimeout(refreshActiveTitleUi._flashTimer);
			refreshActiveTitleUi._flashTimer = setTimeout(function () {
				el.classList.remove('is-saved-flash');
			}, 1400);
		}
	}

	function updateActiveTitleUi(/* title */) {
		refreshActiveTitleUi();
	}

	function saveActiveDocToDisk() {
		var doc = findDoc(docsState.activeId);
		if (!doc) return Promise.resolve(false);
		if (doc.pinned) {
			return Promise.resolve(false);
		}

		var content = $editor && $editor.length ? $editor.val() : doc.content;

		function finishSave() {
			doc.content = content;
			markDocSavedToDisk(doc, content);
			doc.updatedAt = Date.now();
			writeDocs(docsState.items);
			storageSet(STORAGE_KEY, content);
			refreshActiveTitleUi('saved');
			renderDocList();
			if (typeof window.rtlmdOnDiskSaved === 'function') {
				window.rtlmdOnDiskSaved(doc);
			}
			return true;
		}

		/* Browser: reuse the real file handle if it's already in memory (restored ahead of
		   time by prefetchFileHandle() when the doc loaded — NOT here, since any async
		   detour, e.g. an IndexedDB round-trip, right before showSaveFilePicker() makes
		   Chrome reject it with "Must be handling a user gesture to show a file picker"). */
		var handle = getFileHandle(doc);
		if (handle) {
			return writeViaFileHandle(handle, content).then(finishSave).catch(function (err) {
				window.alert('Could not save file:\n' + (err && err.message ? err.message : String(err)));
				return false;
			});
		}

		if (doc.sourcePath && window.rtlmdDesktop && typeof window.rtlmdDesktop.saveFile === 'function') {
			/* Desktop app: writes by absolute path directly, no handle needed. */
			return window.rtlmdDesktop.saveFile(doc.sourcePath, content).then(finishSave).catch(function (err) {
				window.alert('Could not save file:\n' + (err && err.message ? err.message : String(err)));
				return false;
			});
		}

		if (!supportsSaveFilePicker()) return Promise.resolve(false);

		/* No usable handle recovered — falls back to Save-As (may create a new file if the
		   original's permission wasn't remembered by the browser). Called directly, still
		   inside the same click/keydown gesture. */
		return pickSaveHandleForDoc(doc).then(function (picked) {
			if (!picked) return false;
			return writeViaFileHandle(picked, content).then(finishSave);
		}).catch(function (err) {
			window.alert('Could not save file:\n' + (err && err.message ? err.message : String(err)));
			return false;
		});
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
			if (doc.pinned) $li.addClass('is-pinned');
			$li.attr('data-id', doc.id);

			var $open = $('<button type="button" class="doc-open"></button>');
			var listTitle = doc.title || UNTITLED;
			if (isDocDiskDirty(doc)) listTitle += ' ●';
			$open.append($('<span class="doc-title"></span>').text(listTitle));
			$open.append($('<span class="doc-meta"></span>').text(formatDocTime(doc.createdAt || doc.updatedAt)));
			$open.attr('title', doc.sourcePath || doc.title || UNTITLED);

			var lockSvg = doc.pinned
				? '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>'
				: '<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/></svg>';

			var $pin = $('<button type="button" class="doc-pin icon-btn-xs"></button>')
				.toggleClass('is-pinned', !!doc.pinned)
				.attr('title', doc.pinned ? 'Unlock (allow edits)' : 'Lock (pin & freeze edits)')
				.attr('aria-label', doc.pinned ? 'Unlock document' : 'Lock document')
				.attr('aria-pressed', doc.pinned ? 'true' : 'false')
				.html(lockSvg);

			var $del = $('<button type="button" class="doc-delete icon-btn-xs" title="Delete">×</button>');
			if (doc.pinned) {
				$del.prop('disabled', true).addClass('is-locked').attr('title', 'Unlock before deleting');
			}

			var $actions = $('<div class="doc-actions"></div>');
			$actions.append(
				$pin,
				$('<button type="button" class="doc-duplicate icon-btn-xs" title="Duplicate">⧉</button>'),
				$('<button type="button" class="doc-rename icon-btn-xs" title="Rename">✎</button>'),
				$del
			);

			$li.append($open, $actions);
			$list.append($li);
		});
	}

	function shouldAutoTitle(doc, opts) {
		opts = opts || {};
		return !opts.keepTitle && !doc.titleLocked;
	}

	function setEditorLocked(locked) {
		if (!$editor || !$editor.length) return;
		$editor.prop('readonly', !!locked);
		$('#textbox').toggleClass('is-locked', !!locked);
		$('.md-toolbar .md-tool').prop('disabled', !!locked);
		$('#doc-save').prop('disabled', !!locked);
	}

	function syncActiveEditorLock() {
		var doc = findDoc(docsState.activeId);
		setEditorLocked(!!(doc && doc.pinned));
	}

	function persistActiveFromEditor(opts) {
		opts = opts || {};
		if (!$editor || !$editor.length || !docsState.activeId) return;
		var doc = findDoc(docsState.activeId);
		if (!doc) return;
		if (doc.pinned) {
			/* Locked: keep stored content; snap editor back if it drifted. */
			if ($editor.val() !== doc.content) {
				$editor.val(doc.content || '');
				if (!opts.silentList) renderPreview();
			}
			updateActiveTitleUi(doc.title);
			if (!opts.silentList) renderDocList();
			return;
		}
		var content = $editor.val();
		doc.content = content;
		doc.updatedAt = Date.now();
		if (shouldAutoTitle(doc, opts)) {
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
		syncActiveEditorLock();
		updateActiveTitleUi(doc.title || UNTITLED);
		storageSet(STORAGE_KEY, doc.content || '');
		if (!opts.skipRender) renderPreview();
		renderDocList();
		/* Background restore only — never inside the Save click/keydown handler itself. */
		prefetchFileHandle(doc);
	}

	function createDoc(content, title, opts) {
		opts = opts || {};
		persistActiveFromEditor({ silentList: true });
		var items = docsState.items.slice();
		if (items.length >= MAX_DOCS) {
			items = sortDocs(items);
			var victims = items.filter(function (d) {
				return d.id !== docsState.activeId && !d.pinned;
			});
			while (items.length >= MAX_DOCS && victims.length) {
				var drop = victims.pop();
				items = items.filter(function (d) { return d.id !== drop.id; });
				delete fileHandlesByDocId[drop.id];
				deleteFileHandleRecord(drop.id);
			}
			if (items.length >= MAX_DOCS) {
				window.alert('Document limit (' + MAX_DOCS + ') reached. Unlock or delete one first.');
				return null;
			}
		}
		var now = Date.now();
		var doc = {
			id: uid(),
			title: title || titleFromContent(content || '') || UNTITLED,
			content: content || '',
			pinned: false,
			snapshots: [],
			updatedAt: now,
			createdAt: now
		};
		if (opts.sourcePath) doc.sourcePath = opts.sourcePath;
		if (opts.titleLocked) doc.titleLocked = true;
		if (opts.sourcePath || opts.fileHandle) markDocSavedToDisk(doc, doc.content);
		if (opts.fileHandle) attachFileHandle(doc, opts.fileHandle);
		items.unshift(doc);
		writeDocs(items);
		loadDocIntoEditor(doc);
		return doc;
	}

	function openDoc(id) {
		if (!id || id === docsState.activeId) return;
		if (!confirmLeaveIfDiskDirty()) return;
		var doc = findDoc(id);
		if (!doc) return;
		persistActiveFromEditor({ silentList: true });
		loadDocIntoEditor(doc);
		if (isMobile()) {
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
		doc.titleLocked = true;
		writeDocs(docsState.items);
		if (doc.id === docsState.activeId) updateActiveTitleUi(doc.title);
		renderDocList();
	}

	function togglePinDoc(id) {
		var doc = findDoc(id);
		if (!doc) return;
		if (doc.id === docsState.activeId && !doc.pinned) {
			persistActiveFromEditor({ silentList: true });
		}
		doc.pinned = !doc.pinned;
		writeDocs(docsState.items);
		renderDocList();
		if (doc.id === docsState.activeId) {
			if (doc.pinned && $editor && $editor.length) {
				$editor.val(doc.content || '');
				renderPreview();
			}
			syncActiveEditorLock();
			refreshActiveTitleUi();
		}
	}

	function deleteDoc(id) {
		if (docsState.items.length <= 1) {
			window.alert('At least one document must remain.');
			return;
		}
		var doc = findDoc(id);
		if (!doc) return;
		if (doc.pinned) {
			window.alert('Unlock "' + (doc.title || UNTITLED) + '" before deleting it.');
			return;
		}
		if (!window.confirm('Delete "' + (doc.title || UNTITLED) + '"?')) return;
		var wasActive = doc.id === docsState.activeId;
		var items = docsState.items.filter(function (d) { return d.id !== id; });
		delete fileHandlesByDocId[id];
		deleteFileHandleRecord(id);
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
			pinned: false,
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
					pinned: !!d.pinned,
					sourcePath: d.sourcePath || null,
					titleLocked: !!d.titleLocked,
					lastSavedToDisk: typeof d.lastSavedToDisk === 'string' ? d.lastSavedToDisk : null,
					snapshots: Array.isArray(d.snapshots) ? d.snapshots : [],
					updatedAt: d.updatedAt || Date.now(),
					createdAt: d.createdAt || d.updatedAt || Date.now()
				};
			});
			docsState.items.forEach(function (doc) {
				if (doc.sourcePath && doc.lastSavedToDisk === null) {
					markDocSavedToDisk(doc, doc.content);
				}
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
			pinned: false,
			updatedAt: Date.now(),
			createdAt: Date.now()
		};
		writeDocs([doc]);
		loadDocIntoEditor(doc);
	}

	function bindDocsUi() {
		$('#doc-new').on('click', function () {
			if (!confirmLeaveIfDiskDirty()) return;
			createDoc('# New document\n\n');
		});

		$('#doc-open').on('click', function () {
			if (!confirmLeaveIfDiskDirty()) return;
			openMarkdownFromDisk();
		});

		$('#doc-save').on('click', function () {
			persistActiveFromEditor();
			saveActiveDocToDisk();
		});

		$('#doc-file-input').on('change', onDocFileInputChange);

		$('#doc-list').on('click', '.doc-open', function () {
			openDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-duplicate', function (e) {
			e.stopPropagation();
			if (typeof window.rtlmdDuplicateDoc === 'function') {
				window.rtlmdDuplicateDoc($(this).closest('.doc-item').data('id'));
			}
		});

		$('#doc-list').on('click', '.doc-rename', function (e) {
			e.stopPropagation();
			renameDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-pin', function (e) {
			e.stopPropagation();
			togglePinDoc($(this).closest('.doc-item').data('id'));
		});

		$('#doc-list').on('click', '.doc-delete', function (e) {
			e.stopPropagation();
			deleteDoc($(this).closest('.doc-item').data('id'));
		});

		$('#sidebar-toggle').on('click', function () {
			if (isFullview()) {
				setFullview(false);
				setSidebarOpen(true);
				return;
			}
			setSidebarOpen(document.documentElement.classList.contains('sidebar-collapsed'));
		});

		$('#sidebar-backdrop').on('click', function () {
			setSidebarOpen(false);
		});

		$(window).on('beforeunload', function (e) {
			persistActiveFromEditor({ silentList: true, keepTitle: false });
			if (isActiveDocDiskDirty()) {
				e.preventDefault();
				e.returnValue = '';
			}
		});
	}
