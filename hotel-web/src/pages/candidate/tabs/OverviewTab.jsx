import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'
import EarningsWidget from '../../../components/candidate/EarningsWidget'

const STATUS_TINT = {
  PENDING:   { color: '#fbbf24', text: '#fde68a' },
  REVIEWING: { color: '#22d3ee', text: '#a5f3fc' },
  HELD:      { color: '#f97316', text: '#fed7aa' },
  ACCEPTED:  { color: '#22c55e', text: '#86efac' },
  REJECTED:  { color: '#ef4444', text: '#fca5a5' },
}
const STATUS_LABEL = {
  PENDING: 'Bekliyor', REVIEWING: 'İnceleniyor', HELD: 'Hold',
  ACCEPTED: 'Kabul', REJECTED: 'Red', WITHDRAWN: 'İptal', EXPIRED: 'Süresi Doldu',
}

export default function OverviewTab({ user, applications, onTabChange }) {
  const accepted = applications.filter(a => a.status === 'ACCEPTED').length
  const pending  = applications.filter(a => a.status === 'PENDING').length

  // Delta için son 7 gün vs önceki 7 gün
  const now = Date.now()
  const WEEK = 7 * 86400_000
  const lastWeek = applications.filter(a => now - new Date(a.createdAt).getTime() < WEEK).length
  const prevWeek = applications.filter(a => {
    const t = new Date(a.createdAt).getTime()
    return now - t >= WEEK && now - t < 2 * WEEK
  }).length
  const delta = lastWeek - prevWeek

  return (
    <motion.div
      className="relative space-y-4 font-geist"
      initial="hidden" animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}
    >
      {/* STAT KARTLARI */}
      <motion.div variants={ITEM} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Toplam Başvuru"
          value={applications.length}
          color="#60a5fa"
          delta={delta}
          data={weeklyTrend(applications, null)}
          delay={0}
        />
        <StatCard
          label="Bekleyen"
          value={pending}
          color="#fbbf24"
          data={weeklyTrend(applications, a => a.status === 'PENDING')}
          delay={0.1}
        />
        <StatCard
          label="Kabul"
          value={accepted}
          color="#d4a853"
          data={weeklyTrend(applications, a => a.status === 'ACCEPTED')}
          delay={0.2}
        />
      </motion.div>

      <motion.div variants={ITEM}>
        <EarningsWidget applications={applications} />
      </motion.div>

      {/* QUICK ACTIONS sokuldu — sidebar nav + mobile bottom tab bar zaten ayni
          sekmelere erisim sagliyor, ortada redundant 5 kart gerek yok */}

      {applications.length > 0 && (
        <motion.div variants={ITEM} className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(21, 36, 61, 0.75) 0%, rgba(15, 23, 38, 0.92) 100%)',
            border: '1px solid rgba(212, 168, 83, 0.14)',
            boxShadow: '0 10px 32px rgba(0,0,0,0.30)',
          }}>
          {/* Köşe altın blob */}
          <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(212, 168, 83, 0.30), transparent 70%)', filter: 'blur(24px)' }} />

          <div className="relative px-5 py-3.5 flex items-center justify-between"
               style={{ borderBottom: '1px solid rgba(212, 168, 83, 0.10)' }}>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
                Son başvurular
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(139, 169, 210, 0.65)' }}>
                En son {Math.min(3, applications.length)} başvurun
              </p>
            </div>
            <motion.button
              whileHover={{ x: 3 }}
              onClick={() => onTabChange('applications')}
              className="text-[12px] font-medium"
              style={{ color: '#fde9a5' }}>
              Tümü
            </motion.button>
          </div>
          <motion.div
            initial="hidden" animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.07 } } }}
          >
            {applications.slice(0, 3).map((app, i) => (
              <RecentAppRow key={app.id} app={app} last={i === Math.min(3, applications.length) - 1} />
            ))}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  )
}

/* AmbientField parçacıklar sokuldu — Dalga 3 motion policy */

/* ────── Sub-pieces ────── */

const ITEM = {
  hidden:  { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 160, damping: 22 } },
}

/* QUICK_ACTIONS + ICONS sokuldu — Dalga 3 dead code temizligi */

