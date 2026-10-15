/**
 * Vardiya saati bandı — ilan listesindeki "Vardiya saati" filtresi için.
 *
 * Neden istemci tarafı: ilanın `shift` alanı yeni ilanlarda boş gelir (vardiyalar
 * slot olarak tutulur). Backend `shifts` parametresi bu boş alana göre süzdüğü
 * için yeni ilanların hepsini dışarıda bırakırdı. Bu yüzden band, slotun YEREL
 * başlangıç saatinden türetilir ve API'ye gönderilmez.
 *
 * Bandlar (başlangıç saatine göre):
 *   MORNING  Sabah       05:00–11:59
 *   EVENING  Öğle-akşam  12:00–17:59
 *   NIGHT    Gece        18:00–04:59
 * Ek kural: gece yarısını geçen vardiya (22:00–06:00, 17:00–01:00) başlangıcı ne
 * olursa olsun "Gece" bandına da girer (shiftTime.isOvernight ile).
 *
 * Id'ler backend Shift enum adlarıyla aynıdır; eski kayıtlı aramalardaki
 * `shifts` değerleri doğrudan bu filtreye uygulanabilsin diye.
 */
import { timeToMinutes, isOvernight, isShiftStarted } from './shiftTime'

export const SHIFT_BANDS = [
  { id: 'MORNING', label: 'Sabah', hint: '05–12' },
  { id: 'EVENING', label: 'Öğle-akşam', hint: '12–18' },
  { id: 'NIGHT', label: 'Gece', hint: '18–05' },
]

export const SHIFT_BAND_LABELS = Object.fromEntries(SHIFT_BANDS.map(b => [b.id, b.label]))

/** Slotun bandları (Set). Saat bozuksa boş küme. */
export function slotBands(slot) {
  const out = new Set()
  const m = timeToMinutes(slot?.startTime)
  if (m == null) return out
  if (m >= 5 * 60 && m < 12 * 60) out.add('MORNING')
  else if (m >= 12 * 60 && m < 18 * 60) out.add('EVENING')
  else out.add('NIGHT')
  if (slot.endTime && isOvernight(slot.startTime, slot.endTime)) out.add('NIGHT')
  return out
}

/**
 * İlan seçili bandlardan birine uyuyor mu?
 *  - Seçim yoksa her ilan uyar.
 *  - Başlamamış vardiyalardan en az biri seçili bandda ise uyar.
 *  - Hiç slotu olmayan eski ilanlarda ilan düzeyindeki `shift` alanına bakılır.
 */
export function listingMatchesBands(listing, bands, now = new Date()) {
  if (!bands || bands.length === 0) return true
  const wanted = new Set(bands)
  const slots = Array.isArray(listing?.shiftSlots) ? listing.shiftSlots : []
  if (slots.length === 0) return !!listing?.shift && wanted.has(listing.shift)
  return slots.some(s => {
    if (isShiftStarted(s, now)) return false
    for (const b of slotBands(s)) if (wanted.has(b)) return true
    return false
  })
}
