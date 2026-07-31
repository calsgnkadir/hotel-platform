// FAZ 2/#25 — Ucret seffafligi yardimcilari.
// Tum frontend tek formatdan okumali; sektorde "X TL" belirsizdir,
// "X TL / saat" net olur.

export const SALARY_TYPE_OPTIONS = [
  { value: 'HOURLY',     label: 'Saatlik',   short: 'saat' },
  { value: 'DAILY',      label: 'Günlük',    short: 'gün'  },
  { value: 'MONTHLY',    label: 'Aylık',     short: 'ay'   },
  { value: 'NEGOTIABLE', label: 'Görüşülecek', short: ''   },
]

/*
 * Bilinmeyen/eksik salaryType'ta ARTIK "Aylık"/"ay" VARSAYILMIYOR.
 *
 * Eskiden ikisi de aylığa düşüyordu. DemoSeeder salaryType yazmayı atlayınca
 * alan null kaldı ve günlük vardiya ilanları kartlarda "800 – 1.200 ₺ / ay"
 * diye göründü — birim uydurulmuş, üstelik ilanın kendi etiketi "Günlük"
 * diyordu. Bilmediğimiz birimi yazmaktansa hiç yazmamak doğru: tutar yine
 * görünür, yanlış bir iddia eklenmez.
 */
export function salaryTypeLabel(code) {
  const opt = SALARY_TYPE_OPTIONS.find(o => o.value === code)
  return opt ? opt.label : null
}

export function salaryTypeShort(code) {
  const opt = SALARY_TYPE_OPTIONS.find(o => o.value === code)
  return opt ? opt.short : ''
}

/**
 * "12.000 - 15.000 ₺ / ay"  veya  "150 ₺ / saat"  veya  "Görüşülecek"
 */
export function formatSalary(min, max, salaryType, tipsIncluded) {
  if (salaryType === 'NEGOTIABLE') return 'Görüşülecek'
  if (!min && !max)                return salaryType ? salaryTypeLabel(salaryType) : null

  const fmt = (n) => Number(n).toLocaleString('tr-TR')
  const range = (min && max)
    ? `${fmt(min)} – ${fmt(max)} ₺`
    : `${fmt(min || max)} ₺`

  const suffix = salaryTypeShort(salaryType)
  const base = suffix ? `${range} / ${suffix}` : range
  return tipsIncluded ? `${base} + bahşiş` : base
}
