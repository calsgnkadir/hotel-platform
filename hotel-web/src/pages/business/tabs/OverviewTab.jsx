import { StatusBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'  // FAZ 5.6
import TodayWidget from '../components/TodayWidget'  // FAZ 5.12

/* ── Overview Tab ── */
export default function OverviewTab({ applications, onTabChange }) {
  const pending   = applications.filter(a => a.status === 'PENDING').length
  const reviewing = applications.filter(a => a.status === 'REVIEWING').length
  const accepted  = applications.filter(a => a.status === 'ACCEPTED').length

  return (
    <div className="space-y-4">
      {/* FAZ 5.12 — Bugun widget tepelik */}
      <TodayWidget applications={applications} onTabChange={onTabChange} />

      {/* Stat strip — sade 4'lu + sparkline */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Toplam',      value: applications.length, dot: 'bg-blue-400',  color: '#60a5fa',
            data: weeklyTrend(applications, null) },
          { label: 'Bekleyen',    value: pending,             dot: 'bg-amber-400', color: '#fbbf24',
            data: weeklyTrend(applications, a => a.status === 'PENDING') },
          { label: 'İnceleniyor', value: reviewing,           dot: 'bg-brand-400', color: '#c084fc',
            data: weeklyTrend(applications, a => a.status === 'REVIEWING') },
          { label: 'Kabul',       value: accepted,            dot: 'bg-brand-500', color: '#a855f7',
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
            className="text-xs font-medium text-brand-700 dark:text-brand-700">Tümünü Gör →</button>
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
            <table className="table">
              <thead>
                <tr>
                  <th>Aday</th>
                  <th className="hidden md:table-cell">İlan</th>
                  <th>Durum</th>
                  <th className="hidden sm:table-cell">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 5).map(app => (
                  <tr key={app.id}>
                    <td>
                      <div className="font-medium text-ink-800 dark:text-ink-900">{app.candidate?.fullName}</div>
                      <div className="text-xs text-ink-400">{app.candidate?.email}</div>
                    </td>
                    <td className="hidden md:table-cell text-ink-600 text-sm">{app.listing?.title}</td>
                    <td><StatusBadge status={app.status} /></td>
                    <td className="hidden sm:table-cell text-ink-500 text-xs">
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
  )
}
