import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import { shiftHoursBiz } from '../lib/helpers'
import EmptyState from '../../../components/EmptyState'
import AvatarCluster from '../../../components/AvatarCluster'  // FAZ 5.14
import cldImg, { ImgSize } from '../../../lib/cldImg'
import ReliabilityBadge from '../../../components/ReliabilityBadge'
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'  // FAZ D1

/* ── Workers Tab (#78) — Bizde çalışan adaylar ── */
export default function WorkersTab({ applications, onOpenMessages }) {
  // Aday başına grupla: { candidateId -> { candidate, totalHours, jobCount, lastDate, applications[] } }
  const completed = applications.filter(a => a.status === 'ACCEPTED' && a.workCompleted)

  const grouped = {}
  for (const app of completed) {
    const cid = app.candidate?.id
    if (!cid) continue
    if (!grouped[cid]) {
      grouped[cid] = {
        candidate: app.candidate,
        totalHours: 0,
        jobCount: 0,
        lastDate: null,
        apps: [],
      }
    }
    const g = grouped[cid]
    g.jobCount++
    g.apps.push(app)
    for (const s of app.requestedSlots || []) {
      g.totalHours += shiftHoursBiz(s.startTime, s.endTime)
      if (s.date && (!g.lastDate || s.date > g.lastDate)) g.lastDate = s.date
    }
  }

  const workers = Object.values(grouped).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))

  if (workers.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="workers"
          title="Bizde çalışan yok"
          description="3 adımda ekibinin geçmişi burada birikir:"
          steps={[
            { label: 'Adayı KABUL et',         hint: 'Gelen Başvurular > Kanban\'da kartı "Kabul" kolonuna sürükle' },
            { label: 'Vardiya günü geçsin',    hint: 'Sistem aday için saat + tarih otomatik hesaplar' },
            { label: 'Burada görünür',         hint: 'Toplam saat, kaç vardiya, son çalışma tarihi' },
          ]}
        />
      </div>
    )
  }

  const totalHours = workers.reduce((s, w) => s + w.totalHours, 0)

  // FAZ 5.14 — avatar cluster için worker -> AvatarCluster item formatına çevir
  const clusterItems = workers.map(w => ({
    id: w.candidate?.id,
    name: w.candidate?.fullName,
    avatarUrl: w.candidate?.avatarUrl,
  }))

  return (
    <div className="space-y-4">
      {/* FAZ 5.14 — Ekip vitrin satırı: avatar cluster + sayım */}
      <div className="p-5 flex items-center justify-between gap-4 flex-wrap"
           style={{
             background: '#ffffff',
             borderRadius: '28px 12px 28px 12px',
             border: 'none',
             boxShadow: '0 14px 36px rgba(0,0,0,0.30), inset 0 1px 0 rgba(245,239,226,0.03)',
           }}>
        <div className="flex items-center gap-4">
          <AvatarCluster items={clusterItems} size={40} max={5} showOnlineDot />
          <div>
            <div className="text-[16px] font-semibold" style={{ color: '#12201f', letterSpacing: '-0.015em' }}>
              {workers.length} kişilik ekip
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: '#6b7574' }}>
              yeşil nokta = şu an çevrimiçi
            </div>
          </div>
        </div>
        <div className="tabular-nums"
             style={{
               color: '#0f766e',
               fontSize: '28px',
               fontWeight: 600,
               letterSpacing: '-0.03em',
               lineHeight: 1,
               filter: 'drop-shadow(0 0 14px rgba(15, 118, 110, 0.30))',
             }}>
          {totalHours.toFixed(0)} <span className="text-[10px] font-medium uppercase tracking-[0.22em] ml-1" style={{ color: '#6b7574' }}>SAAT</span>
        </div>
      </div>

      {/* Özet */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-bold text-ink-900">{workers.length}</div>
              <div className="text-xs text-ink-500 mt-0.5">Farklı Aday Çalıştı</div>
            </div>
            {/* FAZ D1 — son 8 hafta yeni iseaccept trend */}
            <Sparkline data={weeklyTrend(applications, a => a.status === 'ACCEPTED')}
                       color="#10b981" width={56} height={24} />
          </div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-2xl font-bold text-ink-900">{totalHours.toFixed(0)}<span className="text-base">sa</span></div>
              <div className="text-xs text-ink-500 mt-0.5">Toplam İş Saati</div>
            </div>
            {/* FAZ D1 — son 8 hafta toplam başvuru trendi (yoğunluk göstergesi) */}
            <Sparkline data={weeklyTrend(applications, null)}
                       color="#0f766e" width={56} height={24} />
          </div>
        </div>
      </div>

      {/* Aday listesi */}
      <div className="space-y-3">
        {workers.map(w => (
          <div key={w.candidate.id} className="card">
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {w.candidate?.avatarUrl ? (
                  <img src={cldImg(w.candidate.avatarUrl, { w: ImgSize.avatarSm })} alt={w.candidate.fullName}
                    loading="lazy" decoding="async"
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-cream-300" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                       style={{
                         background: 'rgba(15, 118, 110, 0.08)',
                         border: '1px solid rgba(15, 118, 110, 0.22)',
                         color: '#0f766e',
                       }}>
                    {w.candidate?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-800 dark:text-ink-900 truncate">{w.candidate?.fullName}</span>
                    <ReliabilityBadge score={w.candidate?.reliabilityScore} />
                  </div>
                  <div className="text-xs text-ink-500 mt-0.5">{w.candidate?.email}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                    <span className="text-ink-600">{w.totalHours.toFixed(1)} saat</span>
                    <span className="text-ink-600">{w.jobCount} iş</span>
                    {w.lastDate && (
                      <span className="text-ink-600">
                        Son: {new Date(w.lastDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await hotelApi.startConversation({ otherPartyId: w.candidate.id })
                    onOpenMessages?.()
                  } catch (err) { toast.error(extractErrorMessage(err)) }
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors font-medium flex-shrink-0">
                Mesaj
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
