/**
 * FAZ B.5.5 — Vardiya zaman yardimcilari.
 *
 * lib/distance.js ile ayni desen: saf fonksiyon, DOM/React bagimliligi yok,
 * izole test edilebilir.
 */

/**
 * Vardiya suresini insan-okunur metne cevirir.
 *
 * Aday icin kritik bir bilgi: 750₺'nin 4 saatlik mi 10 saatlik mi oldugu
 * karari degistirir (saatlik karsilik).
 *
 * Gece vardiyasi (orn. 22:00–08:00) gun asar; naif "bitis - baslangic"
 * negatif verir, bu yuzden +24 saat eklenir.
 *
 * @param {string|null} startTime "HH:mm" veya "HH:mm:ss"
 * @param {string|null} endTime   "HH:mm" veya "HH:mm:ss"
 * @returns {string|null} "4 saat" | "7,5 saat" | "45 dk" | null (hesaplanamaz)
 */
export function shiftDuration(startTime, endTime) {
  if (!startTime || !endTime) return null

  const toMin = (t) => {
    const [h, m] = String(t).split(':')
    const hh = Number(h), mm = Number(m)
    return Number.isFinite(hh) && Number.isFinite(mm) ? hh * 60 + mm : null
  }

  const a = toMin(startTime), b = toMin(endTime)
  if (a == null || b == null) return null

  let mins = b - a
  if (mins < 0) mins += 24 * 60      // gece vardiyasi: gun asimi
  if (mins <= 0) return null         // ayni saat -> anlamsiz, gosterme

  if (mins < 60) return `${mins} dk`

  const hours = mins / 60
  return Number.isInteger(hours)
    ? `${hours} saat`
    : `${hours.toFixed(1).replace('.', ',')} saat`   // TR ondalik: 7,5 saat
}
