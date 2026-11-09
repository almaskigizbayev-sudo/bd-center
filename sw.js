// BD COMMAND CENTER — service worker.
// Кэширует только оболочку приложения и шрифты. Данные из базы сюда не попадают:
// запросы к Apps Script всегда идут в сеть.
const VERSION = 'bd-shell-v1';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'config.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;                       // API (POST) — всегда сеть
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;

  // Шрифты: из кэша, при промахе — сеть с сохранением
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSION).then(async (c) => {
      const hit = await c.match(e.request); if (hit) return hit;
      const res = await fetch(e.request); c.put(e.request, res.clone()); return res;
    }));
    return;
  }
  // Оболочка: сначала сеть (чтобы обновления приходили сразу), без сети — кэш
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
  }
});
