import { motion } from 'framer-motion'
import { StatusBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'  // FAZ 5.6
import TodayWidget from '../components/TodayWidget'  // FAZ 5.12
import ReliabilityBadge from '../../../components/ReliabilityBadge'

/* ── Overview Tab — Dalga C: 2-sutun (sol stat+tablo, sag canli akis) ── */
export default function OverviewTab({ applications, onTabChange }) {
  const pending   = applications.filter(a => a.status === 'PENDING').length
  const reviewing = applications.filter(a => a.status === 'REVIEWING').length
  const accepted  = applications.filter(a => a.status === 'ACCEPTED').length

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-4 items-start">
      {/* === SOL KOLON: mevcut overview === */}
      <div className="space-y-4 min-w-0">
        {/* FAZ 5.12 — Bugun widget tepelik */}
        <TodayWidget applications={applications} onTabChange={onTabChange} />

        {/* Stat strip — number → hairline → label hierarchy (UX4 spec) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Toplam',      value: applications.length, color: '#cdb78f',
              data: weeklyTrend(applications, null) },
            { label: 'Bekleyen',    value: pending,             color: '#c8923a',
              data: weeklyTrend(applications, a => a.status === 'PENDING') },
            { label: 'İnceleniyor', value: reviewing,           color: '#6b8aa3',
              data: weeklyTrend(applications, a => a.status === 'REVIEWING') },
            { label: 'Kabul',       value: accepted,            color: '#7a9f7a',
              data: weeklyTrend(applications, a => a.status === 'ACCEPTED') },
          ].map(s => (
            <motion.div key={s.label}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              className="stat-card group cursor-default"
            >
              {/* Blob accent — quiet */}
              <div aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none transition-opacity duration-500 opacity-30 group-hover:opacity-55"
                   style={{ background: `radial-gradient(circle, ${s.color}55 0%, transparent 65%)`, filter: 'blur(18px)' }} />

              {/* Sparkline arka plan */}
              <div aria-hidden className="absolute inset-x-3 bottom-3 h-8 pointer-events-none opacity-30">
                <Sparkline data={s.data} color={s.color} width={200} height={32} />
              </div>

              {/* Number → hairline → label */}
              <div className="relative">
                <div className="stat-card-number" style={{ filter: `drop-shadow(0 0 10px ${s.color}44)` }}>
                  {s.value}
                </div>
                <div className="stat-card-divider" />
                <div className="stat-card-label">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="tier-raised relative overflow-hidden">
          <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(205, 183, 143, 0.22), transparent 70%)', filter: 'blur(24px)' }} />
          <div className="relative px-5 py-3.5 flex items-center justify-between border-b border-hairline">
            <div>
              <h2 className="type-heading" style={{ fontSize: '15px' }}>
                Son Başvurular
              </h2>
              <p className="type-caption mt-0.5">
                En son {Math.min(5, applications.length)} başvuru
              </p>
            </div>
            <motion.button
              whileHover={{ x: 3 }}
              onClick={() => onTabChange('applications')}
              className="type-caption text-champagne-300"
              style={{ fontWeight: 500 }}>
              Tümünü Gör
            </motion.button>
          </div>
          {applications.length === 0 ? (
            <EmptyState
              type="applications"
              title="Henüz başvuru yok"
              description="3 adımda ilk adayını al:"
              steps={[
                { label: 'İlanlarım sekmesine git', hint: 'Yayında olan ilanın var mı kontrol et' },
                { label: 'Yeni ilan oluştur',       hint: 'Pozisyon + vardiya slotu + ücret bilgisi' },
                { label: 'Adaylar başvurunca',      hint: 'Gelen Başvurular > Kanban\'da sürükle-bırak ile yönet' },
              ]}
              ctaLabel="İlanlarıma Git"
              onCta={() => onTabChange('mylistings')}
              compact
            />
          ) : (
            <div className="relative">
              {applications.slice(0, 5).map((app, i, arr) => (
                <BizRecentRow key={app.id} app={app} last={i === arr.length - 1}
                              onClick={() => onTabChange('applications')} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* === SAG KOLON: Bugunku Akis (Today's Feed stream) === */}
      <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
        <TodayFeed applications={applications} onTabChange={onTabChange} />
      </aside>
    </div>
  )
}

/* Bugunku Akis — son aktivite zaman akisi */
function TodayFeed({ applications, onTabChange }) {
  const today  = new Date(); today.setHours(0,0,0,0)
  const YDAY   = today.getTime() - 86400_000
  // Bugun + dun gelen basvurular, en yeniden eskiye
  const recent = [...applications]
    .filter(a => new Date(a.createdAt).getTime() >= YDAY)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8)

  function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60_000)
    if (m < 1)  return 'az önce'
    if (m < 60) return `${m} dk önce`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} sa önce`
    return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="tier-raised p-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-hairline">
        <h3 className="type-overline text-champagne-300" style={{ fontSize: '11px' }}>Bugünkü Akış</h3>
        <span className="type-overline">{recent.length} olay</span>
      </div>

      {recent.length === 0 ? (
        <p className="type-body text-center py-6" style={{ color: 'var(--text-faint)' }}>
          Son 24 saat sessiz.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {recent.map(app => (
            <li key={app.id}>
              <button onClick={() => onTabChange('applications')}
                className="w-full text-left flex items-start gap-2.5 group">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                      style={{
                        background:   STATUS_DOT[app.status] || '#928678',
                        boxShadow: `0 0 8px ${STATUS_DOT[app.status] || '#928678'}`,
                      }} />
                <div className="flex-1 min-w-0">
                  <p className="type-body font-medium truncate">
                    {app.candidate?.fullName || 'Aday'}
                  </p>
                  <p className="type-caption truncate" style={{ color: 'var(--text-faint)' }}>
                    {app.listing?.title || 'İlan'} · {STATUS_LABEL[app.status] || app.status}
                  </p>
                </div>
                <span className="type-caption flex-shrink-0 mt-0.5"
                      style={{ color: 'var(--text-faint)' }}>
                  {relativeTime(app.createdAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* Son başvurular satırı — accent rail + avatar gradient + hover lift (B teması) */
function BizRecentRow({ app, last, onClick }) {
  const accent = STATUS_DOT[app.status] || '#928678'
  const days = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400_000)
  const relative = days === 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`
  return (
    <motion.div onClick={onClick}
      whileHover={{ x: 3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      className="relative pl-6 pr-5 py-3 flex items-center gap-3 group cursor-pointer"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(205, 183, 143, 0.05)' }}>
      {/* Sol accent bar — always visible per UX4 spec */}
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: accent }} />
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold flex-shrink-0"
           style={{
             background: 'linear-gradient(135deg, rgba(205, 183, 143, 0.08), rgba(205, 183, 143, 0.06))',
             border: '1px solid rgba(205, 183, 143, 0.22)',
             color: '#cdb78f',
           }}>
        {(app.candidate?.fullName || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="type-body font-medium truncate" style={{ color: 'var(--text-headline)' }}>
            {app.candidate?.fullName || 'Anonim'}
          </span>
          <ReliabilityBadge score={app.candidate?.reliabilityScore} />
        </div>
        <div className="type-caption flex items-center gap-2 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          <span className="truncate">{app.listing?.title || '—'}</span>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span className="flex-shrink-0">{relative}</span>
        </div>
      </div>
      <StatusBadge status={app.status} />
    </motion.div>
  )
}

const STATUS_DOT = {
  PENDING:   '#c8923a',
  REVIEWING: '#6b8aa3',
  HELD:      '#a17b3f',
  ACCEPTED:  '#7a9f7a',
  REJECTED:  '#b46a55',
}
const STATUS_LABEL = {
  PENDING: 'yeni başvuru', REVIEWING: 'inceleniyor', HELD: 'beklemede',
  ACCEPTED: 'kabul', REJECTED: 'red',
}
