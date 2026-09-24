/* ── 20-math-markdown.js ──
   Front-matter split, KaTeX math placeholders, pre/postprocess hooks. */
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

	/* Markers use a plain div/span with a data attribute (not an HTML comment) because
	   the render pipeline now runs everything through DOMPurify before this postprocess
	   step — and sanitizers strip HTML comments outright (a long-standing IE/mXSS attack
	   vector), which would silently swallow every math placeholder. */
	function mathPlaceholderTag(display) {
		return display ? 'div' : 'span';
	}

	/* Pre-existing bug (not introduced by the DOMPurify change, just surfaced by it):
	   the $/$$ math scanner below runs on the *raw* markdown text, before `marked` has
	   any concept of code spans/fences. So a literal `$$E=mc^2$$` written inside
	   backticks — to *show* KaTeX syntax as code, exactly like explaining this feature —
	   got treated as real math. That splices an HTML placeholder tag into the middle of
	   a backtick span, which corrupts the span for marked's inline lexer and can swallow
	   most of the remaining document into one broken <code> run (the "half the content
	   disappeared" symptom). Fenced code blocks and inline code spans must never be
	   scanned for math, so they're protected (swapped for opaque tokens) first and
	   restored verbatim afterward. */
	function protectCodeRegions(text, regex, store) {
		return text.replace(regex, function (match) {
			var i = store.length;
			store.push(match);
			return '\u0000CODE' + i + '\u0000';
		});
	}

	function restoreCodeRegions(text, store) {
		if (!store.length) return text;
		return text.replace(/\u0000CODE(\d+)\u0000/g, function (_, idx) {
			var raw = store[Number(idx)];
			return raw === undefined ? '' : raw;
		});
	}

	var FENCE_RE = /(^|\n)[ \t]{0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n[ \t]{0,3}\2[ \t]*(?=\n|$)/g;
	var INLINE_CODE_RE = /(`+)[\s\S]*?\1/g;

	/* Word-boundary test for `**bold**` finishing (below): any letter/number
	   in any script, plus underscore. Intraword runs like 2**3**4 stay literal. */
	function isStrongWordChar(ch) {
		return !!ch && /[\p{L}\p{N}_]/u.test(ch);
	}

	/* Matches one `**...**` span on the code-PROTECTED source, where inline code
	   and fences are opaque  tokens (they contain no asterisks, so spans
	   never open or close inside code). Content may hold code tokens, single
	   newlines and any non-`*` chars — but no blank line and no nested `*`. */
	var STRONG_SPAN_RE = /\*\*((?:[^*\n]|\n(?!\n)|[^\0]*\0)+?)\*\*/g;

	function strongSpanHasMultilineCode(inner, codeStore) {
		var m;
		var re = /CODE(\d+)/g;
		while ((m = re.exec(inner))) {
			var raw = codeStore[Number(m[1])];
			if (raw !== undefined && raw.indexOf('\n') !== -1) return true;
		}
		return false;
	}

	/* Convert the `**bold**` spans that marked's own tokenizer leaves literal
	   (e.g. a closer preceded by `)` and followed by `،`) into real <strong>,
	   eagerly, so preview and Word agree. The inner markdown is parsed with the
	   real marked pipeline and flows through the normal DOMPurify pass with
	   everything else — no second sanitizer needed.
	   Rejected (left for marked, i.e. today's behavior): native `***a***`,
	   `**a *b* c**`, spans nested inside a rejected outer (the scan re-tries
	   from just past the rejected opener, so inner pairs still convert),
	   intraword 2**3**4, escaped \**, spans across blank lines, and spans
	   swallowing multiline code. */
	function convertLiteralStrong(body, codeStore) {
		if (typeof marked === 'undefined' || typeof marked.parseInline !== 'function') return body;
		if (body.indexOf('**') === -1) return body;
		var out = '';
		var pos = 0;
		var m;
		STRONG_SPAN_RE.lastIndex = 0;
		while ((m = STRONG_SPAN_RE.exec(body))) {
			if (m.index < pos) continue;
			var inner = m[1];
			var before = m.index > 0 ? body.charAt(m.index - 1) : '';
			var afterIdx = m.index + m[0].length;
			var after = afterIdx < body.length ? body.charAt(afterIdx) : '';
			var ok = before !== '*' && after !== '*' && before !== '\\' &&
				!isStrongWordChar(before) && !isStrongWordChar(after) &&
				!strongSpanHasMultilineCode(inner, codeStore);
			if (!ok) {
				STRONG_SPAN_RE.lastIndex = m.index + 2;
				continue;
			}
			out += body.slice(pos, m.index);
			out += '<strong>' + marked.parseInline(restoreCodeRegions(inner, codeStore)) + '</strong>';
			pos = afterIdx;
			STRONG_SPAN_RE.lastIndex = pos;
		}
		return out + body.slice(pos);
	}

	function preprocessMarkdown(src) {
		mathPlaceholders = [];
		var parts = splitFrontMatter(src);
		var body = parts.body;

		/* Order matters: extract whole fenced blocks first so the inline-code regex
		   below never runs its backtick matching across (or inside) a fence's content. */
		var codeStore = [];
		body = protectCodeRegions(body, FENCE_RE, codeStore);
		body = protectCodeRegions(body, INLINE_CODE_RE, codeStore);

		body = body.replace(/\$\$([\s\S]+?)\$\$/g, function (_, tex) {
			var i = mathPlaceholders.length;
			mathPlaceholders.push({ display: true, tex: tex.trim() });
			return '\n\n<div class="rtlmd-math-ph" data-math-index="' + i + '"></div>\n\n';
		});

		body = body.replace(/(^|[^\\])\$([^\$\n]+?)\$/g, function (m, pre, tex) {
			var i = mathPlaceholders.length;
			mathPlaceholders.push({ display: false, tex: tex.trim() });
			return pre + '<span class="rtlmd-math-ph" data-math-index="' + i + '"></span>';
		});

		/* Finish `**bold**` spans marked leaves literal (code is still protected
		   above, math placeholders are already extracted, so neither is harmed). */
		body = convertLiteralStrong(body, codeStore);

		/* Put the protected code back exactly as written — never math-processed. */
		body = restoreCodeRegions(body, codeStore);

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
		if (!mathPlaceholders.length) return html;
		/* DOM-based replacement (not string/regex matching) so this stays correct no
		   matter how the sanitizer reorders/re-serializes the placeholder's attributes. */
		var wrap = document.createElement('div');
		wrap.innerHTML = html;
		var placeholders = wrap.querySelectorAll('.rtlmd-math-ph');
		placeholders.forEach(function (el) {
			var idx = Number(el.getAttribute('data-math-index'));
			var item = mathPlaceholders[idx];
			if (!item) {
				el.remove();
				return;
			}
			var replacement = document.createElement(mathPlaceholderTag(item.display));
			replacement.className = item.display ? 'math-block' : 'math-inline';
			replacement.setAttribute('dir', 'ltr');
			replacement.innerHTML = renderKatex(item.tex, item.display);
			el.replaceWith(replacement);
		});
		return wrap.innerHTML;
	}

	window.rtlmdPreprocessMarkdown = preprocessMarkdown;
	window.rtlmdPostprocessMarkdownHtml = postprocessMarkdownHtml;
