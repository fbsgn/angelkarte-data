/* Angelkarte – Service Worker
   - App-Dateien (gleiche Origin): network-first (4 s Timeout), Offline-Fallback aus Cache. Updates greifen sofort,
     kein manuelles Cache-Bumpen mehr nötig.
   - CDN-Bibliotheken (versioniert): cache-first.
   - Kartenkacheln: cache-first mit Größenlimit (Cache-Name bewusst stabil, damit gewärmte Kacheln erhalten bleiben).
   Nur APP_VERSION erhöhen, wenn die Precache-Liste sich ändert. */
const APP_VERSION = 'v15';
const APP_CACHE = 'angelkarte-app-' + APP_VERSION;
const TILE_CACHE = 'angelkarte-tiles-v14';
const MAX_TILES = 2500;
const NET_TIMEOUT = 4000;

const APP_ASSETS = ['./', './index.html', './angelkarte-public.html', './app.js', './app.css', './manifest.json', './manifest-public.json', './icon-192.svg', './icon-512.svg'];
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet-omnivore/0.3.4/leaflet-omnivore.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP_CACHE);
    await Promise.allSettled(APP_ASSETS.map(u => c.add(new Request(u, { cache: 'reload' }))));
    await Promise.allSettled(CDN_ASSETS.map(u => c.add(new Request(u, { mode: 'cors' }))));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [APP_CACHE, TILE_CACHE];
    for (const k of await caches.keys()) if (k.startsWith('angelkarte-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isTile = u => /(^|\.)kartverket\.no$|(^|\.)arcgisonline\.com$|(^|\.)openseamap\.org$|(^|\.)tile\.openstreetmap\.org$|(^|\.)geonorge\.no$/.test(u.hostname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return;            // Sync nie cachen
  if (isTile(url)) return e.respondWith(tileFirst(req));
  if (url.origin === location.origin) return e.respondWith(networkFirst(req, url));
  if (url.hostname === 'cdnjs.cloudflare.com') return e.respondWith(cacheFirst(req));
});

function withTimeout(p, ms, ctrl) {
  return new Promise((res, rej) => { const t = setTimeout(() => { ctrl.abort(); rej(new Error('timeout')); }, ms); p.then(v => { clearTimeout(t); res(v); }, err => { clearTimeout(t); rej(err); }); });
}

async function networkFirst(req, url) {
  const cache = await caches.open(APP_CACHE);
  const key = new Request(url.origin + url.pathname);       // Query (?t=…) nicht als eigenen Eintrag speichern
  try {
    const ctrl = new AbortController();
    const res = await withTimeout(fetch(url.href, { cache: 'no-cache', signal: ctrl.signal }), NET_TIMEOUT, ctrl);
    if (res && res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') { const idx = await cache.match('./index.html'); if (idx) return idx; }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
  return res;
}

let putCount = 0;
async function tileFirst(req) {
  const cache = await caches.open(TILE_CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      cache.put(req, res.clone());
      if (++putCount % 50 === 0) trimTiles(cache);
    }
    return res;
  } catch (err) {
    const fb = await cache.match(req, { ignoreVary: true });
    if (fb) return fb;
    throw err;
  }
}
async function trimTiles(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await cache.delete(keys[i]);
}
