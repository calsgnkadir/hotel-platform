/**
 * Sayı / süre biçimleri — TEK KAYNAK.
 *
 * Saat süresi Türkçe yazılır: tam sayıda ondalık yok, ondalık ayırıcı virgül.
 *   formatHours(5)    -> "5 saat"
 *   formatHours(5.5)  -> "5,5 saat"
 *   formatHours(6.25) -> "6,3 saat"
 *   formatHours(1234, { maxFraction: 0 }) -> "1.234 saat"
 * (Eskiden toFixed(1) kullanılıyordu: "5.0 saat", "5.5 saat".)
 */
const NF_CACHE = new Map()
function numberFormat(maxFraction) {
  let nf = NF_CACHE.get(maxFraction)
  if (!nf) {
    nf = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: maxFraction })
    NF_CACHE.set(maxFraction, nf)
  }
  return nf
}

/** Yalnız sayı kısmı: "5" | "5,5". Geçersiz değer 0 sayılır. */
export function formatHoursNumber(hours, { maxFraction = 1 } = {}) {
  const n = Number(hours)
  return numberFormat(maxFraction).format(Number.isFinite(n) ? n : 0)
}

/** "5 saat" | "5,5 saat" */
export function formatHours(hours, opts) {
  return `${formatHoursNumber(hours, opts)} saat`
}
