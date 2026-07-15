import axios from 'axios'

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
 *  - Refresh de fail ederse → tam temizle + /login'e at
 */
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

function clearSessionAndRedirect() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login'
  }
}

/* ─────────── Refresh token rotation ─────────── */

// Aynı anda birden fazla 401 → tek bir refresh çağrısı yapılsın
let refreshPromise = null

/** /api/auth/refresh çağırır — eski cookie ile yenisini alır, yeni access token döner */
async function performRefresh() {
  if (refreshPromise) return refreshPromise

  refreshPromise = axios.post(
    (import.meta.env.VITE_API_URL || '') + '/api/auth/refresh',
    {},
    { withCredentials: true }
  ).then(res => {
    const { token, ...userFields } = res.data
    if (token) localStorage.setItem('token', token)
    // user bilgileri de güncellenir (rol değişmiş olabilir)
    if (userFields.userId) {
      localStorage.setItem('user', JSON.stringify({
        id: userFields.userId,
        email: userFields.email,
        fullName: userFields.fullName,
        role: userFields.role,
      }))
    }
    return token
  }).finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

/* ─────────── REQUEST interceptor ─────────── */
// Login/register/refresh'te token gönderme
const NO_TOKEN_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh']

api.interceptors.request.use(async (config) => {
  const url = config.url || ''
  const skipToken = NO_TOKEN_PATHS.some(p => url.includes(p))
  if (skipToken) return config

  let token = localStorage.getItem('token')

  // Proactive refresh: token süresi dolmak üzereyse önceden yenile
  if (token && isTokenExpired(token)) {
    try {
      token = await performRefresh()
    } catch {
      clearSessionAndRedirect()
      return Promise.reject(new axios.Cancel('Oturum süresi doldu'))
    }
  }

  if (token) config.headers.Authorization = `Bearer ${token}`

  // FAZ 12 — Backend i18n: kullanicinin secili dilini (i18next localStorage 'lang')
  // Accept-Language olarak gonder. Backend hata mesajlari bu dile gore doner.
  try {
    const lang = localStorage.getItem('lang')
    if (lang) config.headers['Accept-Language'] = lang
  } catch { /* localStorage yoksa sessiz */ }

  return config
})

/* ─────────── RESPONSE interceptor — 401 → reactive refresh ─────────── */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config

    // 401 — token reddedildi → bir kez refresh dene
    if (error.response?.status === 401 && original && !original._retry) {
      // Login/register/refresh'in kendisi 401 ise refresh denemeyiz
      const isAuthEndpoint = NO_TOKEN_PATHS.some(p => (original.url || '').includes(p))
      if (isAuthEndpoint) {
        clearSessionAndRedirect()
        return Promise.reject(error)
      }

      original._retry = true
      try {
        const newToken = await performRefresh()
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)   // request'i tekrar dene
      } catch {
        clearSessionAndRedirect()
        return Promise.reject(error)
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
  if (data.fields) return Object.values(data.fields).join(', ')
  return data.message || 'Bir hata oluştu'
}

export default api
