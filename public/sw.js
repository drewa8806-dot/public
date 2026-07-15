const CACHE_NAME = 'shadowvoice-v1.0';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/app.js',
  '/js/ui.js',
  '/js/canvas-board.js',
  '/js/spatial-audio.js',
  '/js/webrtc-manager.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  'https://cdn.socket.io/4.7.5/socket.io.min.js',
  'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'
];

// Install Service Worker and Cache Static Shell
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching App Shell');
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('[SW] Caching failed for some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate & Cleanup Old Caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker Activated');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache-First with Network Fallback Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, Socket.IO, PeerJS endpoints, and WebSockets from cache
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/socket.io') ||
    url.pathname.startsWith('/peerjs') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Ignore network offline errors */});

        return cachedResponse;
      }

      return fetch(event.request).catch(() => {
        // Optional offline fallback fallback
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      });
    })
  );
});
