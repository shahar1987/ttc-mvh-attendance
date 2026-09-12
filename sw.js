// Service worker: caches the app shell so the app OPENS instantly, also with no connection.
// The data itself is handled by Firestore's own offline cache, not here.
// __BUILD_VERSION__ is replaced at build time with the commit sha, so a new deploy
// installs a fresh cache instead of serving stale code.
//
// Strategy:
//   * app.js?v=… / tailwind.css?v=… / images  -> cache-first. The URL changes on every
//     deploy, so a cached copy can never be stale. This is what makes launches fast.
//   * index.html (navigations)                 -> serve the cached copy immediately,
//     refresh it in the background. A new deploy is picked up on the next launch.
//   * everything else (tttm.json, manifest)    -> network-first, cache fallback.
const CACHE = 'ttc-shell-__BUILD_VERSION__';
const SHELL = ['./', './index.html', './manifest.json', './logo.png', './icon-192.png', './icon-512.png'];

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

function isVersionedAsset(url) {
  return /[?&]v=/.test(url.search) || /\.(png|svg|jpg|jpeg|webp|woff2?|ico)$/i.test(url.pathname);
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.status === 200) {
    const c = await caches.open(CACHE);
    c.put(req, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const refresh = fetch(req)
    .then((res) => {
      if (res && res.status === 200) c.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await refresh) || (await c.match('./index.html'));
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.status === 200) {
      const c = await caches.open(CACHE);
      c.put(req, res.clone());
    }
    return res;
  } catch (e) {
    const hit = await caches.match(req);
    return hit || caches.match('./index.html');
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache Firebase/Google traffic - it must always hit the network (or Firestore's own cache).
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('firebase') ||
      url.hostname.includes('google.com') || url.hostname.includes('gstatic.com')) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (isVersionedAsset(url)) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(staleWhileRevalidate(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});
