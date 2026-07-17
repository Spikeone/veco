// Precache-everything service worker. Release ritual: bump CACHE, commit, push.
const CACHE = 'veco-v2';

const UI_IMAGES = [
  'sound-on', 'sound-off', 'basket', 'cart', 'play-big',
  'play-small', 'pause-small', 'yes', 'no',
].map((n) => `./assets/ui/${n}.png`);

const FOOD_IMAGES = Array.from({ length: 121 }, (_, i) =>
  `./assets/foods/${String(i).padStart(3, '0')}.png`);

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/game.js',
  './js/storage.js',
  './js/audio.js',
  './js/ui.js',
  './js/main.js',
  './manifest.webmanifest',
  './favicon.ico',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './assets/music.m4a',
  ...UI_IMAGES,
  ...FOOD_IMAGES,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((cached) => cached || fetch(event.request)),
  );
});
