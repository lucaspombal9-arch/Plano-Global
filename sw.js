// ============================================================
// SERVICE WORKER — Programa Global · Futebol Profissional
// Estratégia: Cache-first para assets estáticos,
//             Network-first para navegação
// ============================================================

const CACHE_NAME = 'futebol-pro-v1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-32.png',
  './icon-16.png',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
];

// ── INSTALL: pré-cacheia todos os assets estáticos ──────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: remove caches antigos ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Cache-first para tudo (app offline-ready) ────────
self.addEventListener('fetch', event => {
  // Ignora requests que não são GET
  if (event.request.method !== 'GET') return;

  // Ignora extensões do browser e chrome-extension://
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Retorna do cache, mas atualiza em background
        const fetchUpdate = fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {});

        return cachedResponse;
      }

      // Não está no cache: busca na rede e armazena
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback offline: retorna index.html para navegação
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
