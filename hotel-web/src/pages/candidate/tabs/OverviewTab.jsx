// FAZ Redesign v2 — animated borders + dramatic count-up + ambient particles
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
      <AmbientField />

      {/* STAT KARTLARI */}
      <motion.div variants={ITEM} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Toplam Başvuru"
          value={applications.length}
          color="#60a5fa"
          delta={delta}
          data={weeklyTrend(applications, null)}
          icon="briefcase"
          cornerStyle={0}
          delay={0}
        />
        <StatCard
          label="Bekleyen"
          value={pending}
          color="#fbbf24"
          data={weeklyTrend(applications, a => a.status === 'PENDING')}
          icon="clock"
          cornerStyle={1}
          delay={0.1}
        />
        <StatCard
          label="Kabul"
          value={accepted}
          color="#d4a853"
          data={weeklyTrend(applications, a => a.status === 'ACCEPTED')}
          icon="star"
          cornerStyle={2}
          delay={0.2}
        />
      </motion.div>

      <motion.div variants={ITEM}>
        <EarningsWidget applications={applications} />
      </motion.div>

      {/* QUICK ACTIONS */}
      <motion.div variants={ITEM} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {QUICK_ACTIONS.map((a, i) => (
          <QuickActionTile key={a.tab} {...a} idx={i} onClick={() => onTabChange(a.tab)} />
        ))}
      </motion.div>

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
              className="text-[12px] font-medium flex items-center gap-1"
              style={{ color: '#fde9a5' }}>
              Tümü
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
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

/* ────── Ambient field — sayfa arka planında yumuşak altın parçacıklar ────── */
function AmbientField() {
  const particles = useRef(
    Array.from({ length: 14 }, () => ({
      left: Math.random() * 100,
      top:  Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 6,
      duration: 8 + Math.random() * 8,
    }))
  ).current
  return (
    <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <motion.span key={i}
          animate={{ y: [0, -20, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          className="absolute rounded-full"
          style={{
            left: `${p.left}%`, top: `${p.top}%`,
            width: p.size, height: p.size,
            background: '#d4a853',
            boxShadow: '0 0 8px #d4a853',
          }} />
      ))}
    </div>
  )
}

/* ────── Sub-pieces ────── */

const ITEM = {
  hidden:  { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 160, damping: 22 } },
}

const QUICK_ACTIONS = [
  {
    tab: 'listings',     label: 'İlanları Keşfet',  desc: 'Aktif iş ilanlarına göz at', color: '#60a5fa',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />,
  },
  {
    tab: 'applications', label: 'Başvurularım',     desc: 'Başvuru durumlarını takip et', color: '#d4a853',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />,
  },
  {
    tab: 'documents',    label: 'Belgelerim',       desc: 'CV ve sertifika cüzdanın',     color: '#22c55e',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />,
  },
  {
    tab: 'messages',     label: 'Mesajlarım',       desc: 'İşletmelerle sohbet et',       color: '#22d3ee',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />,
  },
  {
    tab: 'profile',      label: 'Profilim',         desc: 'Bilgiler ve müsaitlik',        color: '#a78bfa',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />,
  },
]

const ICONS = {
  briefcase: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />,
  clock:     <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  star:      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />,
}

