/* ── 10-i18n.js ──
   en/fa string packs, lang()/t(), window.rtlmdT hook, document templates. */
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
			exportDocx: 'Word (.docx)', frontMatter: 'Metadata',
			wordExportFailed: 'Word export failed. Please try again.',
			storageFullWarning: 'Browser storage is full — this change was NOT saved. Delete old documents or large pasted images, or export a backup, then try again.'
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
			exportDocx: 'Word (.docx)', frontMatter: 'متادیتا',
			wordExportFailed: 'خروجی Word ناموفق بود. لطفاً دوباره تلاش کنید.',
			storageFullWarning: 'فضای ذخیره‌سازی مرورگر پر است — این تغییر ذخیره نشد. چند سند قدیمی یا تصویر بزرگ چسبانده‌شده را حذف کنید یا یک پشتیبان خروجی بگیرید و دوباره تلاش کنید.'
		}
	};

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
