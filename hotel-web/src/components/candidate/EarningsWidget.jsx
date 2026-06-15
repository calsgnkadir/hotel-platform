// FAZ 5.2 — CandidateDashboard'dan ayrildi (FAZ 2/#31 Aday saat/kazanc widget'i)

/**
 * Tamamlanmis (workCompleted=true) basvurularin slot tarihlerinden
 * toplam saat hesapla; salaryType'a gore kazanc cikar.
 *  HOURLY:    hours * avg(min,max)
 *  DAILY:     slot basina avg salary (her slot=1 gun varsayim)
 *  MONTHLY:   (avg / 22 / 8) * hours
 *  NEGOTIABLE: 0 (tahmin edilemez)
 */
export default function EarningsWidget({ applications }) {
  const completed = applications.filter(a => a.workCompleted)
  if (completed.length === 0) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart  = new Date(now.getFullYear(), 0, 1)

  let totalH = 0, monthH = 0, yearH = 0
  let totalE = 0, monthE = 0, yearE = 0

  completed.forEach(app => {
    const slots = app.requestedSlots || []
    const min = Number(app.listing?.salaryMin) || 0
    const max = Number(app.listing?.salaryMax) || min
    const avg = min && max ? (min + max) / 2 : (min || max)
    const type = app.listing?.salaryType || 'HOURLY'

    slots.forEach(s => {
      if (!s.date || !s.startTime || !s.endTime) return
      const [sH, sM] = s.startTime.split(':').map(Number)
      const [eH, eM] = s.endTime.split(':').map(Number)
      const hours = (eH + eM / 60) - (sH + sM / 60)
      if (hours <= 0) return

      const d = new Date(s.date)
      const inMonth = d >= monthStart
      const inYear  = d >= yearStart

      totalH += hours
      if (inMonth) monthH += hours
      if (inYear)  yearH  += hours

      let earned = 0
      if (type === 'HOURLY')     earned = hours * avg
      else if (type === 'DAILY') earned = avg
      else if (type === 'MONTHLY') earned = (avg / 22 / 8) * hours

      totalE += earned
      if (inMonth) monthE += earned
      if (inYear)  yearE  += earned
    })
  })

  const fmtH = h => h < 1 ? '0' : Math.round(h).toString()
  const fmtE = e => e < 1 ? '0' : Math.round(e).toLocaleString('tr-TR')

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-cream-200 dark:border-ink-700 flex items-center justify-between">
        <h2 className="font-semibold text-ink-800 dark:text-ink-900">
          Çalışma & Kazanç
        </h2>
        <span className="text-xs text-ink-500">{completed.length} iş</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-cream-200 dark:bg-ink-700">
        <div className="p-3 bg-white dark:bg-ink-900">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-500 mb-1">Bu Ay</div>
          <div className="text-lg font-black text-brand-700 dark:text-brand-300">{fmtH(monthH)} sa</div>
          <div className="text-xs font-semibold text-ink-600 dark:text-ink-300 mt-0.5">{fmtE(monthE)} ₺</div>
        </div>
        <div className="p-3 bg-white dark:bg-ink-900">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-500 mb-1">Bu Yıl</div>
          <div className="text-lg font-black text-brand-700 dark:text-brand-300">{fmtH(yearH)} sa</div>
          <div className="text-xs font-semibold text-ink-600 dark:text-ink-300 mt-0.5">{fmtE(yearE)} ₺</div>
        </div>
        <div className="p-3 bg-white dark:bg-ink-900">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-500 mb-1">Tüm Zaman</div>
          <div className="text-lg font-black text-brand-700 dark:text-brand-300">{fmtH(totalH)} sa</div>
          <div className="text-xs font-semibold text-ink-600 dark:text-ink-300 mt-0.5">{fmtE(totalE)} ₺</div>
        </div>
      </div>
      {totalE === 0 && totalH > 0 && (
        <div className="px-5 py-2 text-[11px] text-ink-500 italic">
          Not: Kazanç tutarı yalnızca ücret tipi belirtilmiş ilanlarda hesaplanır.
        </div>
      )}
    </div>
  )
}
