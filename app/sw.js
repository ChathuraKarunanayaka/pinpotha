// Offline support. Bump VERSION when publishing changes so phones fetch the new files.
const VERSION = 'v7';
const SHELL = 'shell-' + VERSION, FONTS = 'fonts';
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  ...['main', 'store', 'util', 'calc', 'poya', 'ui', 'messages', 'card', 'art', 'share', 'pdf', 'report-pdf', 'collage', 'search', 'demo', 'screens/auth', 'screens/home', 'screens/donate', 'screens/collection', 'screens/messages', 'screens/money', 'screens/people', 'screens/events', 'screens/more', 'screens/report', 'screens/photos'].map(f => `js/${f}.js`)];

self.addEventListener('install', e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // Network first so updates arrive; the saved copy takes over when offline or slow.
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const saved = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; });
    if (!saved) return net;
    return Promise.race([net.catch(() => saved), new Promise(r => setTimeout(() => r(saved), 3000))]);
  })());
});
