/* ThreadPilot 서비스 워커 — 정적 앱 셸만 캐시합니다.
   /api/* · /oauth/* 는 절대 캐시하지 않고 항상 네트워크로 통과시킵니다.
   (세션 쿠키·OAuth 콜백·발행 결과가 캐시에 가려지면 안 됩니다) */
const CACHE = 'threadpilot-v6';   // 앱 셸이 바뀌면 이 값을 올리세요(이전 캐시는 activate에서 삭제)
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './fonts/PretendardVariable.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/bumbida-logo.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 1) API·OAuth는 서비스 워커가 손대지 않는다 — 항상 네트워크(no cache).
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/oauth/')) return;

  // 2) 화면·스크립트는 네트워크 우선(배포 직후 바로 반영), 오프라인이면 캐시.
  const isShell = req.mode === 'navigate' || url.pathname === '/' ||
    /\/(index\.html|app\.js|sw\.js)$/.test(url.pathname);
  if (isShell) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  // 3) 그 밖의 정적 자산(폰트·아이콘·CSS)은 캐시 우선.
  event.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
