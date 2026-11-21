/* ─────────────────────────────────────────────────────────────
   시내모바일 부모웹앱 — 서비스워커 (알림 전용)
   2026-09-07 신규

   ● 이 파일이 하는 일은 「알림 받기」 하나뿐입니다.
     페이지를 캐시하지 않습니다. 캐시하면 웹앱을 새로 올려도
     부모 폰에 옛 화면이 계속 떠서 사고가 납니다.

   ● 위치가 중요합니다 : 반드시 index.html 과 같은 폴더에 두세요.
     서비스워커는 자기가 놓인 폴더 아래만 담당합니다.
     (https://snmobile6360.github.io/parent/sw.js  →  /parent/ 담당)
   ───────────────────────────────────────────────────────────── */

const TAG = 'sinae-access-request';

// 설치되자마자 활성화 (옛 서비스워커를 기다리지 않는다)
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// ── 푸시 수신 ──
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = {}; }

  const title = d.title || '자녀가 사이트 접속을 요청했습니다';
  const body  = d.body  || '눌러서 확인해 주세요';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: './icon.png',
      badge: './icon.png',
      // 같은 tag 면 알림이 쌓이지 않고 최신 것으로 바뀝니다.
      // renotify:true 라 바뀔 때도 소리가 납니다.
      tag: d.tag || TAG,
      renotify: true,
      requireInteraction: false,
      // ⚠️ silent:true 로 두면 소리가 안 납니다. 절대 켜지 마세요.
      silent: false,
      vibrate: [200, 100, 200],
      data: { url: d.url || './index.html', code: d.code || '' },
      actions: [{ action: 'open', title: '확인하기' }]
    })
  );
});

// ── 알림을 눌렀을 때 ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';

  event.waitUntil((async () => {
    const url = new URL(target, self.location.href).href;
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // 이미 열려 있으면 그 창을 앞으로
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin) && 'focus' in w) {
        try { await w.navigate(url); } catch (_) {}
        return w.focus();
      }
    }
    // 없으면 새로 연다
    if (self.clients.openWindow) return self.clients.openWindow(url);
  })());
});

// ── 구독이 서버에 의해 갱신됐을 때 ──
//    브라우저가 endpoint 를 바꾸는 경우가 있습니다. 그대로 두면 알림이 조용히 끊깁니다.
//    페이지가 열려 있으면 알려서 다시 등록하게 합니다.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) w.postMessage({ type: 'resubscribe' });
  })());
});
