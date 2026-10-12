/**
 * Vardiya zaman yardimcilari (gece vardiyasi destekli).
 *
 * Sozlesme (backend ile ortak):
 *  - Slot: { date: 'YYYY-MM-DD' (vardiyanin BASLADIGI gun), startTime, endTime }
 *  - endTime <= startTime -> vardiya ertesi gun biter (22:00–06:00).
 *  - endTime == startTime -> yeni kayitta gecersiz (backend 422); eski kayitta
 *    backend ile ayni yorum: 24 saatlik gece vardiyasi (ShiftWindow.endAt).
 *  - Is vardiyasi suresi en fazla 16 saat. Musaitlik blogu vardiya degildir:
 *    24 saate kadar (yalniz esit saat gecersiz).
 *
 * Saf fonksiyonlar; DOM/React bagimliligi yok. "Bugun" daima YEREL tarihle
 * hesaplanir (UTC toISOString() gece yarisi civarinda bir gun kaydirir).
 */

export const MAX_SHIFT_HOURS = 16
/** Musaitlik blogu ust siniri (vardiya degil; esit saat zaten gecersiz). */
export const MAX_AVAILABILITY_HOURS = 24
const DAY_MIN = 24 * 60

/** "HH:mm" | "HH:mm:ss" -> gun icindeki dakika; bozuksa null. */
export function timeToMinutes(t) {
  if (t == null || t === '') return null
  const [h, m] = String(t).split(':')
  const hh = Number(h), mm = Number(m)
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return null
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

/** "HH:mm:ss" -> "HH:mm" (gosterim icin). */
export function hhmm(t) {
  return t ? String(t).slice(0, 5) : ''
}

/**
 * Vardiya suresi (dakika). Bitis baslangictan once/esitse ertesi gun kabul edilir
 * (esit saat = 24 saat; backend ShiftWindow ile ayni). Bozuk veri -> null.
 */
export function shiftMinutes(startTime, endTime) {
  const a = timeToMinutes(startTime), b = timeToMinutes(endTime)
  if (a == null || b == null) return null
  const mins = b - a
  return mins <= 0 ? mins + DAY_MIN : mins
}

/** Vardiya suresi (saat, ondalikli). Hesaplanamazsa 0 — toplamlarda guvenli. */
export function shiftHours(startTime, endTime) {
  const m = shiftMinutes(startTime, endTime)
  return m == null ? 0 : m / 60
}

/** Vardiya ertesi gune tasiyor mu? (22:00–06:00 -> true; esit saat -> true, backend ile ayni) */
export function isOvernight(startTime, endTime) {
  const a = timeToMinutes(startTime), b = timeToMinutes(endTime)
  return a != null && b != null && b <= a
}

/**
 * Vardiya suresini insan-okunur metne cevirir: "4 saat" | "7,5 saat" | "45 dk".
 * Hesaplanamazsa null (kartta hic gosterilmez).
 */
export function shiftDuration(startTime, endTime) {
  const mins = shiftMinutes(startTime, endTime)
  if (mins == null) return null
  if (mins < 60) return `${mins} dk`
  const hours = Math.round(mins / 6) / 10           // bir ondalik; 23:59 -> 24 (",0" yok)
  return Number.isInteger(hours)
    ? `${hours} saat`
    : `${String(hours).replace('.', ',')} saat`      // TR ondalik: 7,5 saat
}

/**
 * Saat araligi etiketi.
 *   formatShiftRange('22:00:00', '06:00:00')                 -> "22:00–06:00 (ertesi gün)"
 *   formatShiftRange('22:00:00', '06:00:00', { short: true }) -> "22:00–06:00 +1"
 *   formatShiftRange('09:00:00', '17:00:00')                 -> "09:00–17:00"
 * Bitis yoksa yalniz baslangic doner.
 */
export function formatShiftRange(startTime, endTime, { short = false } = {}) {
  const s = hhmm(startTime), e = hhmm(endTime)
  if (!s && !e) return ''
  if (!e) return s
  if (!s) return e
  const base = `${s}–${e}`
  if (!isOvernight(startTime, endTime)) return base
  return short ? `${base} +1` : `${base} (ertesi gün)`
}

/**
 * Backend'in hazir bicimledigi "HH:mm – HH:mm" metnine gece eki ekler
 * (giris karti, yoklama satiri). Desen eslesmezse metin aynen doner.
 */
export function annotateShiftText(text, { short = false } = {}) {
  if (!text) return text || ''
  const m = String(text).match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/)
  if (!m || !isOvernight(m[1], m[2])) return text
  return short ? `${text} +1` : `${text} (ertesi gün)`
}

