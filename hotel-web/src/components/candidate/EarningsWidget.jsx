// FAZ 5.2 — Aday saat/kazanc widget'i — redesign (glass + count-up + dekoratif)
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import EarningsLedgerModal from './EarningsLedgerModal'  // FAZ 13

export default function EarningsWidget({ applications }) {
  const [ledgerOpen, setLedgerOpen] = useState(false)  // FAZ 13
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
      if (type === 'HOURLY')      earned = hours * avg
      else if (type === 'DAILY')  earned = avg
      else if (type === 'MONTHLY') earned = (avg / 22 / 8) * hours

      totalE += earned
      if (inMonth) monthE += earned
      if (inYear)  yearE  += earned
    })
  })

  return (
    <div className="relative overflow-hidden rounded-2xl"
         style={{
           background: 'linear-gradient(135deg, rgba(27, 24, 21, 0.78) 0%, rgba(74, 63, 51, 0.50) 100%)',
           border: '1px solid rgba(205, 183, 143, 0.10)',
           boxShadow: '0 10px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
         }}>
      {/* Köşede yüzen altın daire — saat ikonlu medallion */}
      <div aria-hidden className="absolute -top-10 -right-10 w-48 h-48 rounded-full pointer-events-none opacity-40"
           style={{ background: 'radial-gradient(circle, rgba(205, 183, 143, 0.22) 0%, transparent 60%)', filter: 'blur(24px)' }} />

      {/* HEADER */}
      <div className="relative px-5 py-3.5 flex items-center justify-between"
           style={{ borderBottom: '1px solid rgba(205, 183, 143, 0.08)' }}>
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
            Çalışma <em className="not-italic font-semibold" style={{
              background: 'linear-gradient(135deg, #cdb78f 0%, #d4a853 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>& kazanç</em>
          </h2>
          <p className="text-[11px] mt-0.5" style={{ color: '#928678' }}>
            Tamamlanmış vardiyalardan hesaplanır
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* FAZ 13 — Kazanç defteri (vardiya bazlı gerçek/planlı brüt) */}
          <button onClick={() => setLedgerOpen(true)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all hover:-translate-y-0.5 inline-flex items-center gap-1"
            style={{ background: 'rgba(205, 183, 143, 0.10)', border: '1px solid rgba(205, 183, 143, 0.30)', color: '#cdb78f' }}
            title="Vardiya bazlı kazanç defteri">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Defter
          </button>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: 'rgba(205, 183, 143, 0.08)',
                  border: '1px solid rgba(205, 183, 143, 0.18)',
                  color: '#cdb78f',
                }}>
            {completed.length} iş
          </span>
        </div>
      </div>

      {/* 3 METRIC — vertical decorative dividers */}
      <div className="relative grid grid-cols-3">
        <Metric label="Bu ay" hours={monthH} earned={monthE} accent />
        <Divider />
        <Metric label="Bu yıl" hours={yearH} earned={yearE} />
        <Divider />
        <Metric label="Tüm zaman" hours={totalH} earned={totalE} />
      </div>

      {totalE === 0 && totalH > 0 && (
        <div className="relative mx-5 mb-4 mt-1 px-3 py-2 rounded-lg flex items-start gap-2 text-[11.5px]"
             style={{
               background: 'rgba(205, 183, 143, 0.05)',
               border: '1px solid rgba(205, 183, 143, 0.10)',
               color: '#c9bdaa',
             }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={1.7} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
          </svg>
          <span>Kazanç tutarı yalnızca ücret tipi belirtilmiş ilanlarda hesaplanır.</span>
        </div>
      )}

      {/* FAZ 13 — Kazanç defteri modal */}
      {ledgerOpen && <EarningsLedgerModal onClose={() => setLedgerOpen(false)} />}
    </div>
  )
}

/* Metric column */
function Metric({ label, hours, earned, accent }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10.5px] uppercase tracking-[0.2em] font-semibold mb-1.5"
           style={{ color: accent ? '#cdb78f' : '#c9bdaa' }}>
        {label}
      </div>
      <CountUpValue value={hours < 1 ? 0 : Math.round(hours)} suffix="sa" accent={accent} />
      <div className="text-[12px] font-medium mt-1.5 tabular-nums"
           style={{ color: '#c9bdaa' }}>
        {earned < 1 ? '0' : Math.round(earned).toLocaleString('tr-TR')} ₺
      </div>
    </div>
  )
}

function CountUpValue({ value, suffix, accent }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf, start = performance.now(), duration = 900
    function step(t) {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <div className="text-[28px] font-semibold leading-none tabular-nums"
         style={{
           background: accent
             ? 'linear-gradient(135deg, #cdb78f 0%, #d4a853 100%)'
             : 'linear-gradient(135deg, #ffffff, #cdb78f)',
           WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
           letterSpacing: '-0.03em',
         }}>
      {n} <span className="text-[15px] font-medium" style={{
        background: 'none', WebkitBackgroundClip: 'unset', WebkitTextFillColor: accent ? '#d4a853' : '#cdb78f',
      }}>{suffix}</span>
    </div>
  )
}

/* Decorative vertical divider between metrics — animated gradient line */
function Divider() {
  return (
    <div aria-hidden className="absolute top-4 bottom-4 w-px hidden sm:block"
         style={{
           background: 'linear-gradient(180deg, transparent, rgba(205, 183, 143, 0.22), transparent)',
         }} />
  )
}
