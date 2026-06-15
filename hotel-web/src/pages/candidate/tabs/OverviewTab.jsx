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

      {/* Quick actions — ikonsuz, sade text + alt ince mor cizgi + sag chevron */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { num: '01', label: 'İlanları Keşfet',  tab: 'listings',     desc: 'Aktif iş ilanlarına göz at' },
          { num: '02', label: 'Başvurularım',     tab: 'applications', desc: 'Başvuru durumlarını takip et' },
          { num: '03', label: 'Mesajlarım',       tab: 'messages',     desc: 'İşletmelerle sohbet et' },
        ].map(action => (
          <button key={action.tab} onClick={() => onTabChange(action.tab)}
            className="card group text-left p-5 hover:-translate-y-1 transition-all duration-200 w-full">
            <div className="flex items-baseline justify-between mb-3">
              <span className="font-bebas text-2xl tracking-[0.25em]" style={{ color: '#7c3aed' }}>
                {action.num}
              </span>
              <span className="text-lg transition-transform group-hover:translate-x-1" style={{ color: '#e879f9' }}>→</span>
            </div>
            <div className="font-bebas text-xl tracking-wider uppercase text-white">{action.label}</div>
            <div className="text-[11px] mt-1" style={{ color: '#a5b4fc' }}>{action.desc}</div>
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
