// H&S on Command service worker. Network first, so updates arrive as soon as there is signal;
// the last copy of the app is kept on the phone so it still opens with no signal.
// It also shows the phone notifications the server sends, and opens the app when one is tapped.
const C = 'hsoc-app-v8';
const SHELL = ['./', 'config.js', 'manifest.webmanifest', 'icon-hs-192.png', 'icon-hs-512.png', 'apple-touch-icon-hs.png', 'favicon-hs.png', 'badge-hs.png'];
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

// ---------- notifications ----------
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    wins.forEach((w) => w.postMessage({ hs: 'push', kind: d.kind || '' }));
    await self.registration.showNotification(d.title || 'H&S on Command', {
      body: d.body || '', tag: d.tag || undefined, icon: 'icon-hs-192.png', badge: 'badge-hs.png',
      data: { kind: d.kind || '' }, requireInteraction: d.kind === 'incident' || d.kind === 'hazard',
    });
  })());
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) { try { await w.focus(); } catch {} w.postMessage({ hs: 'open' }); return; }
    }
    await self.clients.openWindow(self.registration.scope + '#alerts');
  })());
});
