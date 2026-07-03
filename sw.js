// Track service worker. Caches the app shell so launches work offline.
// Network-first for same-origin assets so fresh code always wins; the cache
// is only consulted when the network fails. Bypasses the GitHub API and
// gist downloads so sync always hits live data.
//
// Bumping CACHE invalidates the previous cache on activate and forces a
// fresh fetch of every asset.
const CACHE = 'track-v8';
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
  // Only handle http(s). Extension/data requests break caches.put.
  if (!url.protocol.startsWith('http')) return;
  // Always bypass for the GitHub API, gist downloads, and the Anthropic API.
  // Sync and AI logging need fresh, uncached responses.
  if (url.hostname === 'api.github.com' || url.hostname === 'gist.githubusercontent.com' || url.hostname === 'api.anthropic.com') {
    return;
  }
  if (event.request.method !== 'GET') return;

  // Network-first for same-origin assets, fall back to cache only if offline.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
