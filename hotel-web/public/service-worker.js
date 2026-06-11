/**
 * FAZ 1/#23 — Web Push Service Worker
 *
 * Push event'lerini yakalar, browser notification gösterir.
 * Notification tıklanınca app'i ilgili sayfaya yönlendirir.
 */

self.addEventListener('install', () => {
  // Yeni SW hemen aktif olsun (eski'ye sarılma)
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
