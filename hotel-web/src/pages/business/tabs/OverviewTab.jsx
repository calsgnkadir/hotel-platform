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

        {/* Stat strip — gradient + glow blob + hover lift (B: dark concierge) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Toplam',      value: applications.length, color: '#60a5fa',
              data: weeklyTrend(applications, null) },
            { label: 'Bekleyen',    value: pending,             color: '#c8923a',
              data: weeklyTrend(applications, a => a.status === 'PENDING') },
            { label: 'İnceleniyor', value: reviewing,           color: '#f7c43c',
              data: weeklyTrend(applications, a => a.status === 'REVIEWING') },
            { label: 'Kabul',       value: accepted,            color: '#d4a853',
              data: weeklyTrend(applications, a => a.status === 'ACCEPTED') },
          ].map(s => (
            <motion.div key={s.label}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              className="relative overflow-hidden rounded-2xl p-3.5 min-h-[88px] group"
              style={{
                background: 'linear-gradient(155deg, rgba(27, 24, 21, 0.88) 0%, rgba(13, 11, 9, 0.96) 100%)',
                border: `1px solid ${s.color}22`,
                boxShadow: '0 8px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
              }}>
              <div aria-hidden className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none transition-opacity duration-500 opacity-35 group-hover:opacity-70"
                   style={{ background: `radial-gradient(circle, ${s.color}55 0%, transparent 65%)`, filter: 'blur(18px)' }} />
              <div className="relative flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
                <span className="text-[10px] uppercase tracking-widest font-semibold truncate"
                      style={{ color: '#928678' }}>{s.label}</span>
              </div>
              <div className="relative flex items-end justify-between gap-2">
                <div className="text-2xl font-semibold leading-none tabular-nums"
                     style={{
                       background: `linear-gradient(135deg, #ffffff 30%, ${s.color} 100%)`,
                       WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                       letterSpacing: '-0.03em',
                       filter: `drop-shadow(0 0 12px ${s.color}55)`,
                     }}>{s.value}</div>
                <Sparkline data={s.data} color={s.color} width={56} height={24} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-2xl"
             style={{
               background: 'linear-gradient(135deg, rgba(27, 24, 21, 0.75) 0%, rgba(13, 11, 9, 0.92) 100%)',
               border: '1px solid rgba(205, 183, 143, 0.10)',
               boxShadow: '0 10px 32px rgba(0,0,0,0.30)',
             }}>
          <div aria-hidden className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(205, 183, 143, 0.22), transparent 70%)', filter: 'blur(24px)' }} />
          <div className="relative px-5 py-3.5 flex items-center justify-between"
               style={{ borderBottom: '1px solid rgba(205, 183, 143, 0.08)' }}>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
                Son Başvurular
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(139, 169, 210, 0.65)' }}>
                En son {Math.min(5, applications.length)} başvuru
              </p>
            </div>
            <motion.button
              whileHover={{ x: 3 }}
              onClick={() => onTabChange('applications')}
              className="text-[12px] font-medium"
              style={{ color: '#cdb78f' }}>
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
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3 pb-2 border-b"
           style={{ borderColor: 'rgba(205, 183, 143, 0.10)' }}>
        <h3 className="font-bebas text-base tracking-[0.2em] uppercase"
            style={{ color: '#cdb78f' }}>Bugünkü Akış</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: '#6b6358' }}>{recent.length} olay</span>
      </div>

      {recent.length === 0 ? (
        <p className="text-center text-xs py-6" style={{ color: '#6b6358' }}>
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
                  <p className="text-[13px] font-medium truncate" style={{ color: '#dde7f3' }}>
                    {app.candidate?.fullName || 'Aday'}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: '#6b6358' }}>
                    {app.listing?.title || 'İlan'} · {STATUS_LABEL[app.status] || app.status}
                  </p>
                </div>
                <span className="text-[10px] flex-shrink-0 mt-0.5"
                      style={{ color: '#6b6358' }}>
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
      className="relative px-5 py-3 flex items-center gap-3 group cursor-pointer"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(205, 183, 143, 0.05)' }}>
      <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: `linear-gradient(180deg, ${accent}, ${accent}80)`,
                     boxShadow: `0 0 10px ${accent}66` }} />
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
          <span className="text-[14px] font-medium truncate" style={{ color: '#ffffff', letterSpacing: '-0.005em' }}>
            {app.candidate?.fullName || 'Anonim'}
          </span>
          <ReliabilityBadge score={app.candidate?.reliabilityScore} />
        </div>
        <div className="text-[11.5px] flex items-center gap-2 mt-0.5" style={{ color: 'rgba(139, 169, 210, 0.75)' }}>
          <span className="truncate">{app.listing?.title || '—'}</span>
          <span style={{ color: 'rgba(139, 169, 210, 0.4)' }}>·</span>
          <span className="flex-shrink-0">{relative}</span>
        </div>
      </div>
      <StatusBadge status={app.status} />
    </motion.div>
  )
}

const STATUS_DOT = {
  PENDING:   '#c8923a',
  REVIEWING: '#22d3ee',
  HELD:      '#f97316',
  ACCEPTED:  '#22c55e',
  REJECTED:  '#ef4444',
}
const STATUS_LABEL = {
  PENDING: 'yeni başvuru', REVIEWING: 'inceleniyor', HELD: 'beklemede',
  ACCEPTED: 'kabul', REJECTED: 'red',
}