function StatCard({ label, value, color, data, delta, delay = 0 }) {

  // Mouse parallax
  const ref = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [3, -3]), { stiffness: 200, damping: 25 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-3, 3]), { stiffness: 200, damping: 25 })
  function onMove(e) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width  - 0.5)
    my.set((e.clientY - r.top)  / r.height - 0.5)
  }
  function onLeave() { mx.set(0); my.set(0) }

  // Count-up
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    let raf, start = performance.now() + delay * 1000, duration = 1200
    function step(t) {
      if (t < start) { raf = requestAnimationFrame(step); return }
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, delay])

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove} onMouseLeave={onLeave}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 230, damping: 22 }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className="relative overflow-hidden rounded-2xl p-5 cursor-default min-h-[150px] group"
    >
      {/* Glass icerik katmani */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
           style={{
             background: 'linear-gradient(155deg, rgba(21, 36, 61, 0.88) 0%, rgba(15, 23, 38, 0.96) 100%)',
             border: `1px solid ${color}22`,
             boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
           }} />

      {/* Köşede yüzen renk blob */}
      <div aria-hidden className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-80"
           style={{ background: `radial-gradient(circle, ${color}66 0%, transparent 65%)`, filter: 'blur(22px)' }} />

      {/* Sparkline arka plan — daha belirgin (opacity 0.6) */}
      <div aria-hidden className="absolute inset-x-2 bottom-2 h-14 pointer-events-none opacity-60">
        <Sparkline data={data} color={color} width={400} height={56} />
      </div>

      {/* İçerik — ikon kaldirildi, sadece label + delta */}
      <div className="relative flex items-start justify-between gap-2 mb-1">
        <span className="text-[12px] font-medium" style={{ color: 'rgba(253, 233, 165, 0.85)', letterSpacing: '-0.005em' }}>
          {label}
        </span>
        {typeof delta === 'number' && delta !== 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 380, damping: 20 }}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center"
            style={{
              background: delta > 0 ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
              color:      delta > 0 ? '#86efac' : '#fca5a5',
              border: `1px solid ${delta > 0 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            }}>
            {delta > 0 ? `+${delta}` : delta}
          </motion.span>
        )}
      </div>

      {/* Sayı + sub label */}
      <div className="relative mt-2">
        <div className="text-[48px] font-semibold leading-none tabular-nums"
             style={{
               background: `linear-gradient(135deg, #ffffff 30%, ${color} 100%)`,
               WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
               letterSpacing: '-0.04em',
               filter: `drop-shadow(0 0 18px ${color}55)`,
             }}>
          {displayed}
        </div>
      </div>

    </motion.div>
  )
}

function QuickActionTile({ label, desc, color, onClick }) {
  return (
    <motion.button onClick={onClick}
      whileHover={{ y: -5, scale: 1.025 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className="relative overflow-hidden rounded-2xl text-left p-4 group min-h-[150px] flex flex-col justify-between cursor-pointer"
    >
      {/* Glass icerik */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none"
           style={{
             background: 'linear-gradient(155deg, rgba(21, 36, 61, 0.85) 0%, rgba(15, 23, 38, 0.96) 100%)',
             border: `1px solid ${color}22`,
             boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
           }} />

      <div className="relative">
        <div className="text-[14px] font-semibold mb-0.5" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
          {label}
        </div>
        <div className="text-[11px] line-clamp-1" style={{ color: 'rgba(139, 169, 210, 0.75)' }}>
          {desc}
        </div>
      </div>

    </motion.button>
  )
}

const ROW = {
  hidden:  { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
}

function RecentAppRow({ app, last }) {
  const tint = STATUS_TINT[app.status] || STATUS_TINT.PENDING
  const days = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400_000)
  const relative = days === 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`
  return (
    <motion.div variants={ROW}
      whileHover={{ x: 3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      className="relative px-5 py-3 flex items-center gap-3 group cursor-pointer"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(212, 168, 83, 0.06)' }}>
      {/* Sol kenar status accent rail */}
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `linear-gradient(180deg, ${tint.color}, ${tint.color}80)`,
                     boxShadow: `0 0 10px ${tint.color}66` }} />

      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold flex-shrink-0"
           style={{
             background: 'linear-gradient(135deg, rgba(35, 74, 130, 0.85), rgba(30, 58, 95, 0.95))',
             border: '1px solid rgba(212, 168, 83, 0.30)',
             color: '#fde9a5',
           }}>
        {(app.listing?.businessName || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium truncate" style={{ color: '#ffffff', letterSpacing: '-0.005em' }}>
          {app.listing?.title}
        </div>
        <div className="text-[11.5px] flex items-center gap-2" style={{ color: 'rgba(139, 169, 210, 0.75)' }}>
          <span className="truncate">{app.listing?.businessName}</span>
          <span style={{ color: 'rgba(139, 169, 210, 0.4)' }}>·</span>
          <span>{relative}</span>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold flex-shrink-0"
            style={{
              background: `${tint.color}1a`,
              border: `1px solid ${tint.color}55`,
              color: tint.text,
              boxShadow: `0 0 10px ${tint.color}22`,
            }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.color, boxShadow: `0 0 6px ${tint.color}` }} />
        {STATUS_LABEL[app.status] || app.status}
      </span>
    </motion.div>
  )
}
