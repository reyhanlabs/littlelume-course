// LittleLume English Course — Service Worker
// Strategi:
//   • File aplikasi sendiri (HTML/JS/CSS/ikon) → network-first, fallback cache  → update langsung terlihat, tetap bisa dibuka offline
//   • Library CDN (versi terkunci di URL)         → cache-first
//   • Firebase / Google API (auth & database)     → selalu langsung ke network, tidak pernah di-cache
// Ganti CACHE_VERSION kalau daftar APP_SHELL berubah.
const CACHE_VERSION = 'littlelume-v10';

// Path relatif terhadap lokasi sw.js → tetap jalan walau di-host di subfolder
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/changelog.js',
  './js/core.js',
  './js/dashboard-students.js',
  './js/attendance-eval.js',
  './js/payment-receipt.js',
  './js/deposits.js',
  './js/reports-analytics.js',
  './js/notifications-ui.js',
  './js/search-nav-misc.js',
  './js/restore-points.js',
  './js/overview.js',
  './js/curriculum.js',
  './js/share-bar.js',
  './js/lesson-print.js',
  './curriculum/curriculum.json',
  './favicon.ico',
  './favicon-256x256.png',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

const CDN_HOSTS = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

// ── INSTALL: simpan app shell (satu file gagal tidak menggagalkan semuanya) ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => Promise.all(APP_SHELL.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(err => console.warn('[SW] skip', url, err))
      )))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: hapus cache versi lama (termasuk cache lama "bunrey-…") ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                 // POST/PUT dsb. tidak pernah di-cache
  const url = new URL(req.url);
  if (!url.protocol.startsWith('http')) return;     // chrome-extension:, data:, dll.

  // Firebase Auth / Firestore / Google APIs → biarkan browser yang menangani (network)
  if (url.hostname.endsWith('googleapis.com') && url.hostname !== 'fonts.googleapis.com') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('firestore')) return;
  if (url.hostname === 'www.gstatic.com' && !url.pathname.startsWith('/firebasejs/')) return;

  // Library CDN & font → cache-first
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }))
    );
    return;
  }

  // File aplikasi sendiri → network-first, fallback cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() =>
        caches.match(req, { ignoreSearch: true }).then(cached => {
          if (cached) return cached;
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        })
      )
    );
  }
});

// ── MESSAGE: paksa update ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