/* ── Tarih yardimcilari (yerel) ───────────────────────────────── */

const pad = (n) => String(n).padStart(2, '0')

/** Yerel takvime gore 'YYYY-MM-DD'. */
export function localDateISO(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD' + n gun (yerel). */
export function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localDateISO(d)
}

/** Vardiyanin baslangic ani (yerel Date). Tarih yoksa null; saat yoksa gun basi. */
export function shiftStartDate(slot) {
  if (!slot?.date) return null
  const d = new Date(`${slot.date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const m = timeToMinutes(slot.startTime)
  if (m != null) d.setHours(Math.floor(m / 60), m % 60, 0, 0)
  return d
}

/**
 * Vardiyanin bitis ani. Gece vardiyasinda ertesi gun.
 * Saat bilgisi eksikse baslangic gununun sonu (23:59:59.999) kabul edilir.
 */
export function shiftEndDate(slot) {
  if (!slot?.date) return null
  const d = new Date(`${slot.date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const mins = shiftMinutes(slot.startTime, slot.endTime)
  const start = timeToMinutes(slot.startTime)
  if (mins == null || start == null) {
    d.setHours(23, 59, 59, 999)
    return d
  }
  return new Date(d.getTime() + (start + mins) * 60000)
}

/** Vardiya basladi mi? (baslangic <= simdi) — basvuru kapanisi icin. */
export function isShiftStarted(slot, now = new Date()) {
  const s = shiftStartDate(slot)
  return !!s && s.getTime() <= now.getTime()
}

/** Su an vardiyada mi? (baslangic <= simdi < bitis) */
export function isShiftOngoing(slot, now = new Date()) {
  const s = shiftStartDate(slot), e = shiftEndDate(slot)
  if (!s || !e) return false
  const t = now.getTime()
  return s.getTime() <= t && t < e.getTime()
}

/** Vardiya tamamen bitti mi? (bitis <= simdi). Gece vardiyasi ertesi sabaha kadar surer. */
export function isShiftPast(slot, now = new Date()) {
  const e = shiftEndDate(slot)
  return !!e && e.getTime() <= now.getTime()
}

/** Gelmedi isareti icin vardiya baslangicindan sonra beklenen sure (backend NO_SHOW_GRACE). */
export const NO_SHOW_GRACE_MINUTES = 30

/**
 * Vardiya icin "Gelmedi" isareti verilebilir mi? (baslangic + 30 dk <= simdi)
 * Yardimcidir; giris kaydi vb. asil kontrol backend'de.
 */
export function isNoShowAllowed(slot, now = new Date()) {
  const s = shiftStartDate(slot)
  if (!s || timeToMinutes(slot.startTime) == null) return false
  return s.getTime() + NO_SHOW_GRACE_MINUTES * 60000 <= now.getTime()
}

/** Tarih + baslangic saatine gore siralama karsilastiricisi. */
export function compareSlots(a, b) {
  const c = (a?.date || '').localeCompare(b?.date || '')
  return c !== 0 ? c : (a?.startTime || '').localeCompare(b?.startTime || '')
}

/**
 * En yakin vardiya.
 *  mode 'upcoming' (varsayilan): henuz baslamamis ilk vardiya (basvuru icin).
 *  mode 'active'  : bitmemis ilk vardiya (devam eden dahil; isletme/calisan icin).
 *  filter         : ek kosul (orn. dolu olmayanlar).
 */
export function nearestShift(slots, { now = new Date(), mode = 'upcoming', filter } = {}) {
  if (!Array.isArray(slots) || slots.length === 0) return null
  const ok = mode === 'active'
    ? (s) => !isShiftPast(s, now)
    : (s) => !isShiftStarted(s, now)
  return [...slots]
    .filter(s => s?.date && ok(s) && (!filter || filter(s)))
    .sort(compareSlots)[0] || null
}

/** 'Bugün' | 'Yarın' | null — yerel takvime gore. */
export function relativeDayLabel(dateISO, now = new Date()) {
  if (!dateISO) return null
  const today = localDateISO(now)
  if (dateISO === today) return 'Bugün'
  if (dateISO === addDaysISO(today, 1)) return 'Yarın'
  return null
}

/**
 * Saat araligi dogrulamasi (yardimci; asil kural backend'de).
 * Gecerliyse null, degilse Turkce mesaj.
 *  maxHours: sure ust siniri; varsayilan is vardiyasi siniri (16). Musaitlik
 *            bloklari MAX_AVAILABILITY_HOURS (24) verir.
 */
export function validateShiftTimes(startTime, endTime, { subject = 'Vardiya', maxHours = MAX_SHIFT_HOURS } = {}) {
  const a = timeToMinutes(startTime), b = timeToMinutes(endTime)
  if (a == null || b == null) return null          // bos alanlari "zorunlu" kontrolu yakalar
  if (a === b) return 'Başlangıç ve bitiş saati aynı olamaz'
  const mins = shiftMinutes(startTime, endTime)
  if (mins > maxHours * 60) return `${subject} en fazla ${maxHours} saat olabilir`
  return null
}

/* ── Vardiya bazli "Gelmedi" (noShowSlotIds) ─────────────────── */

/** Basvurunun gelmedi isaretli slot id'leri (String Set). */
export function noShowSlotIdSet(app) {
  return new Set((app?.noShowSlotIds || []).map(String))
}

/**
 * Kadroda sayilan vardiyalar: requestedSlots eksi gelmedi isaretliler.
 * Gelmeyen aday o vardiyanin kadro listelerinden duser (yoklama ve basvuru
 * detayi haric — onlar requestedSlots'u dogrudan kullanir).
 */
export function rosterSlots(app) {
  const ids = noShowSlotIdSet(app)
  const slots = app?.requestedSlots || []
  if (ids.size === 0) return slots
  return slots.filter(s => s?.id == null || !ids.has(String(s.id)))
}

/**
 * Basvuru duzeyindeki gelmedi rozet metni; isaret yoksa null.
 *  - Tum vardiyalar (veya vardiya bilgisi yok) -> "İşe gelmedi"
 *  - Bir kismi -> "N vardiya gelmedi"
 */
export function noShowSummaryLabel(app, fullLabel = 'İşe gelmedi') {
  const ids = noShowSlotIdSet(app)
  if (!app?.noShow && ids.size === 0) return null
  const slotIds = (app?.requestedSlots || []).filter(s => s?.id != null).map(s => String(s.id))
  const marked = slotIds.filter(id => ids.has(id)).length
  if (marked === 0 || marked >= slotIds.length) return fullLabel
  return `${marked} vardiya gelmedi`
}

/**
 * Tum vardiyalari gelmedi isaretli (ya da eski, vardiyasiz gelmedi kaydi) mi?
 * Boyle bir basvuru "kabul" sayilmaz (Kanban kabul kolonu, kabul sayilari).
 */
export function isFullyNoShow(app) {
  return noShowSummaryLabel(app, '__full__') === '__full__'
}

/**
 * Kisa slot etiketi: "Bugün 22:00–06:00 +1" | "12 Eki 09:00–17:00".
 * Tarih vardiyanin BASLADIGI gundur.
 */
export function formatSlotShort(slot, now = new Date()) {
  if (!slot) return ''
  const range = formatShiftRange(slot.startTime, slot.endTime, { short: true })
  if (!slot.date) return range
  const day = relativeDayLabel(slot.date, now)
    || new Date(`${slot.date}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  return range ? `${day} ${range}` : day
}
