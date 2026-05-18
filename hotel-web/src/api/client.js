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

// REQUEST interceptor — her istekte token ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
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
