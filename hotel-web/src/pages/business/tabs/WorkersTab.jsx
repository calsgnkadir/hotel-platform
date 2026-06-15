import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import { shiftHoursBiz } from '../lib/helpers'
import EmptyState from '../../../components/EmptyState'
import cldImg, { ImgSize } from '../../../lib/cldImg'

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

  return (
    <div className="space-y-4">
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
          <div className="text-2xl font-bold text-ink-900">{workers.length}</div>
          <div className="text-xs text-ink-500 mt-0.5">Farklı Aday Çalıştı</div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-ink-900">{totalHours.toFixed(0)}<span className="text-base">sa</span></div>
          <div className="text-xs text-ink-500 mt-0.5">Toplam İş Saati</div>
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
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                    {w.candidate?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-ink-800 dark:text-ink-900 truncate">{w.candidate?.fullName}</div>
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
