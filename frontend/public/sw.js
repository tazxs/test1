/**
 * NalogAI Service Worker — offline app-shell caching.
 *
 * Strategy:
 *   - App shell (HTML, JS, CSS) → cache-first, network-fallback
 *   - Static assets (fonts, images) → cache-first on first fetch
 *   - API calls (/api/*) → network-only (never cache)
 *   - Navigation requests while offline → serve cached root shell
 */

const CACHE_NAME = 'nalogai-shell-v1'

// Pre-cache only the bare minimum so the install step stays fast.
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
]

// ── Install: pre-cache shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

// ── Activate: purge old caches ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// ── Fetch: cache-first for shell assets, network-only for API ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip API calls entirely — always go to network
  if (url.pathname.startsWith('/api')) return

  // For navigation requests (HTML pages) use network-first so users always get
  // fresh content, but fall back to the cached root when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the fresh response for future offline use
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          return response
        })
        .catch(() => caches.match('/').then((cached) => cached ?? new Response('Offline', { status: 503 }))),
    )
    return
  }

  // For static assets (JS/CSS bundles, fonts, images) use cache-first
  const isStaticAsset = /\.(js|css|png|jpg|jpeg|svg|webp|ico|woff2?)(\?.*)?$/.test(url.pathname)
  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return response
        })
      }),
    )
  }
})
