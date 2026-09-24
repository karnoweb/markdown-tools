/* ── 70-toolbar.js ──
   Markdown toolbar actions (bold, lists, table, task…). */
	function wrapSelection(selected, before, after) {
		return before + (selected || '') + after;
	}

	function prefixLines(selected, prefix) {
		var src = selected || '';
		if (!src) return prefix;
		return src.split(/\r?\n/).map(function (line) {
			return prefix + line;
		}).join('\n');
	}

	function applyMdTool(action) {
		if (!$editor || !$editor.length) return;
		var active = findDoc(docsState.activeId);
		if (active && active.pinned) return;
		var el = $editor[0];
		var start = el.selectionStart;
		var end = el.selectionEnd;
		var value = el.value;
		var selected = value.slice(start, end);
		var insert = '';
		var cursor = null;

		switch (action) {
			case 'bold':
				insert = wrapSelection(selected || 'bold', '**', '**');
				break;
			case 'italic':
				insert = wrapSelection(selected || 'italic', '*', '*');
				break;
			case 'heading':
				insert = selected ? prefixLines(selected, '## ') : '## Heading';
				break;
			case 'code':
				insert = wrapSelection(selected || 'code', '`', '`');
				break;
			case 'codeblock':
				insert = '```\n' + (selected || 'code') + '\n```';
				break;
			case 'link':
				insert = '[' + (selected || 'text') + '](https://)';
				cursor = start + insert.lastIndexOf('https://') + 'https://'.length;
				break;
			case 'ul':
				insert = selected ? prefixLines(selected, '- ') : '- item';
				break;
			case 'ol':
				insert = selected ? prefixLines(selected, '1. ') : '1. item';
				break;
			case 'quote':
				insert = selected ? prefixLines(selected, '> ') : '> quote';
				break;
			case 'hr':
				insert = '\n\n---\n\n';
				break;
			case 'strike':
				insert = wrapSelection(selected || 'text', '~~', '~~');
				break;
			case 'table':
				insert = selected || '| Column 1 | Column 2 |\n| --- | --- |\n| Cell | Cell |';
				break;
			case 'task':
				insert = selected ? prefixLines(selected, '- [ ] ') : '- [ ] Task';
				break;
			case 'image':
				insert = '![' + (selected || 'alt') + '](https://)';
				cursor = start + insert.lastIndexOf('https://') + 'https://'.length;
				break;
			default:
				return;
		}

		el.value = value.slice(0, start) + insert + value.slice(end);
		var nextPos = cursor != null ? cursor : start + insert.length;
		el.focus();
		el.setSelectionRange(nextPos, nextPos);
		onEditorChange();
	}

	function bindMarkdownToolbar() {
		$('.md-toolbar').on('click', '.md-tool', function () {
			applyMdTool($(this).data('md'));
		});
	}
