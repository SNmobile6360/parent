/* 시연 키트 오프라인 — 매장 와이파이가 끊겨도 시연이 돈다.
 * 키트·부모웹앱은 「인터넷 되면 새것, 안 되면 저장해 둔 것」. 그림 등은 저장해 둔 것을 먼저 쓴다.
 * 🔴 서버(*.supabase.co) 요청은 다른 주소라 여기서 건드리지 않는다(리모컨은 늘 진짜 서버로 간다). */
const C = 'snkit-v4';   // 2026-11-25 (3) : 부모님 폰 리모컨(index) + 그림으로 보기(sim)
const PRE = ['./', './index.html', './sim.html', './manifest.json', '../icon-192.png', '../icon.png'];
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
