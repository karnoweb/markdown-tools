/* ── 60-export-word.js ──
   Real .docx export (lazy OOXML bundle) with styled .doc fallback. */
	var WORD_BUNDLE_SRC = 'assets/vendor/docx/word-docx.bundle.js';
	var WORD_DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
	var wordBundlePromise = null;

	/* Real .docx export is lazy-loaded so the ~400 KB OOXML engine never slows
	   down startup; the bundle is same-origin + SW-precached, so offline works. */
	function ensureWordBundle() {
		if (window.RtlmWordDocx && typeof window.RtlmWordDocx.buildDocxBlob === 'function') {
			return Promise.resolve();
		}
		if (wordBundlePromise) return wordBundlePromise;
		wordBundlePromise = new Promise(function (resolve, reject) {
			var s = document.createElement('script');
			s.src = WORD_BUNDLE_SRC;
			s.onload = function () {
				if (window.RtlmWordDocx && typeof window.RtlmWordDocx.buildDocxBlob === 'function') resolve();
				else reject(new Error('word bundle has no api'));
			};
			s.onerror = function () { reject(new Error('word bundle failed to load')); };
			document.head.appendChild(s);
		});
		return wordBundlePromise;
	}

	function downloadBlob(blob, filename, type) {
		var out = blob instanceof Blob ? blob : new Blob([blob], { type: type });
		var url = URL.createObjectURL(out);
		var a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		a.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
	}

	function legacyWordDoc(doc) {
		var styledHtml = null;
		if (api && typeof api.buildWordDocument === 'function') {
			try { styledHtml = api.buildWordDocument(doc.title); } catch (e) { styledHtml = null; }
		}
		if (!styledHtml) {
			var raw = document.getElementById('output').innerHTML;
			styledHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body dir="' +
				api.getContentDir() + '">' + raw + '</body></html>';
		}
		api.downloadFile('﻿' + styledHtml, api.slugifyFilename(doc.title) + '.doc', 'application/msword');
	}

	window.rtlmdExportDocx = function () {
		if (!api) return;
		var doc = api.findDoc(api.docsState.activeId);
		if (!doc) return;
		var btn = document.querySelector('[data-export="docx"]');
		if (btn) btn.disabled = true;
		function done() { if (btn) btn.disabled = false; }
		ensureWordBundle().then(function () {
			return window.RtlmWordDocx.buildDocxBlob({
				title: doc.title,
				dir: api.getContentDir(),
				html: document.getElementById('output').innerHTML
			});
		}).then(function (blob) {
			downloadBlob(blob, api.slugifyFilename(doc.title) + '.docx', WORD_DOCX_MIME);
			done();
		}).catch(function () {
			/* offline-safe fallback: styled Word-HTML (.doc) */
			try {
				legacyWordDoc(doc);
			} catch (e) {
				window.alert(t('wordExportFailed'));
			}
			done();
		});
	};
