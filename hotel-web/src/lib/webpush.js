/**
 * FAZ 1/#23 — Web Push client helper.
 *
 * Akış:
 *  1. ensureSWRegistered(): service worker register
 *  2. fetchVapidKey(): backend'den public key al
 *  3. requestPermission(): browser izin sor
 *  4. subscribe(): pushManager.subscribe + backend POST
 *  5. unsubscribe(): pushManager.unsubscribe + backend POST /unsubscribe
 *
 * Izin sadece giris yapmis kullaniciya, anlamli bir anda sorulur
 * (requestPushMoment — ilk basvuru / ilk ilan). Girişte izin zaten varsa
 * abonelik sessizce bu kullaniciya baglanir (syncPushSubscription); cikista
 * sunucudan koparilir (detachPushFromServer) ki ortak cihazda baskasinin
 * bildirimi gelmesin.
 */
import api from '../api/client'

const OFF_KEY = 'kadrom.push.off'              // kullanici ayarlardan kapatti
const SNOOZE_KEY = 'kadrom.push.snooze-until'  // "Şimdi değil" → 7 gün sonra tekrar
const SNOOZE_DAYS = 7
export const PUSH_MOMENT_EVENT = 'kadrom:push-moment'

function readLS(key) { try { return localStorage.getItem(key) } catch { return null } }
function writeLS(key, value) {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* yok say */ }
}

export function isPushOptedOut() { return readLS(OFF_KEY) === '1' }

export function isPushSnoozed(now = Date.now()) {
  const until = Number(readLS(SNOOZE_KEY))
  return Number.isFinite(until) && until > now
}

export function snoozePush(now = Date.now()) {
  writeLS(SNOOZE_KEY, String(now + SNOOZE_DAYS * 24 * 60 * 60 * 1000))
}

/** Uygulamanin bir yerinde "bildirim tam simdi ise yarar" ani olunca cagrilir. */
export function requestPushMoment(reason) {
  window.dispatchEvent(new CustomEvent(PUSH_MOMENT_EVENT, { detail: { reason } }))
}

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
  writeLS(OFF_KEY, null)
  return sub
}

/** Ayarlardan kapatma: tarayici aboneligi + sunucu kaydi silinir, bir daha sorulmaz. */
export async function unsubscribeUser() {
  writeLS(OFF_KEY, '1')
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

/**
 * Giriste / sayfa yenilemede: izin zaten verilmisse aboneligi bu kullaniciya
 * sessizce bagla. Eski surumde izin verip kaydi yarim kalanlar da boylece duzelir.
 */
export async function syncPushSubscription() {
  if (!SUPPORTED || getPermission() !== 'granted' || isPushOptedOut()) return false
  try {
    await subscribeUser()
    return true
  } catch (e) {
    console.warn('[Push] sync failed:', e?.message)
    return false
  }
}

/** Cikista: tarayici aboneligi kalir, sadece sunucudaki bu kullanici kaydi silinir. */
export async function detachPushFromServer() {
  if (!SUPPORTED) return
  try {
    const reg = await navigator.serviceWorker.getRegistration('/service-worker.js')
    const sub = await reg?.pushManager.getSubscription()
    if (sub) await api.post('/api/push/unsubscribe', { endpoint: sub.endpoint })
  } catch { /* sessiz: cikisi engellemesin */ }
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
