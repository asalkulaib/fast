// Fast service worker. Every file is precached, so the app works fully offline.
// VERSION and ASSETS are stamped by tools/release.mjs on every release.

const VERSION = '2026.09.25-378ed949';
const ASSETS = [
  'css/app.css',
  'css/fonts.css',
  'fonts/OFL.txt',
  'fonts/cormorant-garamond-600-ae062b6d.woff2',
  'fonts/cormorant-garamond-700-21a0fc1c.woff2',
  'fonts/eb-garamond-400-912929db.woff2',
  'fonts/eb-garamond-500-7b252686.woff2',
  'fonts/jost-500-98dce4f0.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-32.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'import/index.html',
  'index.html',
  'js/app.js',
  'js/core/backup.js',
  'js/core/csv.js',
  'js/core/ics.js',
  'js/core/review.js',
  'js/core/rules.js',
  'js/core/time.js',
  'js/core/weight.js',
  'js/db.js',
  'js/import-page.js',
  'js/store.js',
  'js/strip-hash.js',
  'js/ui/art.js',
  'js/ui/chart.js',
  'js/ui/components.js',
  'js/ui/day.js',
  'js/ui/dom.js',
  'js/ui/help.js',
  'js/ui/meal.js',
  'js/ui/more.js',
  'js/ui/outside.js',
  'js/ui/share.js',
  'js/ui/shared.js',
  'js/ui/sheet.js',
  'js/ui/temptation.js',
  'js/ui/today.js',
  'js/ui/week.js',
  'js/ui/weight.js',
  'js/ui/window-times.js',
  'js/version.js',
  'js/weight-import.js',
  'manifest.webmanifest',
];

const CACHE = `fast-${VERSION}`;
const scope = self.registration.scope;
const INDEX = new URL('./', scope).href;
const IMPORT_PAGE = new URL('import/', scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // 'reload' skips the HTTP cache so a release never mixes old and new files.
    await cache.addAll([INDEX, IMPORT_PAGE, ...ASSETS].map((url) => new Request(url, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('fast-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const path = url.href.split(/[?#]/)[0];
    // /fast/import without the slash: redirect like the server does, so the
    // page's relative links resolve. The #payload survives the redirect.
    if (path === IMPORT_PAGE.replace(/\/$/, '')) {
      event.respondWith(Response.redirect(IMPORT_PAGE + url.search, 301));
      return;
    }
    let page = null;
    if (path === INDEX || path === `${INDEX}index.html`) page = INDEX;
    else if (path === IMPORT_PAGE || path === `${IMPORT_PAGE}index.html`) page = IMPORT_PAGE;
    if (page) {
      event.respondWith((async () => {
        const hit = await caches.match(page, { cacheName: CACHE });
        return hit || fetch(req);
      })());
      return;
    }
  }

  event.respondWith((async () => {
    const hit = await caches.match(req, { cacheName: CACHE, ignoreSearch: true });
    return hit || fetch(req);
  })());
});
