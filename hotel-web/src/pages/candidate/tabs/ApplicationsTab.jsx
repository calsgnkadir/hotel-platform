// FAZ 5.2 — CandidateDashboard'dan ayrildi (god class refactor)
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import { keys } from '../../../lib/queryClient'
import EmptyState from '../../../components/EmptyState'
import ReviewModal from '../../../components/ReviewModal'
import StatusBadge, { CAND_STATUS_FILTERS } from '../../../components/candidate/StatusBadge'

const DOC_TYPE_LABELS = {
  CV: 'CV',
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  CRIMINAL_RECORD: 'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT: 'Kimlik Fotokopisi',
}

export default function ApplicationsTab({ applications: rawApplications, onRefresh, onOpenMessages, onTabChange }) {
  // Suresi gecen + tamamlanmis isler "Basvurularim"da gorunmez (Gecmis Islerim'e gider)
  const applications = (rawApplications || []).filter(a => {
    if (a.status === 'EXPIRED') return false
    if (a.workCompleted) return false
    return true
  })

  const [respondingId, setRespondingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: myDocs = [] } = useQuery({
    queryKey: keys.documents.my(),
    queryFn: () => hotelApi.getMyDocuments(),
    staleTime: 60 * 1000,
    retry: 0,
  })

  const uploadedTypes = new Set(myDocs.map(d => d.type))

  async function handleRespond(reqId, grant) {
    setRespondingId(reqId)
    try {
      await hotelApi.respondDocumentRequest(reqId, grant)
      toast.success(grant ? 'Belgeye izin verildi' : 'Talep reddedildi')
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setRespondingId(null) }
  }

  const [reviewTarget, setReviewTarget] = useState(null)

  const [withdrawingId, setWithdrawingId] = useState(null)
  async function handleWithdraw(appId) {
    if (!confirm('Bu başvuruyu iptal etmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.')) return
    setWithdrawingId(appId)
    try {
      await hotelApi.withdrawApplication(appId)
      toast.success('Başvurunuz iptal edildi')
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setWithdrawingId(null) }
  }

  const [holdRespondingId, setHoldRespondingId] = useState(null)
  async function handleHoldRespond(appId, accept) {
    const msg = accept
      ? 'Bu isi ONAYLAMAK istediginize emin misiniz?\n\nBaglayici bir kabul olusturacaktir.'
      : 'Bu HOLDU REDDETMEK istediginize emin misiniz?\n\nIsletme baska bir aday secebilir.'
    if (!confirm(msg)) return
    setHoldRespondingId(appId)
    try {
      await hotelApi.respondToHold(appId, accept)
      toast.success(accept ? 'Onaylandi! Isletmeyle iletisime devam et.' : 'HOLD reddedildi.')
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setHoldRespondingId(null) }
  }

  if (applications.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="applications"
          title="Henüz başvurunuz yok"
          description="İlanlar sekmesinden size uygun bir ilana başvurun. İlk başvurunuz dakikalar içinde işverene ulaşır."
          ctaLabel="İlanları Keşfet"
          onCta={() => onTabChange?.('listings')}
        />
      </div>
    )
  }

  const filtered = statusFilter
    ? applications.filter(a => a.status === statusFilter)
    : applications

  return (
    <div className="space-y-3">
      {/* Status filtre pill'leri */}
      <div className="flex gap-1.5 flex-wrap">
        {CAND_STATUS_FILTERS.map(f => {
          const count = f.value ? applications.filter(a => a.status === f.value).length : applications.length
          return (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${statusFilter === f.value
                  ? 'text-white shadow-sm'
                  : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
              style={statusFilter === f.value ? { background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' } : {}}>
              {f.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            type="applications"
            title="Bu filtrede başvuru yok"
            description="Farklı bir durum seçerek diğer başvurularını görebilirsin."
            ctaLabel="Tümünü Göster"
            onCta={() => setStatusFilter('')}
            compact
          />
        </div>
      ) : filtered.map(app => (
        <div key={app.id} className="card">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-cream-100 dark:bg-ink-700 border border-cream-300 dark:border-ink-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     strokeWidth={1.5} stroke="currentColor"
                     className="w-6 h-6 text-ink-400 dark:text-ink-500">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-ink-800 dark:text-ink-900">{app.listing?.title}</div>
                <div className="text-xs text-ink-500 mt-0.5">{app.listing?.businessName}</div>
                <div className="text-xs text-ink-400 mt-1">
                  {new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={app.status} />
              {app.status === 'HELD' && (
                <div className="flex flex-col items-end gap-1.5">
                  {app.holdDeadline && (
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      {new Date(app.holdDeadline).toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  )}
                  <div className="flex gap-1.5">
                    <button onClick={() => handleHoldRespond(app.id, true)}
                      disabled={holdRespondingId === app.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                      Onayla
                    </button>
                    <button onClick={() => handleHoldRespond(app.id, false)}
                      disabled={holdRespondingId === app.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
                      Reddet
                    </button>
                  </div>
                </div>
              )}
              {(app.status === 'PENDING' || app.status === 'REVIEWING') && (
                <button onClick={() => handleWithdraw(app.id)}
                  disabled={withdrawingId === app.id}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium disabled:opacity-50">
                  {withdrawingId === app.id ? 'İptal ediliyor...' : 'İptal Et'}
                </button>
              )}
              {(app.status === 'PENDING' || app.status === 'REVIEWING' || app.status === 'ACCEPTED') && (
                <button onClick={() => onOpenMessages?.(app.conversationId)}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white transition-all flex items-center gap-1"
                  style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  Mesajlaşma
                </button>
              )}
              {app.status === 'ACCEPTED' && (
                app.workCompleted ? (
                  <button onClick={() => setReviewTarget({
                      id: app.id,
                      title: app.listing?.businessName || 'İşletme',
                    })}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
                    Puanla
                  </button>
                ) : (
                  <span className="text-[10px] text-ink-400 italic"
                    title="Vardiya günü geçince puanlayabilirsiniz">
                    Çalışma sonrası puanlanır
                  </span>
                )
              )}
            </div>
          </div>

          {app.note && (
            <div className="px-4 pb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                <span className="font-medium">İşletme Notu:</span> {app.note}
              </div>
            </div>
          )}

          {app.documentRequests?.length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Belge Talepleri</div>
              <div className="space-y-2">
                {app.documentRequests.map(dr => {
                  const label = DOC_TYPE_LABELS[dr.documentType] || dr.documentType
                  const isPending = dr.status === 'PENDING'
                  const hasUploaded = uploadedTypes.has(dr.documentType)
                  return (
                    <div key={dr.id}
                      className={`rounded-lg px-3 py-2.5 ${isPending ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800' : 'bg-cream-50'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm text-ink-700 font-medium">{label}</span>
                        {!isPending && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            dr.status === 'GRANTED' ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {dr.status === 'GRANTED' ? 'İzin Verdin' : 'Reddettin'}
                          </span>
                        )}
                      </div>
                      {isPending && (
                        <>
                          {!hasUploaded && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
                              Bu belgeyi henüz yüklemedin. <b>Belgelerim</b> sekmesinden yükledikten sonra izin verebilirsin.
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleRespond(dr.id, true)}
                              disabled={respondingId === dr.id || !hasUploaded}
                              title={!hasUploaded ? 'Önce bu belgeyi yükle' : ''}
                              className="flex-1 py-1.5 rounded-md bg-brand-700 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                              İzin Ver
                            </button>
                            <button onClick={() => handleRespond(dr.id, false)}
                              disabled={respondingId === dr.id}
                              className="flex-1 py-1.5 rounded-md bg-cream-200 hover:bg-cream-300 text-ink-700 text-xs font-semibold transition-colors disabled:opacity-50">
                              Reddet
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}

      {reviewTarget && (
        <ReviewModal
          applicationId={reviewTarget.id}
          title={reviewTarget.title}
          onClose={() => setReviewTarget(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}
