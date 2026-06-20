/**
 * FAZ 1/#23 — Web Push Service Worker
 * FAZ 2/#8  — PWA offline cache + install/activate hooks
 *
 * Strateji:
 *  - precache: app shell (index.html, favicon, manifest)
 *  - runtime cache: GET istekleri network-first, fail durumunda cache
 *  - push event: payload yoksa generic mesaj (FAZ 1)
 *  - notification click: tab odaklanir veya yeni acilir
 */

// FAZ I.6 — bump version (manifest + offline fallback eklendi)
const CACHE_VERSION = 'ajanshotel-v5'
const APP_SHELL = [
  '/',
  '/favicon.svg',
  '/manifest.json',
  '/offline.html',
]
// FAZ I.6 — Static asset uzantilari icin stale-while-revalidate
const SWR_EXT = /\.(?:js|css|woff2?|svg|png|jpg|jpeg|webp|ico)$/i

self.addEventListener('install', (event) => {
  // FAZ 2/#8 — App shell'i precache
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL)).catch(() => {})
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // FAZ 2/#8 — Eski versiyon cache'leri temizle
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// FAZ I.6 — Akilli cache stratejisi:
//   - /api, /ws  → bypass (her zaman fresh)
//   - Static asset (js/css/font/image) → stale-while-revalidate (hizli sayfa acma)
//   - Navigate → network-first, offline.html fallback
self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return

  const isAsset = SWR_EXT.test(url.pathname)

  if (isAsset) {
    // SWR: hemen cache'den ver + arka planda guncelle
    event.respondWith(
      caches.open(CACHE_VERSION).then(async cache => {
        const cached = await cache.match(req)
        const fetchPromise = fetch(req)
          .then(res => {
            if (res && res.status === 200 && res.type === 'basic') {
              cache.put(req, res.clone()).catch(() => {})
            }
            return res
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  // Navigate / HTML → network-first
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone()
          caches.open(CACHE_VERSION).then(c => c.put(req, resClone)).catch(() => {})
        }
        return res
      })
      .catch(async () => {
        const cached = await caches.match(req)
        if (cached) return cached
        if (req.mode === 'navigate') {
          // Once SPA fallback, sonra explicit offline page
          return (await caches.match('/')) || (await caches.match('/offline.html'))
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' })
      })
  )
})

self.addEventListener('push', (event) => {
  // FAZ 1/#23 — Pure Java VAPID + payload-less push.
  // Backend body göndermez (encryption tabaka atlandı), generic mesaj göster.
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }

  const title = data.title || 'AjansHotel'
  const options = {
    body: data.body || 'Yeni bir bildirim var — kontrol et.',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: { link: data.link || '/', notificationId: data.notificationId },
    tag: data.notificationId ? `notif-${data.notificationId}` : 'ajanshotel-generic',
    renotify: false,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = event.notification.data?.link || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Açık tab varsa: oraya odaklan + url'e git
      for (const client of clientList) {
        if (client.url.includes(self.location.origin)) {
          client.focus()
          if ('navigate' in client) client.navigate(link).catch(() => {})
          return
        }
      }
      // Yoksa yeni tab aç
      return self.clients.openWindow(link)
    })
  )
})
