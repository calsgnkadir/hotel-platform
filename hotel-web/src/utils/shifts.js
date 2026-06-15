// FAZ 5.2 — CandidateDashboard'dan ayrildi (god class temizligi)

/** Bir vardiyanin saat suresi (gece vardiyasi day-rollover destekli). */
export function shiftHours(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60  // gece vardiyasi (22:00 → 08:00)
  return mins / 60
}

/** Bir basvurudaki tum slotlarin toplam saat suresi. */
export function totalHoursForApplication(app) {
  return (app.requestedSlots || []).reduce(
    (sum, s) => sum + shiftHours(s.startTime, s.endTime),
    0
  )
}
