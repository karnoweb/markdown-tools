/* ── 80-settings.js ──
   Line numbers, disk autosave, spellcheck pref, settings dialog. */
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
