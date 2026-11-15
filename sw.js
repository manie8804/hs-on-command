// H&S on Command service worker. Network first, so updates arrive as soon as there is signal;
// the last copy of the app is kept on the phone so it still opens with no signal.
const C = 'hsoc-app-v4';
const SHELL = ['./', 'config.js', 'manifest.webmanifest', 'icon-hs-192.png', 'icon-hs-512.png', 'apple-touch-icon-hs.png', 'favicon-hs.png'];
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener('activate', (e) => e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== C) await caches.delete(k); await self.clients.claim(); })()));
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  const key = r.mode === 'navigate' ? './' : new URL(r.url).pathname.split('/').pop() || './';
  e.respondWith((async () => {
    const c = await caches.open(C);
    const net = fetch(r, { cache: 'no-store' }).then((res) => { if (res.ok) c.put(key, res.clone()); return res; });
    const slow = new Promise((ok) => setTimeout(ok, 5000, null));
    try { const res = await Promise.race([net, slow]); if (res) return res; } catch {}
    const hit = await c.match(key); if (hit) return hit;
    return net.catch(() => Response.error());
  })());
});
