/* ── 60-editor-preview.js ──
   Editor binding base, renderPreview() pipeline, code copy buttons, clipboard. */
	var $editor = null;
	var rafPending = false;

	function renderPreview() {
		if (!$editor || !$editor.length) return;
		try {
			$('#output').html(parseMarkdown($editor.val()));
		} catch (err) {
			$('#output').html('<p class="render-error">Markdown render error</p>');
			scrollMapReady = false;
			return;
		}
		highlightCode();
		attachCodeCopyButtons();
		renderMermaid();
		refreshScrollMaps();
		if (typeof window.rtlmdAfterPreview === 'function') {
			window.rtlmdAfterPreview();
		}
	}

	function attachCodeCopyButtons() {
		$('#output pre.code-block').each(function () {
			var pre = this;
			if (pre.querySelector('.code-copy')) return;
			var btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'code-copy';
			btn.textContent = 'Copy';
			btn.setAttribute('aria-label', 'Copy code');
			btn.addEventListener('click', function () {
				var code = pre.querySelector('code');
				var text = code ? code.textContent : '';
				copyText(text).then(function () {
					btn.textContent = 'Copied';
					btn.classList.add('is-copied');
					setTimeout(function () {
						btn.textContent = 'Copy';
						btn.classList.remove('is-copied');
					}, 1200);
				}).catch(function () {
					btn.textContent = 'Failed';
					setTimeout(function () { btn.textContent = 'Copy'; }, 1200);
				});
			});
			pre.insertBefore(btn, pre.firstChild);
		});
	}

	function copyText(text) {
		if (navigator.clipboard && navigator.clipboard.writeText) {
			return navigator.clipboard.writeText(text);
		}
		return new Promise(function (resolve, reject) {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.position = 'fixed';
			ta.style.left = '-9999px';
			document.body.appendChild(ta);
			ta.select();
			try {
				if (!document.execCommand('copy')) throw new Error('copy failed');
				resolve();
			} catch (e) {
				reject(e);
			} finally {
				ta.remove();
			}
		});
	}
