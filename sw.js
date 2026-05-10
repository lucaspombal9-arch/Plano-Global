// ============================================================
// PROGRAMA GLOBAL — SERVICE WORKER
// Estratégia: Cache First para assets estáticos,
//             Network First para o HTML principal.
// ============================================================

const CACHE_NAME = 'programa-global-v1';

// Recursos essenciais para funcionar offline após 1º acesso
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  // Google Fonts (serão cacheadas na primeira visita)
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
];

// ── INSTALL: pré-cacheia os assets essenciais ─────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-cacheando assets');
      // Usa addAll com fallback individual para não quebrar se
      // algum asset remoto (fontes) falhar no install
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Não cacheou:', url, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

// ── ACTIVATE: limpa caches antigos ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deletando cache antigo:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: estratégia híbrida ─────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests não-GET e extensões de browser
  if (request.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;

  // HTML principal → Network First (garante conteúdo atualizado)
  if (request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Tudo mais (CSS, JS, fontes, ícones) → Cache First
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        // Só cacheia respostas válidas
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      });
    })
  );
});
