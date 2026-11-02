/* ViPhone service worker. Only controls ViPhone.html (so it never touches the PIKA PICTURE sw.js).
   It caches nothing, so an updated ViPhone.html always loads fresh. It only shows a small offline page. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (e) {
  var r = e.request;
  if (r.mode !== 'navigate') return;
  e.respondWith(fetch(r).catch(function () {
    return new Response('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;height:100vh;display:grid;place-items:center;background:#6d3fb5;color:#fff;font-family:system-ui,sans-serif;text-align:center"><div><h2>You are offline</h2><p>Connect to the internet and open ViPhone again.</p></div></body>', { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
  }));
});
