/* PIKA PICTURE service worker: caches poster images only (never video, API JSON or anything with a Range header). */
const CACHE = 'pika-posters-v3', MAX = 400;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('pika-') && k !== CACHE) await caches.delete(k); // remove old versions
  await self.clients.claim();
})()));
async function trim(c) { const ks = await c.keys(); for (let i = 0; i < ks.length - MAX; i++) await c.delete(ks[i]); }
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || !(r.destination === 'font' || (r.destination === 'image' && r.url.includes('/proxy?url=')) || /iWatch\.png|VIP\.ttf/.test(r.url)) || r.headers.has('range')) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE).catch(() => null);
    const hit = c && await c.match(r);
    if (hit) return hit;                                   // posters are immutable: cache-first, no re-download
    try {
      const res = await fetch(r);
      if (c && (res.ok || res.type === 'opaque')) { c.put(r, res.clone()).then(() => trim(c)).catch(() => {}); } // quota errors ignored
      return res;
    } catch (err) { return Response.error(); }
  })());
});