function StatCard({ label, value, color, data, icon, delta, cornerStyle = 0, delay = 0 }) {
  const corners = [
    'rounded-tl-[28px] rounded-tr-[12px] rounded-br-[28px] rounded-bl-[12px]',
    'rounded-tl-[12px] rounded-tr-[28px] rounded-br-[12px] rounded-bl-[28px]',
    'rounded-tl-[28px] rounded-tr-[28px] rounded-br-[12px] rounded-bl-[12px]',
  ][cornerStyle]

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
      className={`relative overflow-hidden ${corners} p-5 cursor-default min-h-[150px] group`}
    >
      {/* Animasyonlu conic gradient border — sürekli dönen */}
      <div aria-hidden className="absolute -inset-px rounded-[inherit] opacity-70 pointer-events-none"
           style={{
             background: `conic-gradient(from 0deg, transparent 0%, ${color}55 12%, transparent 28%, ${color}33 55%, transparent 75%)`,
             animation: 'spin 12s linear infinite',
             filter: 'blur(0.5px)',
           }} />
      {/* İç katman — glass */}
      <div className="absolute inset-px rounded-[inherit] pointer-events-none"
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

      {/* İçerik */}
      <div className="relative flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2.5">
          {/* Icon badge — animasyonlu pulse ring */}
          <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
               style={{
                 background: `linear-gradient(135deg, ${color}30, ${color}12)`,
                 border: `1px solid ${color}55`,
                 boxShadow: `0 0 14px ${color}30`,
               }}>
            <span aria-hidden className="absolute inset-0 rounded-2xl"
                  style={{
                    border: `1px solid ${color}55`,
                    animation: 'overview-ring-pulse 2.6s ease-in-out infinite',
                  }} />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke={color} strokeWidth={1.7} className="w-4 h-4 relative">{ICONS[icon]}</svg>
          </div>
          <span className="text-[12px] font-medium" style={{ color: 'rgba(253, 233, 165, 0.85)', letterSpacing: '-0.005em' }}>
            {label}
          </span>
        </div>
        {typeof delta === 'number' && delta !== 0 && (
          <motion.span
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring', stiffness: 380, damping: 20 }}
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                style={{
                  background: delta > 0 ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
                  color:      delta > 0 ? '#86efac' : '#fca5a5',
                  border: `1px solid ${delta > 0 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2.5} className="w-3 h-3">
              {delta > 0
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />}
            </svg>
            {Math.abs(delta)}
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes overview-ring-pulse {
          0%,100% { transform: scale(1);   opacity: 0.5 }
          50%     { transform: scale(1.18); opacity: 0 }
        }
      `}</style>
    </motion.div>
  )
}

function QuickActionTile({ label, desc, color, icon, idx, onClick }) {
  const corners = [
    'rounded-tl-[22px] rounded-tr-[8px] rounded-br-[22px] rounded-bl-[8px]',
    'rounded-tl-[8px] rounded-tr-[22px] rounded-br-[8px] rounded-bl-[22px]',
  ][idx % 2]
  return (
    <motion.button onClick={onClick}
      whileHover={{ y: -5, scale: 1.025 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 280, damping: 22 }}
      className={`relative overflow-hidden ${corners} text-left p-4 group min-h-[150px] flex flex-col justify-between cursor-pointer`}
    >
      {/* Animasyonlu conic border (sadece hover'da görünür belirginleşir) */}
      <div aria-hidden className="absolute -inset-px rounded-[inherit] opacity-30 group-hover:opacity-90 transition-opacity duration-500 pointer-events-none"
           style={{
             background: `conic-gradient(from 0deg, transparent 0%, ${color}55 15%, transparent 30%, ${color}33 55%, transparent 75%)`,
             animation: 'spin 14s linear infinite',
           }} />
      {/* İç glass */}
      <div className="absolute inset-px rounded-[inherit] pointer-events-none"
           style={{
             background: 'linear-gradient(155deg, rgba(21, 36, 61, 0.85) 0%, rgba(15, 23, 38, 0.96) 100%)',
             border: `1px solid ${color}22`,
             boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
           }} />
      {/* Hover glow blob */}
      <div aria-hidden className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none opacity-30 group-hover:opacity-80 transition-opacity duration-500"
           style={{ background: `radial-gradient(circle, ${color}66, transparent 65%)`, filter: 'blur(20px)' }} />

      <div className="relative">
        <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center"
             style={{
               background: `linear-gradient(135deg, ${color}30, ${color}10)`,
               border: `1px solid ${color}55`,
               boxShadow: `0 0 16px ${color}30`,
             }}>
          <span aria-hidden className="absolute inset-0 rounded-2xl"
                style={{
                  border: `1px solid ${color}55`,
                  animation: 'overview-ring-pulse 2.6s ease-in-out infinite',
                }} />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke={color} strokeWidth={1.7} className="w-5 h-5 relative">{icon}</svg>
        </div>
      </div>

      <div className="relative">
        <div className="text-[14px] font-semibold mb-0.5" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
          {label}
        </div>
        <div className="text-[11px] line-clamp-1" style={{ color: 'rgba(139, 169, 210, 0.75)' }}>
          {desc}
        </div>
      </div>

      <span aria-hidden
        className="absolute bottom-3 right-3 transition-transform duration-300 group-hover:translate-x-1.5"
        style={{ color }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={2.4} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </span>
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
