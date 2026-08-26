'use strict';

var CACHE_NAME = 'rtlmd-v3';
var PRECACHE = [
	'./',
	'./index.html',
	'./initcontent.md',
	'./manifest.webmanifest',
	'./app/css/style.css',
	'./app/js/rtlmd.js',
	'./assets/brand/karnoweb-logo.png',
	'./assets/jquery/dist/jquery.min.js',
	'./assets/marked/marked.min.js',
	'./assets/vendor/tailwind.css',
	'./assets/vendor/fonts/fonts.css',
	'./assets/vendor/fonts/vazirmatn/Vazirmatn-Regular.woff2',
	'./assets/vendor/fonts/vazirmatn/Vazirmatn-Medium.woff2',
	'./assets/vendor/fonts/vazirmatn/Vazirmatn-Bold.woff2',
	'./assets/vendor/fonts/fira-code/FiraCode-Regular.woff2',
	'./assets/vendor/fonts/fira-code/FiraCode-Medium.woff2',
	'./assets/vendor/prism/prism.min.js',
	'./assets/vendor/prism/themes/prism-tomorrow.min.css',
	'./assets/vendor/prism/themes/prism.min.css',
	'./assets/vendor/prism/components/prism-clike.min.js',
	'./assets/vendor/prism/components/prism-markup.min.js',
	'./assets/vendor/prism/components/prism-markup-templating.min.js',
	'./assets/vendor/prism/components/prism-javascript.min.js',
	'./assets/vendor/prism/components/prism-php.min.js',
	'./assets/vendor/prism/components/prism-bash.min.js',
	'./assets/vendor/prism/components/prism-json.min.js',
	'./assets/vendor/prism/components/prism-sql.min.js',
	'./assets/vendor/prism/plugins/autoloader/prism-autoloader.min.js',
	'./assets/vendor/mermaid/mermaid.min.js',
	'./assets/vendor/html-to-image/html-to-image.js',
	'./assets/pwa/icon-192.png',
	'./assets/pwa/icon-512.png',
	'./assets/pwa/icon-512-maskable.png'
];

self.addEventListener('install', function (event) {
	event.waitUntil(
		caches.open(CACHE_NAME).then(function (cache) {
			return cache.addAll(PRECACHE);
		}).then(function () {
			return self.skipWaiting();
		})
	);
});

self.addEventListener('activate', function (event) {
	event.waitUntil(
		caches.keys().then(function (keys) {
			return Promise.all(keys.filter(function (key) {
				return key !== CACHE_NAME;
			}).map(function (key) {
				return caches.delete(key);
			}));
		}).then(function () {
			return self.clients.claim();
		})
	);
});

self.addEventListener('fetch', function (event) {
	if (event.request.method !== 'GET') return;

	var url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		caches.match(event.request).then(function (cached) {
			if (cached) return cached;
			return fetch(event.request).then(function (response) {
				if (!response || response.status !== 200 || response.type === 'opaque') {
					return response;
				}
				var copy = response.clone();
				caches.open(CACHE_NAME).then(function (cache) {
					cache.put(event.request, copy);
				});
				return response;
			}).catch(function () {
				if (event.request.mode === 'navigate') {
					return caches.match('./index.html');
				}
			});
		})
	);
});
