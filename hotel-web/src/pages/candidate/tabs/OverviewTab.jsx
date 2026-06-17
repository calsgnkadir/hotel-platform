// FAZ Redesign — bento stat cards + Geist + spring micro-interactions
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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

  // Önceki hafta sayımı için basit delta — son 7 gün vs önceki 7 gün
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
      className="space-y-4 font-geist"
      initial="hidden" animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
    >
      {/* STAT KARTLARI — bento, asimetrik corners */}
      <motion.div variants={ITEM} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Toplam Başvuru"
          value={applications.length}
          color="#60a5fa"
          delta={delta}
          data={weeklyTrend(applications, null)}
          icon={
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
          }
          cornerStyle={0}
        />
        <StatCard
          label="Bekleyen"
          value={pending}
          color="#fbbf24"
          data={weeklyTrend(applications, a => a.status === 'PENDING')}
          icon={
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          }
          cornerStyle={1}
        />
        <StatCard
          label="Kabul"
          value={accepted}
          color="#d4a853"
          data={weeklyTrend(applications, a => a.status === 'ACCEPTED')}
          icon={
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
          }
          cornerStyle={2}
        />
      </motion.div>

      {/* EARNINGS */}
      <motion.div variants={ITEM}>
        <EarningsWidget applications={applications} />
      </motion.div>

      {/* QUICK ACTIONS — 5 tile bento */}
      <motion.div variants={ITEM} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {QUICK_ACTIONS.map((a, i) => (
          <QuickActionTile key={a.tab} {...a} idx={i} onClick={() => onTabChange(a.tab)} />
        ))}
      </motion.div>

      {applications.length > 0 && (
        <motion.div variants={ITEM} className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21, 36, 61, 0.75) 0%, rgba(15, 23, 38, 0.92) 100%)',
            border: '1px solid rgba(212, 168, 83, 0.14)',
          }}>
          <div className="px-5 py-3.5 flex items-center justify-between"
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
          <div>
            {applications.slice(0, 3).map((app, i) => (
              <RecentAppRow key={app.id} app={app} last={i === Math.min(3, applications.length) - 1} />
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

/* ───── Sub-pieces ───── */

const ITEM = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
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

function StatCard({ label, value, color, data, icon, delta, cornerStyle = 0 }) {
  const corners = [
    'rounded-tl-[24px] rounded-tr-[10px] rounded-br-[24px] rounded-bl-[10px]',
    'rounded-tl-[10px] rounded-tr-[24px] rounded-br-[10px] rounded-bl-[24px]',
    'rounded-tl-[24px] rounded-tr-[24px] rounded-br-[10px] rounded-bl-[10px]',
  ][cornerStyle]
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    let raf, start = performance.now(), duration = 850
    function step(t) {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 230, damping: 22 }}
      className={`relative overflow-hidden ${corners} group p-4 cursor-default`}
      style={{
        background: 'linear-gradient(155deg, rgba(21, 36, 61, 0.75) 0%, rgba(15, 23, 38, 0.95) 100%)',
        border: `1px solid ${color}22`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)',
        minHeight: 112,
      }}>
      {/* Köşede yüzen renk blob */}
      <div aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none transition-opacity duration-500 opacity-40 group-hover:opacity-70"
           style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`, filter: 'blur(18px)' }} />
      {/* Sparkline watermark — alt arkaplan */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-12 pointer-events-none opacity-50">
        <Sparkline data={data} color={color} width={300} height={48} />
      </div>

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{
                 background: `linear-gradient(135deg, ${color}28, ${color}10)`,
                 border: `1px solid ${color}40`,
               }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke={color} strokeWidth={1.7} className="w-4 h-4">{icon}</svg>
          </div>
          <span className="text-[11px] font-medium" style={{ color: 'rgba(139, 169, 210, 0.85)', letterSpacing: '-0.005em' }}>
            {label}
          </span>
        </div>
        {typeof delta === 'number' && delta !== 0 && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{
                  background: delta > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color:      delta > 0 ? '#86efac' : '#fca5a5',
                  border: `1px solid ${delta > 0 ? 'rgba(34, 197, 94, 0.30)' : 'rgba(239, 68, 68, 0.30)'}`,
                }}>
            {delta > 0 ? '↗' : '↘'} {Math.abs(delta)}
          </span>
        )}
      </div>
      <div className="relative mt-3 text-[42px] font-semibold leading-none tabular-nums"
           style={{
             background: `linear-gradient(135deg, #ffffff, ${color})`,
             WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
             letterSpacing: '-0.04em',
           }}>
        {displayed}
      </div>
    </motion.div>
  )
}

function QuickActionTile({ label, desc, color, icon, idx, onClick }) {
  const corners = [
    'rounded-tl-[20px] rounded-tr-[8px] rounded-br-[20px] rounded-bl-[8px]',
    'rounded-tl-[8px] rounded-tr-[20px] rounded-br-[8px] rounded-bl-[20px]',
  ][idx % 2]
  return (
    <motion.button onClick={onClick}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`relative overflow-hidden ${corners} text-left p-4 group min-h-[140px] flex flex-col justify-between`}
      style={{
        background: 'linear-gradient(155deg, rgba(21, 36, 61, 0.75) 0%, rgba(15, 23, 38, 0.95) 100%)',
        border: `1px solid ${color}22`,
        boxShadow: '0 8px 28px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}>
      {/* Hover'da görünür glow */}
      <div aria-hidden className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none opacity-30 group-hover:opacity-60 transition-opacity duration-500"
           style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 70%)`, filter: 'blur(18px)' }} />

      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
             style={{
               background: `linear-gradient(135deg, ${color}28, ${color}10)`,
               border: `1px solid ${color}40`,
             }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke={color} strokeWidth={1.7} className="w-5 h-5">{icon}</svg>
        </div>
      </div>

      <div className="relative">
        <div className="text-[13.5px] font-semibold" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
          {label}
        </div>
        <div className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'rgba(139, 169, 210, 0.75)' }}>
          {desc}
        </div>
      </div>

      <span aria-hidden
        className="absolute bottom-3 right-3 transition-transform duration-300 group-hover:translate-x-1"
        style={{ color }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={2.3} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </span>
    </motion.button>
  )
}

function RecentAppRow({ app, last }) {
  const tint = STATUS_TINT[app.status] || STATUS_TINT.PENDING
  const days = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400_000)
  const relative = days === 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`
  return (
    <div className="px-5 py-3 flex items-center gap-3 group"
         style={{ borderBottom: last ? 'none' : '1px solid rgba(212, 168, 83, 0.06)' }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
           style={{
             background: 'linear-gradient(135deg, rgba(35, 74, 130, 0.85), rgba(30, 58, 95, 0.95))',
             border: '1px solid rgba(212, 168, 83, 0.25)',
             color: '#fde9a5',
           }}>
        {(app.listing?.businessName || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-medium truncate" style={{ color: '#ffffff', letterSpacing: '-0.005em' }}>
          {app.listing?.title}
        </div>
        <div className="text-[11px] flex items-center gap-2" style={{ color: 'rgba(139, 169, 210, 0.75)' }}>
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
            }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.color, boxShadow: `0 0 6px ${tint.color}` }} />
        {STATUS_LABEL[app.status] || app.status}
      </span>
    </div>
  )
}
