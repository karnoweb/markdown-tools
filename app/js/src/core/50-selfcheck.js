/* ── 50-selfcheck.js ──
   ?selfcheck=1 regression guards (titles, escape, sanitize, word export…). */
	function runDocsSelfCheck() {
		var fails = [];
		function ok(cond, msg) {
			if (!cond) fails.push(msg);
		}
		ok(titleFromContent('# Hello world\n\nx') === 'Hello world', 'heading title');
		ok(titleFromContent('   ') === UNTITLED, 'empty title');
		ok(titleFromContent('First line\nsecond') === 'First line', 'first line title');
		ok(!shouldAutoTitle({ titleLocked: true }, {}), 'locked title skips auto');
		ok(shouldAutoTitle({}, {}), 'unlocked title still auto');
		ok(!!uid() && uid() !== uid(), 'uid uniqueness');
		ok(slugifyFilename('a/b:c').indexOf('/') === -1, 'slugify');
		ok(sortDocs([
			{ id: 'a', createdAt: 1 },
			{ id: 'b', createdAt: 3 },
			{ id: 'c', createdAt: 2 }
		]).map(function (d) { return d.id; }).join('') === 'bca', 'sort by createdAt');
		ok(sortDocs([
			{ id: 'a', createdAt: 3, pinned: false },
			{ id: 'b', createdAt: 1, pinned: true },
			{ id: 'c', createdAt: 2, pinned: false }
		]).map(function (d) { return d.id; }).join('') === 'bac', 'pinned first');
		ok(wrapSelection('hi', '**', '**') === '**hi**', 'wrap selection');
		ok(prefixLines('a\nb', '- ') === '- a\n- b', 'prefix lines');
		ok(escapeHtml('<?php $t->id()') === '&lt;?php $t-&gt;id()', 'escape php fence');
		ok(parseMarkdown('```php\n<?php\n$table->id();\n```').indexOf('&lt;?php') !== -1, 'php fence stays text');
		ok(parseMarkdown('```php\n<?php\n$table->id();\n```').indexOf('language-php"><code') === -1, 'php fence no nest leak');
		(function () {
			var html = parseMarkdown("x `'y'` z");
			ok(html.indexOf('&amp;#39;') === -1 && html.indexOf('&amp;amp;') === -1, 'codespan no double-escape');
			var probe = document.createElement('div');
			probe.innerHTML = html;
			var codeEl = probe.querySelector('code.codespan');
			ok(!!codeEl && codeEl.textContent === "'y'", 'codespan keeps quotes');
		})();
		(function () {
			/* Regression guard: a literal `$$...$$`/`$...$` shown as *code* (explaining
			   KaTeX/shell syntax, prices in a code sample, etc.) must stay literal text —
			   not be treated as real math — and must never corrupt/truncate the rest of
			   the document (reported real-world case: pasting a message that contained
			   `` `$$E=mc^2$$` `` inside a sentence blanked out everything after it). */
			var html = parseMarkdown(
				'before (`$$E=mc^2$$`, `$a+b$`) after\n\n' +
				'```\ncode with $$still not math$$ and $1 too\n```\n\n' +
				'tail paragraph stays visible'
			);
			ok(html.indexOf('katex') === -1, 'code-fenced/code-span $ is not treated as math');
			ok(html.indexOf('rtlmd-math-ph') === -1, 'no leftover math placeholder markers');
			ok(html.indexOf('tail paragraph stays visible') !== -1, 'content after inline code with $ is not swallowed');
		})();
		(function () {
			/* P0 security regression guard: untrusted raw HTML in a document (e.g. a
			   downloaded/shared .md file) must never reach the live DOM unsanitized. */
			var html = parseMarkdown(
				'<script>window.__rtlmdXssProbe = 1;<\/script>\n\n' +
				'![x](javascript:alert(1))\n\n' +
				'<img src="x" onerror="window.__rtlmdXssProbe = 1">'
			);
			ok(html.indexOf('<script') === -1, 'sanitize strips <script> tags');
			ok(html.indexOf('onerror') === -1, 'sanitize strips inline event-handler attributes');
			ok(html.indexOf('javascript:') === -1, 'sanitize strips javascript: URIs');
		})();
		(function () {
			var el = document.createElement('code');
			el.textContent = "'این سند خرید' and $x";
			enhanceCodeBidi(el);
			var bdi = el.querySelector('bdi.code-bidi');
			ok(!!bdi && bdi.textContent === 'این سند خرید', 'code bidi wraps Persian run');
			ok(el.textContent.indexOf('$x') !== -1, 'code bidi keeps Latin token');
		})();
		ok(storageGet(SCROLL_SYNC_KEY, '0') === '0' || storageGet(SCROLL_SYNC_KEY, '0') === '1', 'scroll sync pref');
		ok(typeof setScrollSync === 'function' && scrollSyncOn === (storageGet(SCROLL_SYNC_KEY, '0') === '1'), 'scroll sync default wiring');
		var ranges = sourceBlockRanges('# Title\n\nHello\n');
		ok(ranges.length === 2 && ranges[0].start === 1 && ranges[1].start === 3, 'scroll sync block ranges');
		(function () {
			/* Word export guard: the .doc payload must be self-contained and styled. */
			var w = buildWordDocument('Selfcheck');
			ok(w.indexOf('<style>') !== -1 && w.indexOf('.markdown-body h1') !== -1, 'word export embeds stylesheet');
			ok(w.indexOf('WordSection1') !== -1, 'word export has Word section/page setup');
			ok(w.indexOf('<script') === -1, 'word export strips scripts');
			ok(w.indexOf('code-copy') === -1 && w.indexOf('code-lang') === -1, 'word export strips preview-only code chrome');
		})();
		if (fails.length) {
			console.error('[rtlmd selfcheck] FAIL', fails);
			window.alert('Self-check failed: ' + fails.join(', '));
		} else {
			console.info('[rtlmd selfcheck] OK');
		}
	}
