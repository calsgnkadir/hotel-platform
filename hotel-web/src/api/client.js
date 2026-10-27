import axios from 'axios'
import { isPublicPath, rememberReturn } from '../lib/authReturn'
import {
  advanceSessionRevision, getSessionSnapshot, isSessionCurrent,
  onSessionBoundary, waitForPendingLogout,
} from '../lib/sessionLifecycle'

/**
 * F0.2 — Merkezi Axios instance + refresh token rotation.
 *
 * Akış:
 *  - Login/register → access token (15 dk) localStorage'a yazılır
 *                  → refresh token (7 gün) httpOnly cookie'ye konur (otomatik)
 *  - Her istekte access token Authorization header'da gider
 *  - Access süresi dolarsa (proactive) veya 401 alırsa (reactive)
 *    → /api/auth/refresh çağrılır (cookie otomatik gider)
 *    → yeni access token alınır, request retry edilir
 *  - Refresh de fail ederse → handleSessionExpired():
 *      herkese açık sayfada (ana sayfa, ilan, işletme profili, yasal metinler)
 *        yalnız oturum sessizce temizlenir, istek girişsiz sürer, yönlendirme yok;
 *      korumalı sayfada /login'e gidilir; geldiği yol + "oturum sona erdi" bilgisi
 *        sessionStorage'da taşınır (LoginPage okur, girişten sonra geri döner).
 *
 * Olaylar (window):
 *  - 'kadrom:session-cleared'     oturum temizlendi (AuthContext kullanıcıyı düşürür)
 *  - 'kadrom:email-not-verified'  403 EMAIL_NOT_VERIFIED (EmailVerifyDialog açılır)
 */
export const SESSION_CLEARED_EVENT = 'kadrom:session-cleared'
export const EMAIL_NOT_VERIFIED_EVENT = 'kadrom:email-not-verified'
export const EMAIL_NOT_VERIFIED_MESSAGE = 'Devam etmek için e-posta adresini doğrula.'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
  // F0.2 — Cookie göndermek için zorunlu (refresh token tarayıcıdan otomatik gelir)
  withCredentials: true,
})

/** JWT payload'ından exp claim'ini okuyup süresi dolmuş mu kontrol eder */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return false
    // exp saniye cinsinden — 10sn buffer ekle (clock skew + ağ gecikmesi)
    return payload.exp * 1000 < Date.now() + 10000
  } catch {
    return true
  }
}

/** Backend 403 EMAIL_NOT_VERIFIED mi? (ilan açma/yayınlama, başvuru, sohbet başlatma) */
export function isEmailNotVerifiedError(error) {
  return error?.response?.status === 403 && error?.response?.data?.code === 'EMAIL_NOT_VERIFIED'
}

/** Tam sayfa geçişi (testte izlenebilsin diye nesne üzerinden). */
export const sessionNav = {
  toLogin() { window.location.assign('/login') },
}

/**
 * Yenilenemeyen oturum.
 * Dönüş: true  → korumalı sayfa; /login'e gidiliyor (istek iptal edilmeli)
 *        false → herkese açık sayfa; oturum sessizce temizlendi, istek girişsiz sürebilir
 */
export function handleSessionExpired() {
  advanceSessionRevision()
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  try { window.dispatchEvent(new Event(SESSION_CLEARED_EVENT)) } catch { /* yok say */ }

  const { pathname, search, hash } = window.location
  if (isPublicPath(pathname)) return false
  rememberReturn({ pathname, search, hash }, 'expired')
  sessionNav.toLogin()
  return true
}

/* ─────────── Refresh token rotation ─────────── */

// Aynı anda birden fazla 401 → tek bir refresh çağrısı yapılsın
let refreshFlight = null

onSessionBoundary(() => {
  refreshFlight?.controller.abort()
  refreshFlight = null
})

function changedSessionError() {
  return new axios.Cancel('Oturum değişti; önceki isteğin sonucu kullanılmadı')
}

/** /api/auth/refresh çağırır — eski cookie ile yenisini alır, yeni access token döner */
async function performRefresh() {
  if (refreshFlight && isSessionCurrent(refreshFlight.snapshot)) return refreshFlight.promise
  refreshFlight?.controller.abort()
  const flight = { snapshot: getSessionSnapshot(), controller: new AbortController() }

  flight.promise = axios.post(
    (import.meta.env.VITE_API_URL || '') + '/api/auth/refresh',
    {},
    { withCredentials: true, signal: flight.controller.signal }
  ).then(res => {
    if (!isSessionCurrent(flight.snapshot)) throw changedSessionError()
    const { token, ...userFields } = res.data
    if (flight.snapshot.identity != null && userFields.userId != null
        && String(userFields.userId) !== flight.snapshot.identity) {
      throw new Error('Yenilenen oturum mevcut hesaba ait değil')
    }
    if (token) localStorage.setItem('token', token)
    // user bilgileri de güncellenir (rol değişmiş olabilir). Önceki kayıttaki alanlar
    // korunur: eskiden yalnız 4 alan yazılıyordu, emailVerified düşünce doğrulanmış
    // kullanıcıya da "E-postanı doğrula" bandı çıkıyordu.
    if (userFields.userId) {
      let prev = {}
      try { prev = JSON.parse(localStorage.getItem('user') || '{}') || {} } catch { prev = {} }
      localStorage.setItem('user', JSON.stringify({
        ...prev,
        ...userFields,
        id: userFields.userId,
      }))
    }
    return token
  }).finally(() => {
    if (refreshFlight === flight) refreshFlight = null
  })

  refreshFlight = flight
  return flight.promise
}

