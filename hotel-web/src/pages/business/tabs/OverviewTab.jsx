import { Link } from 'react-router-dom'
import { StatusBadge, NoShowSummaryBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import TodayWidget, { businessLink } from '../components/TodayWidget'
import { isFullyNoShow } from '../../../lib/shiftTime'
import { NavIcon } from '../../../components/DashboardLayout'

const DAY = 86_400_000
const RECENT_LIMIT = 6

/**
 * İşletme Genel bakış (Paket 5):
 *   1) Yapılacaklar — tek eylem kartı (TodayWidget)
 *   2) KPI şeridi — 4 sayı; Yapılacaklar'daki sayıları TEKRARLAMAZ.
 *      Her kart ilgili sekmeye bağlantı (etiket üstte, sayı altta).
 *   3) Son hareketler — eski "Son başvurular" + "Bugünkü akış" tek listede;
 *      her satır başvuruya derin bağlantı (?tab=applications&id=)
 * Düzen: mobil/tablet tek sütun (Yapılacaklar → KPI → Son hareketler);
 * xl'de iki sütun — solda Son hareketler, sağda Yapılacaklar + 2x2 KPI.
 */
export function overviewKpis(applications = [], now = new Date()) {
  const weekAgo = now.getTime() - 7 * DAY
  return [
    { key: 'total',     label: 'Toplam başvuru',  icon: 'inbox',    to: businessLink({ tab: 'applications' }),
      value: applications.length },
    { key: 'week',      label: 'Son 7 günde gelen', icon: 'trending', to: businessLink({ tab: 'applications' }),
      value: applications.filter(a => new Date(a.createdAt).getTime() >= weekAgo).length },
    { key: 'accepted',  label: 'Kabul edilen',    icon: 'users',    to: businessLink({ tab: 'applications', status: 'ACCEPTED' }),
      value: applications.filter(a => a.status === 'ACCEPTED' && !isFullyNoShow(a)).length },
    { key: 'completed', label: 'Tamamlanan iş',   icon: 'activity', to: businessLink({ tab: 'team' }),
      value: applications.filter(a => a.status === 'ACCEPTED' && a.workCompleted && !isFullyNoShow(a)).length },
  ]
}

function relativeTime(iso, now = Date.now()) {
  const diff = now - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'az önce'
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} sa önce`
  const d = Math.floor(h / 24)
  if (d === 1) return 'dün'
  if (d < 7) return `${d} gün önce`
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function OverviewTab({ applications = [], onTabChange }) {
  const kpis = overviewKpis(applications)
  const recent = [...applications]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, RECENT_LIMIT)

  return (
    <div className="grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4 min-w-0 xl:order-2">
        <TodayWidget applications={applications} />

        <ul className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-3" data-testid="kpi-strip" aria-label="Özet sayılar">
          {kpis.map(k => (
            <li key={k.key} className="min-w-0">
              <KpiCard {...k} />
            </li>
          ))}
        </ul>
      </div>

      <section className="card !p-0 overflow-hidden min-w-0 xl:order-1" aria-labelledby="recent-title">
        <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3"
             style={{ borderBottom: '1px solid var(--ah-line)' }}>
          <h2 id="recent-title" className="type-card">Son hareketler</h2>
          {applications.length > 0 && (
            <Link to={businessLink({ tab: 'applications' })} className="btn-ghost">Tümünü gör</Link>
          )}
        </div>
        {applications.length === 0 ? (
          <EmptyState
            type="applications"
            title="Henüz başvuru yok"
            description="İlk adayını almak için:"
            steps={[
              { label: 'İlan oluştur', hint: 'Pozisyon, vardiya ve ücret bilgisi' },
              { label: 'Yayınla',      hint: 'Tercihi uyan adaylara bildirim gider' },
              { label: 'Başvuruları yönet', hint: 'Başvurular sekmesinden karar ver' },
            ]}
            ctaLabel="İlanlarıma git"
            onCta={() => onTabChange?.('mylistings')}
            compact
          />
        ) : (
          <ul>
            {recent.map((app, i) => (
              <li key={app.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--ah-line)' }}>
                <Link to={businessLink({ tab: 'applications', id: String(app.id) })}
                      className="px-4 sm:px-5 py-3 flex items-center gap-3 min-h-[56px] hover:bg-[var(--ah-band)] transition-colors">
                  <span className="w-9 h-9 rounded-full grid place-items-center type-subhead flex-shrink-0"
                        aria-hidden="true"
                        style={{ background: 'var(--ah-band)', color: 'var(--ah-ink)', border: '1px solid var(--ah-line)' }}>
                    {(app.candidate?.fullName || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="type-subhead block truncate" style={{ color: 'var(--ah-ink)' }}>
                      {app.candidate?.fullName || 'Aday'}
                    </span>
                    <span className="type-meta block truncate">
                      {app.listing?.title || 'İlan'} · {relativeTime(app.createdAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 flex-shrink-0">
                    <StatusBadge status={app.status} standbyOfferActive={app.standbyOfferActive} />
                    <NoShowSummaryBadge app={app} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

/** KPI kartı: dar kartlarda ikon üstte; etiket kesilmeden, sayı aynı hizada görünür. */
function KpiCard({ label, value, icon, to }) {
  return (
    <Link to={to}
          className="card !p-4 h-full flex flex-col lg:flex-row items-start gap-2 lg:gap-3 transition-[border-color,box-shadow] duration-150
                     hover:border-[var(--ah-line-2)] hover:shadow-[var(--elev-hover)]
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ah-brand)]">
      <span className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0"
            style={{ background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)' }}>
        <NavIcon name={icon} size={16} />
      </span>
      <span className="min-w-0 w-full lg:flex-1">
        <span className="type-meta block min-h-9 lg:min-h-0 whitespace-normal break-words">{label}</span>
        <span className="type-page type-num block mt-0.5" style={{ color: 'var(--ah-ink)' }}>{value}</span>
      </span>
    </Link>
  )
}
