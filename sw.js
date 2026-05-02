// Track service worker — caches the app shell so launches work offline.
// Bypasses GitHub API/Gist URLs so sync still hits the network.
const CACHE = 'track-v2';
const ASSETS = ['./', 'index.html', 'core.js'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Always bypass for the GitHub API and gist downloads — sync needs fresh data.
  if (url.hostname === 'api.github.com' || url.hostname === 'gist.githubusercontent.com') {
    return;
  }
  if (event.request.method !== 'GET') return;
  // Stale-while-revalidate for app shell.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.ok && (url.origin === self.location.origin)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
