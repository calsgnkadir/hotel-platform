import { motion } from 'framer-motion'
import { StatusBadge, NoShowBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import TodayWidget from '../components/TodayWidget'  // FAZ 5.12
import { getStatusMeta } from '../../../lib/applicationStatus'

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
            { label: 'Toplam',       value: applications.length },
            { label: getStatusMeta('PENDING', 'business').label,   value: pending },
            { label: getStatusMeta('REVIEWING', 'business').label, value: reviewing },
            { label: getStatusMeta('ACCEPTED', 'business').label,  value: accepted },
          ].map(s => (
            <motion.div key={s.label}
              whileHover={{ y: -3 }}
              transition={{ type: 'spring', stiffness: 240, damping: 22 }}
              className="stat-card group cursor-default"
            >
              {/* Durum dili paketi — ust renk seritleri kaldirildi: KPI karti durum
                  degil sayi; renk yalniz eylem gerektiren rozette. */}
              {/* Number → hairline → label */}
              <div className="relative">
                <div className="stat-card-number">
                  {s.value}
                </div>
                <div className="stat-card-divider" />
                <div className="stat-card-label">{s.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="tier-raised relative overflow-hidden">
          <div className="relative px-5 py-3.5 flex items-center justify-between border-b border-hairline">
            <div>
              <h2 className="type-card">
                Son başvurular
              </h2>
              <p className="type-meta mt-0.5">
                En son {Math.min(5, applications.length)} başvuru
              </p>
            </div>
            <button
              type="button"
              onClick={() => onTabChange('applications')}
              className="btn-ghost">
              Tümünü gör
            </button>
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
              ctaLabel="İlanlarıma git"
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
        <h3 className="type-card">Bugünkü akış</h3>
        <span className="type-meta">{recent.length} olay</span>
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
                      style={{ background: 'var(--ah-line-2)' }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="type-body font-medium truncate">
                    {app.candidate?.fullName || 'Aday'}
                  </p>
                  <p className="type-meta truncate">
                    {app.listing?.title || 'İlan'} · {getStatusMeta(app.status, 'business', { standbyOfferActive: app.standbyOfferActive }).label}
                  </p>
                </div>
                <span className="type-meta flex-shrink-0 mt-0.5">
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

/* Son başvurular satırı — tek durum rozeti (sözlükten, işletme bakışı); sol şerit yok */
function BizRecentRow({ app, last, onClick }) {
  const days = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400_000)
  const relative = days === 0 ? 'bugün' : days === 1 ? 'dün' : `${days} gün önce`
  return (
    <motion.div onClick={onClick}
      whileHover={{ x: 3 }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      className="relative px-4 sm:px-5 py-3 flex items-center gap-3 group cursor-pointer"
      style={{ borderBottom: last ? 'none' : '1px solid var(--ah-line)' }}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold flex-shrink-0"
           style={{
             background: 'linear-gradient(135deg, rgba(31, 41, 55, 0.08), rgba(31, 41, 55, 0.06))',
             border: '1px solid rgba(31, 41, 55, 0.22)',
             color: '#1f2937',
           }}>
        {(app.candidate?.fullName || '?').charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="type-body font-medium truncate" style={{ color: 'var(--text-headline)' }}>
            {app.candidate?.fullName || 'Anonim'}
          </span>
        </div>
        <div className="type-meta flex items-center gap-2 mt-0.5">
          <span className="truncate">{app.listing?.title || '—'}</span>
          <span style={{ color: 'var(--text-faint)' }}>·</span>
          <span className="flex-shrink-0">{relative}</span>
        </div>
      </div>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        <StatusBadge status={app.status} standbyOfferActive={app.standbyOfferActive} />
        {app.noShow && <NoShowBadge />}
      </span>
    </motion.div>
  )
}
