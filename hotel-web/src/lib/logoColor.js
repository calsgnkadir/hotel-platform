/**
 * İşletme logo yedeği (gerçek logo yoksa baş harf kutusu) zemin rengi.
 *
 * Karar (Paket: kırık akışlar + logo kutusu): tüm logo yedekleri TEK renk —
 * marka grafiti (--ah-brand, #1f2937). Eskiden isimden türetilen 6 soluk gri
 * ton vardı; tonlar birbirine çok yakın olduğu için ayırt edicilik sağlamıyor,
 * yan yana kartlarda "rastgele/soluk" bir görüntü veriyordu. Tek grafit kutu
 * kurumsal ve tutarlı okunur; işletmeyi baş harf + ad zaten ayırt eder.
 *
 * Beyaz harf ile kontrast ~14.7:1 (WCAG AA ≥ 4.5:1).
 */

/** Marka grafiti — tokens.css'teki --ah-brand ile aynı değer (kontrast testi için). */
export const LOGO_FALLBACK_HEX = '#1f2937'

/** Bileşenlerde kullanılacak değer: CSS değişkeni (inline hex yok). */
export const LOGO_FALLBACK_BG = 'var(--ah-brand)'

/**
 * Geriye uyum: eski çağrılar isim veriyordu; artık her isim aynı zemini alır.
 * @returns {string} CSS renk değeri
 */
export function logoColor() {
  return LOGO_FALLBACK_BG
}
