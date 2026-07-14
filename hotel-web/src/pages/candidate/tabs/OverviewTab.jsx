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

      {/* FAZ 14.5.1 — BENTO GRID: esit kutu yiginindan asimetrik kompozisyona.
          Hero numeral (buyuk) + profil goruntulenme (dar) ustte;
          altta 2 mini stat + kabul orani halkasi. */}
      <motion.div variants={ITEM} className="grid grid-cols-12 gap-3">
        {/* Hero — Toplam Basvuru (genis, numeral-hero + sparkline zemin) */}
        <HeroStat
          className="col-span-12 sm:col-span-7"
          label="Toplam Başvuru"
          value={applications.length}
          delta={delta}
          data={weeklyTrend(applications, null)}
        />
        {/* Profil goruntulenme — dar dikey hucre */}
        <div className="col-span-12 sm:col-span-5">
          <ProfileViewsWidget bento />
        </div>

        {/* Alt sira: mini stat'lar + oran halkasi */}
        <MiniStat className="col-span-4"
                  label="Bekleyen" value={pending} color="#c8923a"
                  data={weeklyTrend(applications, a => a.status === 'PENDING')} />
        <MiniStat className="col-span-4"
                  label="Kabul" value={accepted} color="#7a9f7a"
                  data={weeklyTrend(applications, a => a.status === 'ACCEPTED')} />
        <RatioRing className="col-span-4"
                   label="Kabul Oranı"
                   ratio={applications.length > 0 ? accepted / applications.length : 0} />
      </motion.div>

      <motion.div variants={ITEM}>
        <EarningsWidget applications={applications} />
      </motion.div>

      {/* QUICK ACTIONS sokuldu — sidebar nav + mobile bottom tab bar zaten ayni
          sekmelere erisim sagliyor, ortada redundant 5 kart gerek yok */}

      {applications.length > 0 && (
        <motion.div variants={ITEM} className="tier-raised relative overflow-hidden">
          {/* Köşe champagne blob */}
          <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(205, 183, 143, 0.22), transparent 70%)', filter: 'blur(28px)' }} />

          <div className="relative px-6 py-4 flex items-center justify-between border-b border-hairline">
            <div>
              <h2 className="type-heading" style={{ fontSize: '16px' }}>
                Son başvurular
              </h2>
              <p className="type-overline mt-1">
                En son {Math.min(3, applications.length)} başvurun
              </p>
            </div>
            <motion.button
              whileHover={{ x: 3 }}
              onClick={() => onTabChange('applications')}
              className="type-caption underline-sweep text-champagne-300"
              style={{ fontWeight: 500 }}>
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
    <div className="tier-raised p-5">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-hairline">
        <h3 className="type-subhead" style={{ color: 'var(--text-headline)', fontWeight: 600 }}>Aktivite</h3>
        <span className="type-overline">{sorted.length} kayıt</span>
      </div>

      {sorted.length === 0 ? (
        <p className="type-body text-center py-8" style={{ color: 'var(--text-muted)' }}>
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
                    <p className="type-body font-medium truncate transition-colors">
                      {app.listing?.title || 'İlan'}
                    </p>
                    <p className="type-caption truncate mt-0.5">
                      {app.listing?.businessName || ''} · {STATUS_LABEL[app.status] || app.status}
                    </p>
                  </div>
                  <span className="type-caption flex-shrink-0 mt-1 tabular-nums"
                        style={{ color: 'var(--text-faint)' }}>
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

/* ── FAZ 14.5.1 — Bento parcalari ── */

/** Count-up hook — numeral'lar 0'dan hedefe ease-out sayar. */
function useCountUp(value, delay = 0) {
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
  return displayed
}

/** Hero stat — bento'nun buyuk hucresi: numeral-hero + genis sparkline + delta. */
function HeroStat({ className = '', label, value, delta, data }) {
  const ref = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [2, -2]), { stiffness: 200, damping: 25 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-2, 2]), { stiffness: 200, damping: 25 })
  function onMove(e) {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width  - 0.5)
    my.set((e.clientY - r.top)  / r.height - 0.5)
  }
  const displayed = useCountUp(value)

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove} onMouseLeave={() => { mx.set(0); my.set(0) }}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 230, damping: 22 }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      className={`tier-raised relative overflow-hidden cursor-default group p-6 min-h-[180px] flex flex-col justify-end ${className}`}
    >
      {/* Katmanli zemin: champagne diagonal wash + genis sparkline */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{ background: 'linear-gradient(125deg, rgba(205, 183, 143, 0.10) 0%, transparent 45%)' }} />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-20 pointer-events-none opacity-40">
        <Sparkline data={data} color="#cdb78f" width={640} height={80} />
      </div>

      {typeof delta === 'number' && delta !== 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 380, damping: 20 }}
          className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1"
          style={{
            background: delta > 0 ? 'rgba(122, 159, 122, 0.14)' : 'rgba(180, 106, 85, 0.14)',
            color:      delta > 0 ? '#a8c8a8' : '#d39481',
            border: `1px solid ${delta > 0 ? 'rgba(122, 159, 122, 0.32)' : 'rgba(180, 106, 85, 0.32)'}`,
          }}>
          {delta > 0 ? `+${delta}` : delta} bu hafta
        </motion.span>
      )}

      <div className="relative">
        <div className="tabular-nums"
             style={{
               fontSize: 'clamp(44px, 6vw, 64px)',
               fontWeight: 600,
               lineHeight: 0.95,
               letterSpacing: '-0.04em',
               color: 'var(--text-headline)',
               filter: 'drop-shadow(0 0 18px rgba(205, 183, 143, 0.28))',
             }}>
          {displayed}
        </div>
        <div className="mt-2 h-px w-12" style={{ background: 'rgba(205, 183, 143, 0.35)' }} />
        <div className="type-overline mt-2">{label}</div>
      </div>
    </motion.div>
  )
}

