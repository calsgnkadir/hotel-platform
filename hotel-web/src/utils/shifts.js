// FAZ 5.2 — CandidateDashboard'dan ayrildi (god class temizligi)
import { shiftHours } from '../lib/shiftTime'

/** Bir vardiyanin saat suresi — gece vardiyasi dahil ortak yardimcidan. */
export { shiftHours }

/** Bir basvurudaki tum slotlarin toplam saat suresi. */
export function totalHoursForApplication(app) {
  return (app.requestedSlots || []).reduce(
    (sum, s) => sum + shiftHours(s.startTime, s.endTime),
    0
  )
}
