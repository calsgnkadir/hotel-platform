import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import * as hotelApi from '../../../api/hotel'
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'
import EarningsWidget from '../../../components/candidate/EarningsWidget'

/* FAZ 5.UX3 — Muted status: ochre / brick / sage / info-grey instead of neon */
const STATUS_TINT = {
  PENDING:   { color: '#c8923a', text: '#e0b766' },   // ochre
  REVIEWING: { color: '#6b8aa3', text: '#a0b1c2' },   // info-blue muted
  HELD:      { color: '#a17b3f', text: '#cda06e' },   // deep ochre
  ACCEPTED:  { color: '#7a9f7a', text: '#a8c8a8' },   // sage
  REJECTED:  { color: '#b46a55', text: '#d39481' },   // brick
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
      className="relative grid xl:grid-cols-[1fr_320px] gap-4 items-start"
      initial="hidden" animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}
    >
      {/* === SOL KOLON === */}
      <div className="space-y-4 min-w-0">
      {/* Dalga H3 — Profil goruntulenme widget'i (Kariyer.net'ten uyarlama) */}
      <ProfileViewsWidget />

      {/* STAT KARTLARI — champagne / ochre / sage (muted, no neon) */}
      <motion.div variants={ITEM} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Toplam Başvuru"
          value={applications.length}
          color="#cdb78f"
          delta={delta}
          data={weeklyTrend(applications, null)}
          delay={0}
        />
        <StatCard
          label="Bekleyen"
          value={pending}
          color="#c8923a"
          data={weeklyTrend(applications, a => a.status === 'PENDING')}
          delay={0.1}
        />
        <StatCard
          label="Kabul"
          value={accepted}
          color="#7a9f7a"
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
            background: '#1b1815',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
          {/* Köşe champagne blob */}
          <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(205, 183, 143, 0.22), transparent 70%)', filter: 'blur(28px)' }} />

          <div className="relative px-6 py-4 flex items-center justify-between"
               style={{ borderBottom: '1px solid rgba(205, 183, 143, 0.08)' }}>
            <div>
              <h2 className="text-[16px] font-semibold" style={{ color: '#f5efe2', letterSpacing: '-0.015em' }}>
                Son başvurular
              </h2>
              <p className="text-[11px] mt-1 uppercase tracking-[0.18em]" style={{ color: '#928678' }}>
                En son {Math.min(3, applications.length)} başvurun
              </p>
            </div>
            <motion.button
              whileHover={{ x: 3 }}
              onClick={() => onTabChange('applications')}
              className="text-[12px] font-medium underline-sweep"
              style={{ color: '#cdb78f' }}>
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
      </div>

      {/* === SAG KOLON: Aktivite akisi === */}
      <motion.aside variants={ITEM} className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <ActivityStream applications={applications} onTabChange={onTabChange} />
      </motion.aside>
    </motion.div>
  )
}

