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

/** History uses the same ledger as earnings; an absent response is never actual work. */
export function historyHoursForApplication(app, entries) {
  const slots = app.requestedSlots || []
  const matched = new Set()
  let recordedHours = 0, recordedCount = 0, plannedHours = 0, incompleteCount = 0
  for (const entry of entries || []) {
    if (String(entry.applicationId) !== String(app.id)) continue
    const slot = slots.find(s => entry.shiftSlotId != null && String(s.id) === String(entry.shiftSlotId))
    if (!slot || matched.has(String(slot.id))) continue
    matched.add(String(slot.id))
    const hours = entry.durationMinutes != null ? Number(entry.durationMinutes) / 60 : Number(entry.hours)
    if (entry.hoursSource === 'INCOMPLETE' || !Number.isFinite(hours) || hours < 0) {
      incompleteCount++
    } else if (entry.hoursSource === 'CLOCKED') { recordedHours += hours; recordedCount++ }
    else if (entry.hoursSource === 'PLANNED') plannedHours += hours
    else incompleteCount++
  }
  return { recordedHours, recordedCount, plannedHours, incompleteCount,
    missingCount: slots.length ? slots.length - matched.size : 1 }
}
