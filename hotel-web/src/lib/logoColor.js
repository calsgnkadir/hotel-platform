/**
 * İşletme logo yedeği (gerçek logo yoksa baş harf kutusu) renkleri.
 *
 * Karar (2026-10-21, kullanıcı): AÇIK varyant. Zemin marka yumuşak tonu
 * (--ah-brand-soft #eef0f2), harf koyu ink (--ah-ink #111827), çerçeve 1px
 * --ah-line-2. Önceki dolu grafit kutu (beyaz harf) ilan listesinde logosuz her
 * kartta koyu bir blok oluşturup gözü başlıktan çalıyordu; açık kutu gerçek
 * logolarla aynı görsel ağırlıkta durur, kurumsal ve sakin okunur.
 * Tüm logo yedekleri tek renk (isimden türetilen ton yok); işletmeyi baş harf
 * ve ad ayırt eder.
 *
 * Harf / zemin kontrastı ~15.5:1 (WCAG AA ≥ 4.5:1) — bkz. logoColor.test.js.
 */

/** tokens.css değerleri (kontrast testi için; bileşenlerde var() kullan). */
export const LOGO_FALLBACK_HEX = '#eef0f2'
export const LOGO_FALLBACK_INK_HEX = '#111827'

/** Bileşenlerde kullanılacak değerler: CSS değişkeni (inline hex yok). */
export const LOGO_FALLBACK_BG = 'var(--ah-brand-soft)'
export const LOGO_FALLBACK_FG = 'var(--ah-ink)'
export const LOGO_FALLBACK_BORDER = '1px solid var(--ah-line-2)'

/**
 * Geriye uyum: eski çağrılar isim veriyordu; artık her isim aynı zemini alır.
 * @returns {string} CSS renk değeri
 */
export function logoColor() {
  return LOGO_FALLBACK_BG
}
