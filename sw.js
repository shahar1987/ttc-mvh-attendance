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
const VERSION = '__BUILD_VERSION__';
const CACHE = 'ttc-shell-' + VERSION;
// בפיתוח מקומי (sw.js בלי הזרקת גרסה) אין קבצים עם ?v= — לא מנסים לשמור אותם
const BUILT = !VERSION.startsWith('__');
// הליבה: בלי אחד מהם האפליקציה לא נפתחת בלי רשת. app.js ו-tailwind.css נטענים
// מ-index.html עם ?v=<גרסה> (deploy.yml), ולכן חייבים להישמר בדיוק בכתובת הזו —
// אחרת, אחרי פרסום, הפתיחה הראשונה בלי רשת נכשלת (המטמון הישן כבר נמחק).
const CORE = ['./', './index.html'].concat(
  BUILT ? ['./app.js?v=' + VERSION, './tailwind.css?v=' + VERSION] : []
);
// השאר: נחמד שיהיה. כישלון של אחד מהם לא מפיל את ההתקנה.
const EXTRA = ['./manifest.json', './logo.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      // addAll נכשל כולו אם קובץ ליבה נופל — ואז ההתקנה נכשלת וה-service worker
      // הקודם (עם המטמון השלם שלו) נשאר בשליטה. עדיף על גרסה חדשה בלי app.js.
      c
        .addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))
        .then(() => Promise.allSettled(EXTRA.map((u) => c.add(u))))
        // התקנה שנכשלה לא משאירה מטמון ריק מאחור
        .catch((err) => caches.delete(CACHE).then(() => Promise.reject(err)))
    ).then(() => self.skipWaiting())
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
    if (hit) return hit;
    // לא מחזירים index.html לבקשת נתונים — זה גורם לשגיאת פענוח במקום "אין נתונים"
    if (/\.json($|\?)/i.test(req.url)) {
      return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
    }
    return caches.match('./index.html');
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
