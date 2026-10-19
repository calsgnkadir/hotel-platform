/**
 * Yasal metin sürümleri ve kayıt onayı — TEK KAYNAK.
 *
 * PRIVACY_NOTICE_VERSION hem KVKK sayfasında görünen sürümdür hem de kayıt /
 * Google kod değişimi isteğinde backend'e gönderilen değerdir. Metin değişince
 * yalnız burası güncellenir; backend aynı sürümü kayıt anında saklar.
 */
export const PRIVACY_NOTICE_VERSION = '2026-10-17'

/** KVKK sayfasında okunur tarih (sürümle aynı gün). */
export const PRIVACY_NOTICE_DATE_LABEL = '17 Ekim 2026'

export const TERMS_PATH = '/terms'
export const KVKK_PATH = '/kvkk'

/** Kayıt ve Google kod değişimi gövdesine eklenen onay alanları. */
export function consentPayload() {
  return { termsAccepted: true, privacyNoticeVersion: PRIVACY_NOTICE_VERSION }
}

/* ── Google dönüşü için onay hafızası ──────────────────────────────────────
 * Kullanıcı Kullanım Şartları kutusunu işaretleyip Google'a gider; dönüşte
 * (/oauth-success) bu bilgi exchange isteğine eklenir ve hemen silinir.
 * Yalnız sessionStorage: sekme kapanınca kaybolur, başka cihaza taşınmaz.
 * 30 dakikadan eski kayıt geçersiz sayılır (unutulmuş sekme). */
const OAUTH_CONSENT_KEY = 'kadrom.oauth.consent'
const OAUTH_CONSENT_TTL_MS = 30 * 60 * 1000

export function rememberOAuthConsent() {
  try {
    sessionStorage.setItem(OAUTH_CONSENT_KEY, JSON.stringify({
      ...consentPayload(), at: Date.now(),
    }))
  } catch { /* gizli mod vb. — backend CONSENT_REQUIRED ile tekrar sorar */ }
}

/** Kayıtlı onayı okur ve siler. Yoksa / süresi geçmişse null. */
export function takeOAuthConsent() {
  let raw = null
  try {
    raw = sessionStorage.getItem(OAUTH_CONSENT_KEY)
    sessionStorage.removeItem(OAUTH_CONSENT_KEY)
  } catch { return null }
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    if (!v?.termsAccepted || Date.now() - Number(v.at || 0) > OAUTH_CONSENT_TTL_MS) return null
    return consentPayload()
  } catch {
    return null
  }
}
