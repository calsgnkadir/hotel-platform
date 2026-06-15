// FAZ 5.2 — CandidateDashboard'dan ayrildi (Gecmis Islerim — #78)
import { useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import EmptyState from '../../../components/EmptyState'
import ReviewModal from '../../../components/ReviewModal'
import { totalHoursForApplication } from '../../../utils/shifts'
import { POSITION_LABELS } from '../../../utils/labels'

export default function HistoryTab({ applications, onOpenMessages }) {
  const [reviewTarget, setReviewTarget] = useState(null)

  // Sadece kabul edilmis + calisma tamamlanmis basvurular
  const completed = applications
    .filter(a => a.status === 'ACCEPTED' && a.workCompleted)
    .sort((a, b) => {
      const ad = (a.requestedSlots?.[0]?.date) || a.createdAt
      const bd = (b.requestedSlots?.[0]?.date) || b.createdAt
      return (bd || '').localeCompare(ad || '')
    })

  const totalHours = completed.reduce((s, a) => s + totalHoursForApplication(a), 0)
  const uniqueBusinesses = new Set(completed.map(a => a.listing?.businessId)).size
  const reviewedCount = completed.filter(a => a.candidateReviewedBusiness).length

  if (completed.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="history"
          title="Geçmiş işin yok"
          description="İlk vardiyanı tamamladıktan sonra geçmişin burada birikir:"
          steps={[
            { label: 'Başvurun kabul edilsin',  hint: 'Başvurularım sekmesinden takip et' },
            { label: 'Vardiya günü geç',         hint: 'Saat + tarih otomatik kayda alınır' },
            { label: 'İşletmeyi puanla',         hint: 'Burada toplam saat + verdiğin puanlar görünür' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="stat-card !p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
            <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold">Toplam Çalışma</span>
          </div>
          <div className="text-xl font-black text-white leading-none">{totalHours.toFixed(0)}<span className="text-sm font-bold text-ink-400">sa</span></div>
        </div>
        <div className="stat-card !p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold">Farklı İşletme</span>
          </div>
          <div className="text-xl font-black text-white leading-none">{uniqueBusinesses}</div>
        </div>
        <div className="stat-card !p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold">Verilen Puan</span>
          </div>
          <div className="text-xl font-black text-white leading-none">{reviewedCount}<span className="text-sm font-bold text-ink-400">/{completed.length}</span></div>
        </div>
      </div>

      <div className="space-y-3">
        {completed.map(app => {
          const hours = totalHoursForApplication(app)
          const slotDates = (app.requestedSlots || [])
            .map(s => s.date).filter(Boolean).sort()
          const firstDate = slotDates[0]
          const lastDate = slotDates[slotDates.length - 1]
          const dateLabel = !firstDate
            ? '—'
            : firstDate === lastDate
              ? new Date(firstDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
              : `${new Date(firstDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} → ${new Date(lastDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`

          return (
            <div key={app.id} className="card">
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-cream-100 dark:bg-ink-700 border border-cream-300 dark:border-ink-700">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         strokeWidth={1.5} stroke="currentColor"
                         className="w-6 h-6 text-ink-400 dark:text-ink-500">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-ink-800 dark:text-ink-900 truncate">{app.listing?.title}</div>
                    <div className="text-xs text-ink-500 mt-0.5">{app.listing?.businessName}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                      <span className="text-ink-600">{dateLabel}</span>
                      <span className="text-ink-600">{hours.toFixed(1)} saat</span>
                      <span className="text-ink-600">{POSITION_LABELS[app.listing?.position] || app.listing?.position}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {app.candidateReviewedBusiness ? (
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-brand-50 text-brand-700 inline-flex items-center gap-1">
                      Puanladın
                    </span>
                  ) : (
                    <button onClick={() => setReviewTarget({
                        id: app.id,
                        title: app.listing?.businessName || 'İşletme',
                      })}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
                      Puanla
                    </button>
                  )}
                  {app.listing?.businessOwnerId && (
                    <button
                      onClick={async () => {
                        try {
                          await hotelApi.startConversation({
                            otherPartyId: app.listing.businessOwnerId,
                            applicationId: app.id,
                          })
                          onOpenMessages?.()
                        } catch (err) { toast.error(extractErrorMessage(err)) }
                      }}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors font-medium">
                      Mesaj
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {reviewTarget && (
        <ReviewModal
          applicationId={reviewTarget.id}
          title={reviewTarget.title}
          onClose={() => setReviewTarget(null)}
          onSuccess={() => setReviewTarget(null)} />
      )}
    </div>
  )
}
