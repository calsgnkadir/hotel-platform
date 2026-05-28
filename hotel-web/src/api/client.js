import axios from 'axios'

/**
 * Merkezi Axios instance — tüm isteklerde kullanılır.
 * - baseURL proxy sayesinde dev'de boş ('/api' gider, Vite 8080'e yönlendirir)
 * - Her istekte localStorage'daki JWT otomatik eklenir
 * - 401 dönerse kullanıcıyı login'e yönlendir
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
})

/** JWT payload'ından exp claim'ini okuyup süresi dolmuş mu kontrol eder */
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return false
    // exp saniye cinsinden — 10sn buffer ekle
    return payload.exp * 1000 < Date.now() + 10000
  } catch {
    return true  // parse edilemiyorsa bozuk = süresi dolmuş say
  }
}

function clearSessionAndRedirect() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login'
  }
}

// REQUEST interceptor — her istekte token ekle
// Sadece login/register'da token gönderme (stale token backend'e
// rastgele 403 attırabilir). change-password gibi auth gerektiren
// endpoint'lerde token ŞART.
const NO_TOKEN_PATHS = ['/api/auth/login', '/api/auth/register']
api.interceptors.request.use((config) => {
  const url = config.url || ''
  const skipToken = NO_TOKEN_PATHS.some(p => url.includes(p))
  if (!skipToken) {
    const token = localStorage.getItem('token')
    if (token) {
      // Süresi dolmuş token'ı gönderme — temizle, login'e at
      if (isTokenExpired(token)) {
        clearSessionAndRedirect()
        return Promise.reject(new axios.Cancel('Oturum süresi doldu'))
      }
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// RESPONSE interceptor — 401 / 429 özel davranış
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token geçersiz → oturumu temizle, login'e at
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      // Sadece login'de değilsek yönlendir
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
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

  // Validation hataları
  if (data.fields) {
    return Object.values(data.fields).join(', ')
  }
  return data.message || 'Bir hata oluştu'
}

export default api
