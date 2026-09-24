/* ── 30-content-widgets.js ──
   i18n apply, word count, TOC build/toggle, front-matter banner. */
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
		var toggleBtn = document.getElementById('toc-toggle');
		var full = document.body.classList.contains('fullview');
		var hasList = !!nav.querySelector('.toc-list');
		var show = full && tocEnabledInSettings() && hasList;
		nav.classList.toggle('hidden', !show);
		if (toggleBtn) {
			var canToggle = full && hasList;
			toggleBtn.classList.toggle('hidden', !canToggle);
			toggleBtn.classList.toggle('is-active', show);
			toggleBtn.setAttribute('aria-pressed', show ? 'true' : 'false');
		}
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

	function closeToc() {
		storageSet(TOC_KEY, '0');
		syncTocVisibility();
	}

	function toggleToc() {
		storageSet(TOC_KEY, tocEnabledInSettings() ? '0' : '1');
		syncTocVisibility();
	}

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
