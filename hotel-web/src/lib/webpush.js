/**
 * FAZ 1/#23 — Web Push client helper.
 *
 * Akış:
 *  1. ensureSWRegistered(): service worker register
 *  2. fetchVapidKey(): backend'den public key al
 *  3. requestPermission(): browser izin sor
 *  4. subscribe(): pushManager.subscribe + backend POST
 *  5. unsubscribe(): pushManager.unsubscribe + backend DELETE
 */
import api from '../api/client'

const SUPPORTED = typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'PushManager' in window
  && 'Notification' in window

export function isPushSupported() {
  return SUPPORTED
}

export function getPermission() {
  if (!SUPPORTED) return 'unsupported'
  return Notification.permission  // 'default', 'granted', 'denied'
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

async function ensureSWRegistered() {
  if (!SUPPORTED) throw new Error('Push not supported')
  let reg = await navigator.serviceWorker.getRegistration('/service-worker.js')
  if (!reg) {
    reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
  }
  await navigator.serviceWorker.ready
  return reg
}

async function fetchVapidKey() {
  const { data } = await api.get('/api/push/vapid-public-key')
  if (!data?.publicKey) throw new Error('VAPID public key boş — backend yapılandırılmamış')
  return data.publicKey
}

export async function requestPermission() {
  if (!SUPPORTED) return 'unsupported'
  return await Notification.requestPermission()
}

export async function subscribeUser() {
  if (!SUPPORTED) throw new Error('Push not supported')
  const reg = await ensureSWRegistered()

  // Mevcut subscription varsa kullan
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const vapidKey = await fetchVapidKey()
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
  }

  const payload = sub.toJSON()  // { endpoint, keys: { p256dh, auth } }
  await api.post('/api/push/subscribe', payload)
  return sub
}

export async function unsubscribeUser() {
  if (!SUPPORTED) return
  const reg = await navigator.serviceWorker.getRegistration('/service-worker.js')
  if (!reg) return
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  try {
    await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint })
  } catch { /* sessiz */ }
  await sub.unsubscribe()
}

export async function isSubscribed() {
  if (!SUPPORTED) return false
  try {
    const reg = await navigator.serviceWorker.getRegistration('/service-worker.js')
    if (!reg) return false
    const sub = await reg.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}
