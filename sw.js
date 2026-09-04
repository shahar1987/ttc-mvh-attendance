// Service worker: caches the app shell so the app OPENS even with no connection.
// The data itself is handled by Firestore's own offline cache, not here.
// __BUILD_VERSION__ is replaced at build time with the commit sha, so a new deploy
// always invalidates the old cache instead of serving stale code.
const CACHE = 'ttc-shell-__BUILD_VERSION__';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache Firebase/Google traffic - it must always hit the network (or Firestore's own cache).
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') ||
      url.hostname.includes('google.com') || url.hostname.includes('gstatic.com')) {
    return;
  }

  // Network-first for our own assets: always prefer fresh code, fall back to cache offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
  );
});
