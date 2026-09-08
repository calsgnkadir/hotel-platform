/**
 * İşletme logo rengi (isimden deterministik).
 *
 * Aynı fonksiyon iki yerde birebir kopyalanmıştı (ListingsPage'de `logoColor`,
 * ApplicationsTab'de `appLogoColor`); tek kaynağa alındı.
 *
 * Palet notu: arayüz "sadece gri ve siyah" kimliğine geçti — renkli paletler
 * (eski canlı çember, ondan önce koyu tema tonları) tamamen bırakıldı. Logo
 * zeminleri artık nötr gri tonlarında; işletmeler birbirinden ton farkıyla
 * (koyu → orta gri) ayrışıyor.
 *
 * Kısıtlar:
 *  - Hepsi beyaz metinle ≥4.5:1 kontrast (logo harfi 17px bold = WCAG'de
 *    normal metin, 3:1 yetmez). Ölçülen en düşük: #6a7178 → 4.95:1
 */
const LOGO_COLORS = [
  '#2b2f33',  // grafit
  '#3a3f44',  // koyu gri
  '#494f55',  // gri
  '#565c62',  // orta gri
  '#616870',  // açık-orta gri
  '#6a7178',  // açık gri (en açık — hâlâ ≥4.5:1)
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