/** Mini stat — bento alt sirasi: sol renk rayi + kompakt numeral. */
function MiniStat({ className = '', label, value, color, data }) {
  const displayed = useCountUp(value, 0.15)
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`tier-raised relative overflow-hidden cursor-default p-4 ${className}`}
    >
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}55` }} />
      <div aria-hidden className="absolute inset-x-2 bottom-1.5 h-6 pointer-events-none opacity-25">
        <Sparkline data={data} color={color} width={220} height={24} />
      </div>
      <div className="relative pl-2">
        <div className="tabular-nums" style={{ fontSize: '28px', fontWeight: 600, lineHeight: 1, color, letterSpacing: '-0.03em' }}>
          {displayed}
        </div>
        <div className="type-overline mt-1.5">{label}</div>
      </div>
    </motion.div>
  )
}

/** Oran halkasi — SVG progress ring; kutu monotonini kiran dairesel form. */
function RatioRing({ className = '', label, ratio }) {
  const pct = Math.round(ratio * 100)
  const R = 26
  const CIRC = 2 * Math.PI * R
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={`tier-raised relative cursor-default p-4 flex items-center gap-3 ${className}`}
    >
      <svg width="64" height="64" viewBox="0 0 64 64" className="flex-shrink-0 -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none"
                stroke="rgba(205, 183, 143, 0.10)" strokeWidth="5" />
        <motion.circle cx="32" cy="32" r={R} fill="none"
                stroke="#7a9f7a" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={CIRC}
                initial={{ strokeDashoffset: CIRC }}
                animate={{ strokeDashoffset: CIRC * (1 - ratio) }}
                transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                style={{ filter: 'drop-shadow(0 0 6px rgba(122, 159, 122, 0.45))' }} />
      </svg>
      <div className="min-w-0">
        <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 600, lineHeight: 1, color: '#a8c8a8', letterSpacing: '-0.02em' }}>
          %{pct}
        </div>
        <div className="type-overline mt-1.5">{label}</div>
      </div>
    </motion.div>
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
        <div className="type-body font-medium truncate">
          {app.listing?.title}
        </div>
        <div className="type-caption flex items-center gap-2 mt-0.5">
          <span className="truncate">{app.listing?.businessName}</span>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span>{relative}</span>
        </div>
      </div>
      <span className="type-overline inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full flex-shrink-0"
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

/* Dalga H3 — Profil goruntulenme widget'i (Kariyer.net 90 gun pattern)
   FAZ 14.5.1 — bento variant: hero ile ayni yukseklikte dikey hucre,
   buyuk goz ikonu zeminde dekoratif. */
function ProfileViewsWidget({ bento = false }) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-profile-views', 90],
    queryFn: () => hotelApi.getMyProfileViews(90),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return null
  const total = data?.totalViews ?? 0
  const unique = data?.uniqueViewers ?? 0

  if (bento) {
    return (
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 230, damping: 22 }}
        className="tier-raised relative overflow-hidden cursor-default p-6 min-h-[180px] h-full flex flex-col justify-end">
        {/* Dev dekoratif goz — zeminde, kirpilmis */}
        <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="rgba(205, 183, 143, 0.10)"
             strokeWidth="1" className="absolute -top-6 -right-6 w-40 h-40 pointer-events-none">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" stroke="rgba(205, 183, 143, 0.18)" />
        </svg>
        <div className="relative">
          <div className="tabular-nums"
               style={{
                 fontSize: 'clamp(36px, 4vw, 48px)',
                 fontWeight: 600,
                 lineHeight: 0.95,
                 letterSpacing: '-0.04em',
                 color: 'var(--accent-action)',
                 filter: 'drop-shadow(0 0 14px rgba(205, 183, 143, 0.30))',
               }}>
            {total}
          </div>
          <div className="mt-2 h-px w-12" style={{ background: 'rgba(205, 183, 143, 0.35)' }} />
          <div className="type-overline mt-2">Profil Görüntülenme · 90 gün</div>
          <div className="type-caption mt-0.5">
            {unique > 0 ? `${unique} işletme baktı` : 'henüz işletme bakmadı'}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="tier-raised p-5 flex items-center gap-4">
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
        <div className="type-overline">
          PROFIL GÖRÜNTÜLENME · SON 90 GÜN
        </div>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="tabular-nums"
                style={{
                  color: 'var(--text-headline)',
                  fontSize: '28px',
                  fontWeight: 600,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 0 12px rgba(205, 183, 143, 0.25))',
                }}>
            {total}
          </span>
          <span className="type-caption">
            {unique > 0 ? `${unique} işletme baktı` : 'henüz işletme bakmadı'}
          </span>
        </div>
      </div>
    </div>
  )
}
