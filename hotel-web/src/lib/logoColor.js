/**
 * FAZ B.5.3 — İşletme logo rengi (isimden deterministik).
 *
 * Aynı fonksiyon iki yerde birebir kopyalanmıştı (ListingsPage'de `logoColor`,
 * ApplicationsTab'de `appLogoColor`); tek kaynağa alındı.
 *
 * Palet notu: eski tonlar koyu temadan kalmaydı (#1f3a5f, #7a1f3d, #1f5f4a …)
 * ve açık teal zeminde çamurlu duruyordu. Yenisi canlı ve orta tonlu; renk
 * çemberine yayıldığı için işletmeler birbirinden ayrışıyor.
 *
 * Kısıtlar:
 *  - Hepsi beyaz metinle ≥4.5:1 kontrast (logo harfi 17px bold = WCAG'de
 *    normal metin, 3:1 yetmez). Ölçülen en düşük: zeytin #4d7c0f → 4.99:1
 *  - Marka teal'i (#0f766e) BİLEREK dışarıda: logo, marka butonları/rozetleriyle
 *    karışmasın.
 */
const LOGO_COLORS = [
  '#2563eb',  // mavi
  '#7c3aed',  // mor
  '#a21caf',  // fuşya
  '#be123c',  // gül kırmızısı
  '#c2410c',  // turuncu
  '#4d7c0f',  // zeytin yeşili
  '#15803d',  // yeşil
  '#0e7490',  // camgöbeği
]

/**
 * İsimden sabit bir renk üretir — aynı işletme her yerde aynı rengi alır.
 * @param {string|null|undefined} name İşletme adı
 * @returns {string} hex renk
 */
export function logoColor(name) {
  let h = 0
  const s = name || '?'
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return LOGO_COLORS[h % LOGO_COLORS.length]
}

export { LOGO_COLORS }