/* Aktivite akisi — son basvurularin durum degisikligi zaman cizgisi */
function ActivityStream({ applications, onTabChange }) {
  const sorted = [...applications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1)  return 'az önce'
    if (m < 60) return `${m} dk`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} sa`
    const d = Math.floor(h / 24)
    if (d < 7)  return `${d} gün`
    return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4 pb-3"
           style={{ borderBottom: '1px solid rgba(205, 183, 143, 0.08)' }}>
        <h3 className="text-[14px] font-semibold tracking-tight"
            style={{ color: '#f5efe2', letterSpacing: '-0.01em' }}>Aktivite</h3>
        <span className="text-[10px] font-medium uppercase tracking-[0.22em]"
              style={{ color: '#6b6358' }}>{sorted.length} kayıt</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-center text-xs py-8" style={{ color: '#928678' }}>
          Henüz başvuru yok. İlanlar sekmesinden başla.
        </p>
      ) : (
        <ul className="space-y-3">
          {sorted.map(app => {
            const tint = STATUS_TINT[app.status] || { color: '#928678', text: '#c9bdaa' }
            return (
              <li key={app.id}>
                <button onClick={() => onTabChange('applications')}
                  className="w-full text-left flex items-start gap-2.5 group">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                        style={{
                          background: tint.color,
                          boxShadow: `0 0 6px ${tint.color}66`,
                        }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate transition-colors"
                       style={{ color: '#ede4d3' }}>
                      {app.listing?.title || 'İlan'}
                    </p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: '#928678' }}>
                      {app.listing?.businessName || ''} · {STATUS_LABEL[app.status] || app.status}
                    </p>
                  </div>
                  <span className="text-[10px] flex-shrink-0 mt-1 tabular-nums"
                        style={{ color: '#6b6358' }}>
                    {relativeTime(app.createdAt)}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
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
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 230, damping: 22 }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className="stat-card cursor-default group"
    >
      {/* Köşede yüzen renk blob — quiet accent */}
      <div aria-hidden className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none transition-opacity duration-500 opacity-30 group-hover:opacity-55"
           style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 65%)`, filter: 'blur(26px)' }} />

      {/* Sparkline arka plan — toned way down */}
      <div aria-hidden className="absolute inset-x-3 bottom-3 h-10 pointer-events-none opacity-30">
        <Sparkline data={data} color={color} width={400} height={40} />
      </div>

      {/* Delta pill — top-right anchor (independent of number/label stack) */}
      {typeof delta === 'number' && delta !== 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 380, damping: 20 }}
          className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center"
          style={{
            background: delta > 0 ? 'rgba(122, 159, 122, 0.14)' : 'rgba(180, 106, 85, 0.14)',
            color:      delta > 0 ? '#a8c8a8' : '#d39481',
            border: `1px solid ${delta > 0 ? 'rgba(122, 159, 122, 0.32)' : 'rgba(180, 106, 85, 0.32)'}`,
          }}>
          {delta > 0 ? `+${delta}` : delta}
        </motion.span>
      )}

      {/* Number → hairline → label hierarchy (spec: tighter, thin divider under number) */}
      <div className="relative">
        <div className="stat-card-number" style={{ filter: `drop-shadow(0 0 12px ${color}44)` }}>
          {displayed}
        </div>
        <div className="stat-card-divider" />
        <div className="stat-card-label">{label}</div>
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
             background: 'linear-gradient(155deg, rgba(13, 11, 9, 0.85) 0%, rgba(13, 11, 9, 0.96) 100%)',
             border: `1px solid ${color}22`,
             boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
           }} />

      <div className="relative">
        <div className="text-[14px] font-semibold mb-0.5" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
          {label}
        </div>
        <div className="text-[11px] line-clamp-1" style={{ color: '#c9bdaa' }}>
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
      className="relative px-6 py-4 flex items-center gap-3 group cursor-pointer"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(205, 183, 143, 0.06)' }}>
      {/* Sol kenar status accent rail — hairline on hover */}
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: tint.color }} />

      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
           style={{
             background: 'rgba(205, 183, 143, 0.08)',
             border: '1px solid rgba(205, 183, 143, 0.22)',
             color: '#cdb78f',
           }}>
        {(app.listing?.businessName || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-medium truncate" style={{ color: '#ede4d3', letterSpacing: '-0.005em' }}>
          {app.listing?.title}
        </div>
        <div className="text-[11px] flex items-center gap-2 mt-0.5" style={{ color: '#928678' }}>
          <span className="truncate">{app.listing?.businessName}</span>
          <span style={{ color: '#6b6358' }}>·</span>
          <span>{relative}</span>
        </div>
      </div>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.14em] flex-shrink-0"
            style={{
              background: `${tint.color}14`,
              border: `1px solid ${tint.color}44`,
              color: tint.text,
            }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: tint.color }} />
        {STATUS_LABEL[app.status] || app.status}
      </span>
    </motion.div>
  )
}

/* Dalga H3 — Profil goruntulenme widget'i (Kariyer.net 90 gun pattern) */
function ProfileViewsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-profile-views', 90],
    queryFn: () => hotelApi.getMyProfileViews(90),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return null
  const total = data?.totalViews ?? 0
  const unique = data?.uniqueViewers ?? 0

  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
           style={{
             background: 'rgba(205, 183, 143, 0.08)',
             border: '1px solid rgba(205, 183, 143, 0.22)',
           }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#cdb78f"
             strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.22em] font-medium"
             style={{ color: '#928678' }}>
          PROFIL GÖRÜNTÜLENME · SON 90 GÜN
        </div>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="tabular-nums"
                style={{
                  color: '#f5efe2',
                  fontSize: '28px',
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 0 12px rgba(205, 183, 143, 0.25))',
                }}>
            {total}
          </span>
          <span className="text-[11px]" style={{ color: '#928678' }}>
            {unique > 0 ? `${unique} işletme baktı` : 'henüz işletme bakmadı'}
          </span>
        </div>
      </div>
    </div>
  )
}
