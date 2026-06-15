// FAZ 5.2 — CandidateDashboard'dan ayrildi
import StatusBadge from '../../../components/candidate/StatusBadge'
import EarningsWidget from '../../../components/candidate/EarningsWidget'

export default function OverviewTab({ user, applications, onTabChange }) {
  const accepted = applications.filter(a => a.status === 'ACCEPTED').length
  const pending  = applications.filter(a => a.status === 'PENDING').length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: 'Başvuru',  value: applications.length, dot: 'bg-blue-400' },
          { label: 'Bekleyen', value: pending,             dot: 'bg-amber-400' },
          { label: 'Kabul',    value: accepted,            dot: 'bg-brand-500' },
        ].map(s => (
          <div key={s.label} className="stat-card !p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold">{s.label}</span>
            </div>
            <div className="text-xl font-black text-white leading-none">{s.value}</div>
          </div>
        ))}
      </div>

      <EarningsWidget applications={applications} />

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'İlanları Keşfet',  tab: 'listings',     desc: 'Aktif iş ilanlarına göz at',
            svg: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z' },
          { label: 'Başvurularım',     tab: 'applications', desc: 'Başvuru durumlarını takip et',
            svg: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
          { label: 'Mesajlarım',       tab: 'messages',     desc: 'İşletmelerle sohbet et',
            svg: 'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z' },
        ].map(action => (
          <button key={action.tab} onClick={() => onTabChange(action.tab)}
            className="card text-left p-3 hover:-translate-y-0.5 transition-all duration-200 w-full">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg border flex items-center justify-center flex-shrink-0"
                   style={{ background: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.25)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={1.8} stroke="currentColor" className="w-3.5 h-3.5 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d={action.svg} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[12px] truncate text-white">{action.label}</div>
                <div className="text-[10px] truncate mt-0.5" style={{ color: '#e9d5ff' }}>{action.desc}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {applications.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-ink-800 dark:text-ink-900">Son Başvurular</h2>
            <button onClick={() => onTabChange('applications')}
              className="text-xs font-medium text-brand-700 dark:text-brand-700">Tümü →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {applications.slice(0, 3).map(app => (
              <div key={app.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-ink-700">{app.listing?.title}</div>
                  <div className="text-xs text-ink-400">{app.listing?.businessName}</div>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
