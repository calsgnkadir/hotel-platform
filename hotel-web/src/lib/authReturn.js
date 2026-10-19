/**
 * Girişten / kayıttan sonra kullanıcıyı geldiği sayfaya döndürme — TEK KAYNAK.
 *
 * İki taşıma yolu:
 *  1. Router state: navigate('/login', { state: { from } }) — aynı sekme içi geçişler
 *     (ProtectedRoute, paylaşılan ilandan "Başvur", giriş <-> kayıt arası).
 *  2. sessionStorage: tam sayfa yenilemesi olan geçişler — oturum süresi dolunca
 *     (api/client.js) ve Google yönlendirmesi (gidip dönünce router state kaybolur).
 *
 * Güvenlik: yalnız kendi kökenimizdeki göreli yol kabul edilir ("/..." ama "//"
 * değil); auth sayfalarına geri dönüş yapılmaz (döngü olmasın).
 */

const RETURN_KEY = 'kadrom.auth.return'

const AUTH_PATHS = ['/login', '/register', '/oauth-success', '/forgot-password', '/reset-password']

/**
 * Oturum düşünce yönlendirme YAPILMAYAN, girişsiz de açılabilen sayfalar.
 * (/p/candidate girişi gerektirir — ProtectedRoute — bu yüzden listede yok.)
 */
const PUBLIC_EXACT = ['/', '/kvkk', '/terms', '/yardim', '/iletisim', '/verify-email', ...AUTH_PATHS]
const PUBLIC_PREFIX = ['/listings/', '/p/business/']

export function isPublicPath(pathname = '/') {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return PUBLIC_EXACT.includes(p) || PUBLIC_PREFIX.some(pre => p.startsWith(pre))
}

/** location benzeri nesne ya da metinden güvenli göreli yol; uygunsuzsa null. */
export function returnPathOf(from) {
  if (!from) return null
  const path = typeof from === 'string'
    ? from
    : `${from.pathname || ''}${from.search || ''}${from.hash || ''}`
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  const pathname = path.split(/[?#]/)[0]
  if (AUTH_PATHS.includes(pathname)) return null
  return path
}

/** Tam sayfa geçişinden önce dönüş yolunu (ve sebebini) saklar. */
export function rememberReturn(from, reason = null) {
  const path = returnPathOf(from)
  try {
    if (!path && !reason) { sessionStorage.removeItem(RETURN_KEY); return }
    sessionStorage.setItem(RETURN_KEY, JSON.stringify({ path, reason }))
  } catch { /* depolama yok — kullanıcı panele düşer, akış bozulmaz */ }
}

/** Saklanan dönüşü okur ve siler: { path, reason } ya da null. */
export function takeReturn() {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return { path: returnPathOf(v?.path), reason: v?.reason || null }
  } catch {
    return null
  }
}

/** Saklanan dönüşü silmeden okur (render sırasında güvenli; StrictMode çift render). */
export function peekReturn() {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return { path: returnPathOf(v?.path), reason: v?.reason || null }
  } catch {
    return null
  }
}

export function clearReturn() {
  try { sessionStorage.removeItem(RETURN_KEY) } catch { /* yok say */ }
}

/** Rol paneli — dönüş yolu yoksa varsayılan hedef. */
export function homeForRole(role) {
  if (role === 'CANDIDATE') return '/candidate'
  if (role === 'BUSINESS_OWNER') return '/business'
  if (role === 'ADMIN') return '/admin'
  return '/'
}