/* ─────────── REQUEST interceptor ─────────── */
// Login/register/refresh/Google kod değişiminde token gönderme (eski, süresi dolmuş
// token proaktif yenilemeyi tetikleyip Google girişini /login'e atmasın)
const NO_TOKEN_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/oauth/exchange']

api.interceptors.request.use(async (config) => {
  const url = config.url || ''
  const skipToken = NO_TOKEN_PATHS.some(p => url.includes(p))
  if (skipToken && !url.includes('/api/auth/refresh')) await waitForPendingLogout()
  config._sessionSnapshot = getSessionSnapshot()
  if (skipToken) return config

  let token = localStorage.getItem('token')

  // Proactive refresh: token süresi dolmak üzereyse önceden yenile
  if (token && isTokenExpired(token)) {
    try {
      token = await performRefresh()
    } catch (error) {
      if (axios.isCancel(error) || !isSessionCurrent(config._sessionSnapshot)) throw changedSessionError()
      if (handleSessionExpired()) {
        return Promise.reject(new axios.Cancel('Oturum süresi doldu'))
      }
      token = null  // herkese açık sayfa: istek girişsiz devam eder
    }
    config._sessionSnapshot = getSessionSnapshot()
  }

  if (token) config.headers.Authorization = `Bearer ${token}`

  // FAZ 12 — Backend i18n: kullanicinin secili dilini Accept-Language olarak gonder.
  // Dil secimi localStorage 'lang'e yazilir (LanguageSwitcher). Kayit yoksa 'tr'
  // gonderilir — boylece tarayicinin otomatik 'en-US' basligi devreye girmez ve
  // backend hata mesajlari UI ile tutarli (Turkce) doner.
  try {
    config.headers['Accept-Language'] = localStorage.getItem('lang') || 'tr'
  } catch { config.headers['Accept-Language'] = 'tr' }

  return config
})

/* ─────────── RESPONSE interceptor — 401 → reactive refresh ─────────── */
api.interceptors.response.use(
  (response) => {
    if (response.config?._sessionSnapshot && !isSessionCurrent(response.config._sessionSnapshot)) {
      throw changedSessionError()
    }
    return response
  },
  async (error) => {
    const original = error.config
    if (original?._sessionSnapshot && !isSessionCurrent(original._sessionSnapshot)) {
      return Promise.reject(changedSessionError())
    }

    // 403 EMAIL_NOT_VERIFIED — ham toast yerine doğrulama penceresi açılır
    if (isEmailNotVerifiedError(error)) {
      try {
        window.dispatchEvent(new CustomEvent(EMAIL_NOT_VERIFIED_EVENT, {
          detail: { message: error.response.data?.message || EMAIL_NOT_VERIFIED_MESSAGE },
        }))
      } catch { /* yok say */ }
      return Promise.reject(error)
    }

    // 401 — token reddedildi → bir kez refresh dene
    if (error.response?.status === 401 && original && !original._retry) {
      // Login/register/refresh'in kendisi 401 ise refresh denemeyiz
      const isAuthEndpoint = NO_TOKEN_PATHS.some(p => (original.url || '').includes(p))
      if (isAuthEndpoint) {
        // Yanlış şifre vb. — yalnız yerel oturum kalıntısı varsa temizlenir
        if (localStorage.getItem('token')) handleSessionExpired()
        return Promise.reject(error)
      }

      original._retry = true
      try {
        const newToken = await performRefresh()
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)   // request'i tekrar dene
      } catch (refreshError) {
        if (axios.isCancel(refreshError) || !isSessionCurrent(original._sessionSnapshot)) {
          return Promise.reject(changedSessionError())
        }
        if (handleSessionExpired()) return Promise.reject(error)
        // Herkese açık sayfa: aynı isteği girişsiz bir kez daha dene
        // (ilan detayı, işletme profili girişsiz de okunur)
        if (original.headers) delete original.headers.Authorization
        return api(original)
      }
    }

    return Promise.reject(error)
  }
)

/**
 * Backend hata gövdesinden okunabilir mesajı çıkarır.
 * GlobalExceptionHandler şu formatı dönüyor:
 *   { timestamp, status, error, message }
 *   { timestamp, status, error, fields: { email: "..." } }
 */
export function extractErrorMessage(error) {
  const data = error.response?.data
  if (!data) return 'Sunucuya bağlanılamadı'
  if (isEmailNotVerifiedError(error)) return EMAIL_NOT_VERIFIED_MESSAGE
  if (data.fields) return Object.values(data.fields).join(', ')
  return data.message || 'Bir hata oluştu'
}

export default api
