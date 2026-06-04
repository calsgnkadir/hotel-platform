/**
 * Yeniden kullanılabilir form validation yardımcıları.
 * Backend ile aynı kuralları uygular (TurkeyPhone, AdultAge).
 */

// ────────────────────────────────────────────────
// TELEFON
// ────────────────────────────────────────────────

/** Sadece rakamları al + 90/0 prefix'leri normalize et. 10 hane döner ya da kısa. */
export function normalizeTurkeyPhone(raw) {
  if (!raw) return ''
  let digits = String(raw).replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0'))  digits = digits.slice(1)
  return digits
}

/**
 * Türkiye telefon doğrulaması. Boş geçerli (opsiyonel alan).
 * @param {string} raw - Kullanıcının yazdığı ham değer
 * @param {{ mobileOnly?: boolean }} opts
 * @returns {string|null} - Geçersizse hata mesajı, geçerliyse null
 */
export function validateTurkeyPhone(raw, opts = {}) {
  if (!raw || !String(raw).trim()) return null  // boş → geçerli
  const digits = normalizeTurkeyPhone(raw)
  if (digits.length !== 10) {
    return 'Geçerli bir telefon numarası girin (örn: 0555 123 45 67)'
  }
  const first = digits[0]
  if (first < '1' || first > '9') {
    return 'Telefon numarası geçersiz'
  }
  if (opts.mobileOnly && first !== '5') {
    return 'Cep telefonu numarası 5 ile başlamalı (örn: 0555 123 45 67)'
  }
  return null
}

/** Kullanıcı yazarken numarayı `0XXX XXX XX XX` formatında göster. */
export function formatTurkeyPhoneInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11)  // 0 + 10 hane max
  // Normalize: kullanıcı 5 ile başladıysa başına 0 ekleyelim görsel olarak
  let d = digits
  if (d.length === 10 && d[0] !== '0') d = '0' + d
  // 0XXX XXX XX XX maskele
  const parts = []
  if (d.length > 0) parts.push(d.slice(0, 4))
  if (d.length > 4) parts.push(d.slice(4, 7))
  if (d.length > 7) parts.push(d.slice(7, 9))
  if (d.length > 9) parts.push(d.slice(9, 11))
  return parts.join(' ')
}

// ────────────────────────────────────────────────
// YAŞ (doğum tarihi)
// ────────────────────────────────────────────────

const MIN_AGE = 16
const MAX_AGE = 65

/**
 * Doğum tarihinden yaş hesapla.
 * @param {string|Date} birthDate
 * @returns {number|null} - Geçersizse null
 */
export function calculateAge(birthDate) {
  if (!birthDate) return null
  const d = birthDate instanceof Date ? birthDate : new Date(birthDate)
  if (isNaN(d)) return null
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

/**
 * Yaş 16-65 aralığında mı? Boş geçerli.
 * @returns {string|null} - Hata mesajı veya null
 */
export function validateAdultAge(birthDate, opts = {}) {
  if (!birthDate) return null
  const min = opts.min ?? MIN_AGE
  const max = opts.max ?? MAX_AGE
  const age = calculateAge(birthDate)
  if (age === null) return 'Geçerli bir doğum tarihi girin'
  if (age < min) return `Yaşınız en az ${min} olmalı`
  if (age > max) return `Yaşınız ${max}'i geçemez`
  return null
}

/** input[type=date] için yaş aralığını YYYY-MM-DD min/max attribute olarak ver. */
export function birthDateBounds(opts = {}) {
  const min = opts.min ?? MIN_AGE
  const max = opts.max ?? MAX_AGE
  const today = new Date()
  const maxDate = new Date(today.getFullYear() - min, today.getMonth(), today.getDate())
  const minDate = new Date(today.getFullYear() - max, today.getMonth(), today.getDate())
  return {
    max: maxDate.toISOString().split('T')[0],  // en geç (max yaş - min yıl)
    min: minDate.toISOString().split('T')[0],  // en erken (max yıl önce)
  }
}
