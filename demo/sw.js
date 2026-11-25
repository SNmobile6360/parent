/* 시연 키트 오프라인 — 매장 와이파이가 끊겨도 시연이 돈다.
 * 키트·부모웹앱은 「인터넷 되면 새것, 안 되면 저장해 둔 것」. 그림 등은 저장해 둔 것을 먼저 쓴다.
 * 🔴 서버(*.supabase.co)로는 원래 아무 요청도 안 나간다(shim 이 막는다). 여기서는 건드리지 않는다. */
const C = 'snkit-v3';   // 2026-11-25 (2) : 간단판 — 파일 하나라 부모웹앱·data·icons·shim 을 안 쓴다
const PRE = ['./', './index.html', './manifest.json', '../icon-192.png', '../icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(PRE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  const fresh = /\/demo\/([^/]*\.(html|js|json))?$/.test(u.pathname) || /\/(test|index)\.html$/.test(u.pathname);
  if (fresh){
    e.respondWith(fetch(r).then(res => { if (res.ok){ const cp = res.clone(); caches.open(C).then(c => c.put(u.origin + u.pathname, cp)); } return res; })
      .catch(() => caches.match(u.origin + u.pathname)));
  } else {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok){ const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; })));
  }
});
