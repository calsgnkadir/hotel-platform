import { StatusBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'  // FAZ 5.6
import TodayWidget from '../components/TodayWidget'  // FAZ 5.12

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

        {/* Stat strip — sade 4'lu + sparkline */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { label: 'Toplam',      value: applications.length, dot: 'bg-blue-400',  color: '#60a5fa',
              data: weeklyTrend(applications, null) },
            { label: 'Bekleyen',    value: pending,             dot: 'bg-amber-400', color: '#fbbf24',
              data: weeklyTrend(applications, a => a.status === 'PENDING') },
            { label: 'İnceleniyor', value: reviewing,           dot: 'bg-brand-400', color: '#f7c43c',
              data: weeklyTrend(applications, a => a.status === 'REVIEWING') },
            { label: 'Kabul',       value: accepted,            dot: 'bg-brand-500', color: '#d4a853',
              data: weeklyTrend(applications, a => a.status === 'ACCEPTED') },
          ].map(s => (
            <div key={s.label} className="stat-card !p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold truncate">{s.label}</span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="text-xl font-black text-white leading-none">{s.value}</div>
                <Sparkline data={s.data} color={s.color} width={56} height={24} />
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-ink-800 dark:text-ink-900">Son Başvurular</h2>
            <button onClick={() => onTabChange('applications')}
              className="text-xs font-medium text-brand-700 dark:text-brand-700">Tümünü Gör</button>
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
            <div className="table-container rounded-none border-0 border-t border-cream-200">
              <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '38%' }} />
                  <col className="hidden md:table-column" style={{ width: '24%' }} />
                  <col style={{ width: '22%' }} />
                  <col className="hidden sm:table-column" style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(212, 168, 83, 0.18)' }}>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: 'rgba(229, 231, 235, 0.65)' }}>Aday</th>
                    <th className="hidden md:table-cell text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: 'rgba(229, 231, 235, 0.65)' }}>İlan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: 'rgba(229, 231, 235, 0.65)' }}>Durum</th>
                    <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest"
                        style={{ color: 'rgba(229, 231, 235, 0.65)' }}>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.slice(0, 5).map((app, i, arr) => (
                    <tr key={app.id}
                        style={{ borderBottom: i === arr.length - 1 ? 'none' : '1px solid rgba(212, 168, 83, 0.08)' }}>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold truncate" style={{ color: '#dde7f3' }}>
                          {app.candidate?.fullName || 'Anonim'}
                        </div>
                        <div className="text-[11px] truncate mt-0.5"
                             style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
                          {app.candidate?.email}
                        </div>
                      </td>
                      <td className="hidden md:table-cell px-4 py-3.5 truncate"
                          style={{ color: 'rgba(229, 231, 235, 0.75)' }}>
                        {app.listing?.title || '—'}
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={app.status} /></td>
                      <td className="hidden sm:table-cell px-4 py-3.5 text-[12px]"
                          style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
                        {new Date(app.createdAt).toLocaleDateString('tr-TR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
           style={{ borderColor: 'rgba(212, 168, 83, 0.18)' }}>
        <h3 className="font-bebas text-base tracking-[0.2em] uppercase"
            style={{ color: '#fde9a5' }}>Bugünkü Akış</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(229, 231, 235, 0.50)' }}>{recent.length} olay</span>
      </div>

      {recent.length === 0 ? (
        <p className="text-center text-xs py-6" style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
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
                        background:   STATUS_DOT[app.status] || '#8ba9d2',
                        boxShadow: `0 0 8px ${STATUS_DOT[app.status] || '#8ba9d2'}`,
                      }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: '#dde7f3' }}>
                    {app.candidate?.fullName || 'Aday'}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
                    {app.listing?.title || 'İlan'} · {STATUS_LABEL[app.status] || app.status}
                  </p>
                </div>
                <span className="text-[10px] flex-shrink-0 mt-0.5"
                      style={{ color: 'rgba(229, 231, 235, 0.38)' }}>
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

const STATUS_DOT = {
  PENDING:   '#fbbf24',
  REVIEWING: '#22d3ee',
  HELD:      '#f97316',
  ACCEPTED:  '#22c55e',
  REJECTED:  '#ef4444',
}
const STATUS_LABEL = {
  PENDING: 'yeni başvuru', REVIEWING: 'inceleniyor', HELD: 'beklemede',
  ACCEPTED: 'kabul', REJECTED: 'red',
}
