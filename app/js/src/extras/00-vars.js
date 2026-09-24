/* ── 00-vars.js ──
   Shared module state (api handle) + localStorage keys. */

	var api = null;
	var LANG_KEY = 'rtlmd-lang';
	var SPELL_KEY = 'rtlmd-spellcheck';
	var AUTOSAVE_KEY = 'rtlmd-autosave-disk';
	var TOC_KEY = 'rtlmd-toc';
	var LINE_NUM_KEY = 'rtlmd-line-numbers';
	var MAX_SNAPSHOTS = 15;
	var mathPlaceholders = [];
