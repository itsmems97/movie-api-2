/* PIKA PICTURE service worker v4
   Caches ONLY poster images (+ logo/font). It never touches video, audio, subtitles, API JSON, or any Range request.
   Why v3 looked huge (616 MB): posters were stored as "opaque" (no-cors) responses. Chrome counts every opaque
   response as several MB of quota (padding), so ~170 posters looked like hundreds of MB and the quota/eviction
   logic then threw the cache away -> posters re-downloaded every time.
   v4 fetches posters with CORS, stores REAL (non-opaque) responses, shrinks them to <= 800px WebP, keeps at most 160. */
const CACHE = 'pika-posters-v4', MAX = 160, W_MAX = 800;
let noCors = false;   // proxy refused CORS -> pass through and do NOT cache opaque responses

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('pika-') && k !== CACHE) await caches.delete(k);   // drops the old padded v3 cache
  await self.clients.claim();
})()));

const isPoster = r => r.destination === 'image' && r.url.includes('/proxy?url=');
const isStatic = r => r.destination === 'font' || /\/(iWatch\.png|VIP\.ttf)(\?|$)/.test(r.url);

async function trim(c) {
  const ks = (await c.keys()).filter(k => k.url.includes('/proxy?url='));
  for (let i = 0; i < ks.length - MAX; i++) await c.delete(ks[i]);   // oldest first
}
async function shrink(blob) {
  try {
    if (!self.createImageBitmap || !self.OffscreenCanvas) return blob;
    const bmp = await createImageBitmap(blob); let w = bmp.width, h = bmp.height;
    if (w > W_MAX) { h = Math.round(h * W_MAX / w); w = W_MAX; }
    const cv = new OffscreenCanvas(w, h); cv.getContext('2d').drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
    let out = await cv.convertToBlob({type: 'image/webp', quality: 0.8});
    if (out.type !== 'image/webp') out = await cv.convertToBlob({type: 'image/jpeg', quality: 0.82});
    return out.size && out.size < blob.size ? out : blob;
  } catch (_) { return blob; }
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range') || !(isPoster(r) || isStatic(r))) return;   // everything else: browser default
  e.respondWith(handle(r));
});

async function handle(r) {
  const key = r.url, poster = isPoster(r);
  const c = await caches.open(CACHE).catch(() => null);
  const hit = c && await c.match(key, {ignoreVary: true}).catch(() => null);
  if (hit) return hit;                                       // cache-first: posters never change
  if (!noCors) {
    try {
      const res = await fetch(key, {mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer'});
      if (res.ok) {
        let body = await res.blob();
        if (poster) body = await shrink(body);
        const out = new Response(body, {status: 200, headers: {'Content-Type': body.type || res.headers.get('content-type') || 'application/octet-stream'}});
        if (c) c.put(key, out.clone()).then(() => poster && trim(c)).catch(() => {});   // quota errors ignored
        return out;
      }
    } catch (_) { if (poster) noCors = true; }
  }
  try { return await fetch(r); } catch (_) { return Response.error(); }   // fallback: normal (uncached) load
}
