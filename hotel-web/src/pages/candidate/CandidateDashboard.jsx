import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import { keys } from '../../lib/queryClient'
import ListingsPage from './ListingsPage'
import MessagesPage from '../MessagesPage'
import ProfileCompletenessCard from '../../components/ProfileCompletenessCard'
import { calculateCandidateCompleteness } from '../../lib/profileCompleteness'
import EmptyState from '../../components/EmptyState'
import { SkeletonList } from '../../components/Skeleton'
import OnboardingWizard, { shouldShowOnboarding } from '../../components/OnboardingWizard'
import AvatarCropModal from '../../components/AvatarCropModal'
import ChangePasswordCard from '../../components/ChangePasswordCard'
import ReviewModal from '../../components/ReviewModal'
import { validateTurkeyPhone, formatTurkeyPhoneInput, validateAdultAge, birthDateBounds } from '../../utils/validation'
import DistrictNeighborhoodSelect from '../../components/DistrictNeighborhoodSelect'
import { ISTANBUL_DISTRICTS } from '../../data/istanbul'
// Ayarlar + Yardım header'daki ⚙ SettingsMenu'ye taşındı (sidebar'dan kaldırıldı)
// #89 v2: Grafikler kaldırıldı (StatusDonut + MonthlyTrendBar) — sade görünüm tercih edildi

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}

const GENDER_LABELS = { MALE: 'Erkek', FEMALE: 'Kadın', OTHER: 'Diğer' }
const EDUCATION_LABELS = {
  HIGH_SCHOOL: 'Lise',
  UNIVERSITY_GRADUATE: 'Üniversite',
}
const LANGUAGE_LABELS = {
  TURKISH:  'Türkçe',  ENGLISH:  'İngilizce', GERMAN:   'Almanca',
  RUSSIAN:  'Rusça',   ARABIC:   'Arapça',    FRENCH:   'Fransızca',
  SPANISH:  'İspanyolca', ITALIAN: 'İtalyanca',
}
const AVAILABILITY_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}
const DOC_TYPE_LABELS = {
  CV: 'CV',
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  CRIMINAL_RECORD: 'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT: 'Kimlik Fotokopisi',
}
const SENSITIVE_DOC_TYPES_CAND = ['CRIMINAL_RECORD', 'HEALTH_CERTIFICATE', 'IDENTITY_DOCUMENT']

/* ── Status Badge ── */
function StatusBadge({ status }) {
  // Chat-v2: PENDING artık "mesajlaşma açık" — karar mesajdan veriliyor
  const map = {
    PENDING:   { cls: 'badge-accepted',  icon: '', label: 'Mesajlaşma açık' },
    REVIEWING: { cls: 'badge-reviewing', icon: '', label: 'İnceleniyor' },
    HELD:      { cls: 'badge-reviewing', icon: '⏳', label: 'HOLD — Cevap Bekleniyor' },  // FAZ 2/#28
    ACCEPTED:  { cls: 'badge-accepted',  icon: '', label: 'Kabul' },
    REJECTED:  { cls: 'badge-rejected',  icon: '', label: 'Red' },
    EXPIRED:   { cls: 'badge-expired',   icon: '', label: 'Süresi Doldu' },
    WITHDRAWN: { cls: 'badge-expired',   icon: '', label: 'İptal Edildi' },
  }
  const s = map[status] || { cls: 'badge-pending', icon: '?', label: status }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

// Aday başvuru status filtre seçenekleri
const CAND_STATUS_FILTERS = [
  { value: '',          label: 'Tümü' },
  { value: 'PENDING',   label: 'Bekleyen' },
  { value: 'REVIEWING', label: 'İnceleniyor' },
  { value: 'HELD',      label: 'HOLD ⏳' },   // FAZ 2/#28
  { value: 'ACCEPTED',  label: 'Kabul' },
  { value: 'REJECTED',  label: 'Red' },
  { value: 'WITHDRAWN', label: 'İptal' },
]

/* ── Applications Tab ── */
function ApplicationsTab({ applications: rawApplications, onRefresh, onOpenMessages, onTabChange }) {
  // Süresi geçen + tamamlanmış işler "Başvurularım"da görünmez (Geçmiş İşlerim'e gider)
  const applications = (rawApplications || []).filter(a => {
    if (a.status === 'EXPIRED') return false
    if (a.workCompleted) return false  // tamamlanmış: Geçmiş İşlerim'de
    return true
  })

  const [respondingId, setRespondingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [openingChatId, setOpeningChatId] = useState(null)

  // FIX: useQuery ile cache (her tab geçişinde fetch tetiklenip 429 olmasın)
  const { data: myDocs = [] } = useQuery({
    queryKey: keys.documents.my(),
    queryFn: () => hotelApi.getMyDocuments(),
    staleTime: 60 * 1000,  // 60sn cache — tab değişiminde tekrar fetch yok
    retry: 0,
  })

  async function handleStartChat(app) {
    const ownerId = app.listing?.businessOwnerId
    if (!ownerId) return toast.error('İşletme bilgisi bulunamadı')
    setOpeningChatId(app.id)
    try {
      await hotelApi.startConversation({ otherPartyId: ownerId, applicationId: app.id })
      onOpenMessages?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setOpeningChatId(null)
    }
  }

  const uploadedTypes = new Set(myDocs.map(d => d.type))

  async function handleRespond(reqId, grant) {
    setRespondingId(reqId)
    try {
      await hotelApi.respondDocumentRequest(reqId, grant)
      toast.success(grant ? 'Belgeye izin verildi' : 'Talep reddedildi')
      onRefresh?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setRespondingId(null)
    }
  }

  // R4: Yorum hedefi
  const [reviewTarget, setReviewTarget] = useState(null)

  // D6: Aday başvurusunu iptal eder
  const [withdrawingId, setWithdrawingId] = useState(null)
  async function handleWithdraw(appId) {
    if (!confirm('Bu başvuruyu iptal etmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.')) return
    setWithdrawingId(appId)
    try {
      await hotelApi.withdrawApplication(appId)
      toast.success('Başvurunuz iptal edildi')
      onRefresh?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setWithdrawingId(null)
    }
  }

  // FAZ 2/#28 — HELD basvuruya aday cevabi
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
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setHoldRespondingId(null)
    }
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

  // #84: Client-side status filtresi (aday genelde az başvuruya sahip)
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
            onCta={() => setStatusFilter(null)}
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
              {/* FAZ 2/#28 - HELD: aday Onayla / Reddet (24 saat icinde) */}
              {app.status === 'HELD' && (
                <div className="flex flex-col items-end gap-1.5">
                  {app.holdDeadline && (
                    <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      ⏳ {new Date(app.holdDeadline).toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </span>
                  )}
                  <div className="flex gap-1.5">
                    <button onClick={() => handleHoldRespond(app.id, true)}
                      disabled={holdRespondingId === app.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)' }}>
                      ✓ Onayla
                    </button>
                    <button onClick={() => handleHoldRespond(app.id, false)}
                      disabled={holdRespondingId === app.id}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-white font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)' }}>
                      ✗ Reddet
                    </button>
                  </div>
                </div>
              )}
              {/* D6: Sadece PENDING/REVIEWING başvurular iptal edilebilir.
                  ACCEPTED ise iptal yasak — backend "iletişime geçin" mesajı döner. */}
              {(app.status === 'PENDING' || app.status === 'REVIEWING') && (
                <button onClick={() => handleWithdraw(app.id)}
                  disabled={withdrawingId === app.id}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium disabled:opacity-50">
                  {withdrawingId === app.id ? 'İptal ediliyor...' : 'İptal Et'}
                </button>
              )}
              {/* Chat-v2: TÜM başvurularda "Mesajlaşmaya git" — eski ACCEPTED-only kısıtı kaldırıldı */}
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
              {/* R4 + R5: Sadece ACCEPTED + çalışma tamamlanmış başvuruda puanla */}
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

/* ── History Tab (#78) — Çalışması tamamlanmış başvurular ── */

/** İki LocalTime (HH:mm:ss veya HH:mm) arası süre saat cinsinden. */
function shiftHours(startTime, endTime) {
  if (!startTime || !endTime) return 0
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let mins = (eh * 60 + em) - (sh * 60 + sm)
  if (mins < 0) mins += 24 * 60  // gece vardiyası (örn 22:00-06:00)
  return mins / 60
}

/** Bir başvurudaki toplam çalışılan saat (slotsNeeded'a değil tek aday'a göre). */
function totalHoursForApplication(app) {
  return (app.requestedSlots || []).reduce(
    (sum, s) => sum + shiftHours(s.startTime, s.endTime), 0)
}

function HistoryTab({ applications, onOpenMessages }) {
  const [reviewTarget, setReviewTarget] = useState(null)

  // Sadece kabul edilmiş + çalışma tamamlanmış başvurular
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
          title="Henüz tamamlanmış işin yok"
          description="Kabul edilmiş bir başvurun olup vardiya günü geçtiğinde burada görünür. İlk işini bitirdiğinde toplam saatin ve değerlendirmen otomatik düşer."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Özet stat kartları — kompakt, ikon kutu yok */}
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

      {/* Çalışma listesi */}
      <div className="space-y-3">
        {completed.map(app => {
          const hours = totalHoursForApplication(app)
          const slotDates = (app.requestedSlots || [])
            .map(s => s.date)
            .filter(Boolean)
            .sort()
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

/* ── Overview Tab ── */
/**
 * FAZ 2/#31 — Aday saat/kazanc widget'i.
 * Tamamlanmis (workCompleted=true) basvurularin slot tarihlerinden
 * toplam saat hesapla; salaryType'a gore kazanc cikar.
 *  HOURLY:    hours * avg(min,max)
 *  DAILY:     slot basina avg salary (her slot=1 gun varsayim)
 *  MONTHLY:   (avg / 22 / 8) * hours  (~22 is gunu, 8 saat)
 *  NEGOTIABLE: 0 (tahmin edilemez)
 */
function EarningsWidget({ applications }) {
  const completed = applications.filter(a => a.workCompleted)
  if (completed.length === 0) return null

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart  = new Date(now.getFullYear(), 0, 1)

  let totalH = 0, monthH = 0, yearH = 0
  let totalE = 0, monthE = 0, yearE = 0

  completed.forEach(app => {
    const slots = app.requestedSlots || []
    const min = Number(app.listing?.salaryMin) || 0
    const max = Number(app.listing?.salaryMax) || min
    const avg = min && max ? (min + max) / 2 : (min || max)
    const type = app.listing?.salaryType || 'HOURLY'

    slots.forEach(s => {
      if (!s.date || !s.startTime || !s.endTime) return
      const [sH, sM] = s.startTime.split(':').map(Number)
      const [eH, eM] = s.endTime.split(':').map(Number)
      const hours = (eH + eM / 60) - (sH + sM / 60)
      if (hours <= 0) return

      const d = new Date(s.date)
      const inMonth = d >= monthStart
      const inYear  = d >= yearStart

      totalH += hours
      if (inMonth) monthH += hours
      if (inYear)  yearH  += hours

      let earned = 0
      if (type === 'HOURLY')     earned = hours * avg
      else if (type === 'DAILY') earned = avg
      else if (type === 'MONTHLY') earned = (avg / 22 / 8) * hours
      // NEGOTIABLE -> 0

      totalE += earned
      if (inMonth) monthE += earned
      if (inYear)  yearE  += earned
    })
  })

  const fmtH = h => h < 1 ? '0' : Math.round(h).toString()
  const fmtE = e => e < 1 ? '0' : Math.round(e).toLocaleString('tr-TR')

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="px-5 py-3 border-b border-cream-200 dark:border-ink-700 flex items-center justify-between">
        <h2 className="font-semibold text-ink-800 dark:text-ink-900 flex items-center gap-2">
          💼 Çalışma & Kazanç
        </h2>
        <span className="text-xs text-ink-500">{completed.length} iş</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-cream-200 dark:bg-ink-700">
        {/* Bu Ay */}
        <div className="p-3 bg-white dark:bg-ink-900">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-500 mb-1">Bu Ay</div>
          <div className="text-lg font-black text-brand-700 dark:text-brand-300">{fmtH(monthH)} sa</div>
          <div className="text-xs font-semibold text-ink-600 dark:text-ink-300 mt-0.5">{fmtE(monthE)} ₺</div>
        </div>
        {/* Bu Yıl */}
        <div className="p-3 bg-white dark:bg-ink-900">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-500 mb-1">Bu Yıl</div>
          <div className="text-lg font-black text-brand-700 dark:text-brand-300">{fmtH(yearH)} sa</div>
          <div className="text-xs font-semibold text-ink-600 dark:text-ink-300 mt-0.5">{fmtE(yearE)} ₺</div>
        </div>
        {/* Toplam */}
        <div className="p-3 bg-white dark:bg-ink-900">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-500 mb-1">Tüm Zaman</div>
          <div className="text-lg font-black text-brand-700 dark:text-brand-300">{fmtH(totalH)} sa</div>
          <div className="text-xs font-semibold text-ink-600 dark:text-ink-300 mt-0.5">{fmtE(totalE)} ₺</div>
        </div>
      </div>
      {totalE === 0 && totalH > 0 && (
        <div className="px-5 py-2 text-[11px] text-ink-500 italic">
          Not: Kazanç tutarı yalnızca ücret tipi belirtilmiş ilanlarda hesaplanır.
        </div>
      )}
    </div>
  )
}

function OverviewTab({ user, applications, onTabChange }) {
  const accepted  = applications.filter(a => a.status === 'ACCEPTED').length
  const pending   = applications.filter(a => a.status === 'PENDING').length

  // #89 cleanup: Backend stats çağrısı kaldırıldı (recharts gitti, sonucu kullanılmıyordu)
  // Kabul Oranı + Yanıt Süresi de zaten silindi. UI applications prop'undan hesaplıyor.

  return (
    <div className="space-y-4">
      {/* Stats — sade 3'lü strip (Kabul Oranı + Yanıt Süresi kaldırıldı) */}
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

      {/* FAZ 2/#31 — Calisma & Kazanc widget'i */}
      <EarningsWidget applications={applications} />

      {/* Quick Actions */}
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

      {/* Recent applications */}
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

/* ── FAZ 2/#33 — Sertifika Cüzdanı v2 ── */
const DOC_CATEGORIES = [
  {
    key: 'general',
    label: '📋 Genel',
    color: '#7e22ce',
    types: [
      { type: 'CV',                  label: 'CV / Özgeçmiş',        ext: 'PDF/DOCX', required: true  },
      { type: 'TRANSCRIPT',          label: 'Transkript',           ext: 'PDF',      required: false },
      { type: 'STUDENT_CERTIFICATE', label: 'Öğrenci Belgesi',      ext: 'PDF',      required: false },
    ],
  },
  {
    key: 'health',
    label: '🏥 Sağlık',
    color: '#dc2626',
    types: [
      { type: 'HEALTH_CERTIFICATE',  label: 'Sağlık Raporu',        ext: 'PDF/JPG',  required: false },
    ],
  },
  {
    key: 'identity',
    label: '🪪 Kimlik',
    color: '#0891b2',
    types: [
      { type: 'IDENTITY_DOCUMENT',   label: 'Kimlik Fotokopisi',    ext: 'PDF/JPG',  required: false },
      { type: 'CRIMINAL_RECORD',     label: 'Adli Sicil Kaydı',     ext: 'PDF',      required: false },
    ],
  },
]

function DocumentsTab() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingType, setUploadingType] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function loadDocs() {
    setLoading(true)
    try {
      const data = await hotelApi.getMyDocuments()
      setDocs(data || [])
    } catch { setDocs([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadDocs() }, [])

  async function handleUpload(type, file) {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Dosya boyutu 15 MB\'ı aşamaz')
      return
    }
    setUploadingType(type)
    try {
      await hotelApi.uploadDocument(file, type)
      toast.success('Belge yüklendi')
      await loadDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setUploadingType(null) }
  }

  async function handleDelete(docId, label) {
    if (!confirm(`"${label}" belgesini silmek istiyor musun?\n\nBu işlem geri alınamaz.`)) return
    setDeletingId(docId)
    try {
      await hotelApi.deleteDocument(docId)
      toast.success('Belge silindi')
      await loadDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setDeletingId(null) }
  }

  async function handleView(docId) {
    try {
      const url = await hotelApi.getDocumentUrl(docId)
      window.open(url, '_blank')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  // Tamamlanma oranı: yüklü tip sayısı / toplam tip sayısı
  const totalTypes = DOC_CATEGORIES.reduce((sum, c) => sum + c.types.length, 0)
  const uploadedTypes = new Set(docs.map(d => d.type))
  const completion = Math.round((uploadedTypes.size / totalTypes) * 100)

  if (loading) {
    return <div className="card p-8 text-center text-ink-500">Belgeler yükleniyor...</div>
  }

  return (
    <div className="space-y-4">
      {/* Header — Cüzdan başlığı + tamamlanma */}
      <div className="card p-5"
           style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)', borderColor: 'rgba(126,34,206,0.2)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black flex items-center gap-2" style={{ color: '#3b0764' }}>
              💼 Sertifika Cüzdanım
            </h2>
            <p className="text-xs mt-1" style={{ color: '#6b21a8' }}>
              Belgelerini güvenle sakla, başvurularına otomatik eklensin
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-black" style={{ color: '#7e22ce' }}>%{completion}</div>
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#6b21a8' }}>Doluluk</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(126,34,206,0.15)' }}>
          <div className="h-full transition-all" style={{
            width: `${completion}%`,
            background: 'linear-gradient(90deg, #7e22ce, #a855f7)'
          }} />
        </div>
      </div>

      {/* Kategori kartları */}
      {DOC_CATEGORIES.map(cat => {
        const catDocs = docs.filter(d => cat.types.some(t => t.type === d.type))
        const filled = cat.types.filter(t => uploadedTypes.has(t.type)).length
        return (
          <div key={cat.key} className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-cream-200 dark:border-ink-700 flex items-center justify-between">
              <h3 className="font-semibold text-ink-800 dark:text-ink-900" style={{ color: cat.color }}>
                {cat.label}
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${cat.color}15`, color: cat.color }}>
                {filled} / {cat.types.length}
              </span>
            </div>
            <div className="divide-y divide-cream-100 dark:divide-ink-700">
              {cat.types.map(t => {
                const doc = docs.find(d => d.type === t.type)
                const isUploaded = !!doc
                return (
                  <div key={t.type} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                         style={{ background: isUploaded ? `${cat.color}15` : '#f3f4f6' }}>
                      {isUploaded ? '✅' : '📄'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-700 dark:text-ink-300 flex items-center gap-1.5">
                        {t.label}
                        {t.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold">ZORUNLU</span>}
                      </div>
                      <div className="text-xs text-ink-500 truncate">
                        {isUploaded
                          ? `${doc.originalFileName} · ${new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}`
                          : `${t.ext} · max 15 MB`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isUploaded ? (
                        <>
                          <button onClick={() => handleView(doc.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors"
                            style={{ background: `${cat.color}15`, color: cat.color }}>
                            Görüntüle
                          </button>
                          <button onClick={() => handleDelete(doc.id, t.label)}
                            disabled={deletingId === doc.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors disabled:opacity-50">
                            Sil
                          </button>
                        </>
                      ) : (
                        <label className="text-xs px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-all hover:-translate-y-0.5"
                               style={{ background: cat.color, color: 'white' }}>
                          {uploadingType === t.type ? 'Yükleniyor...' : '⬆ Yükle'}
                          <input type="file" className="hidden"
                                 accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                                 disabled={uploadingType === t.type}
                                 onChange={e => handleUpload(t.type, e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="card p-4 text-xs text-ink-500 italic">
        🔒 Hassas belgeler (Sağlık, Kimlik, Adli Sicil) sadece izin verdiğin işletmeler tarafından görülür.
      </div>
    </div>
  )
}

/* ── Profile Tab ── */
function ProfileTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [profile, setProfile] = useState(null)  // readonly meta (email, role, isStudent)

  useEffect(() => {
    hotelApi.getCandidateProfile()
      .then(data => {
        setProfile(data)
        setForm({
          fullName:           data.fullName           || '',
          phone:              data.phone              || '',
          district:           data.district           || '',
          neighborhood:       data.neighborhood       || '',
          birthDate:          data.birthDate          || '',
          gender:             data.gender             || '',
          education:          data.education          || '',
          languages:          data.languages          || [],
          availabilityTypes:  data.availabilityTypes  || [],
          previousExperience: data.previousExperience || '',
          smokes:             data.smokes ?? null,
          hasLicense:         data.hasLicense ?? null,
          preferredDistricts: data.preferredDistricts || [],
          preferredPositions: data.preferredPositions || [],
        })
      })
      .catch(() => toast.error('Profil yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  // D7 + FAZ 1/#54 — Avatar: drag-drop + crop modal
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)

  async function handleCroppedAvatar(file) {
    setAvatarUploading(true)
    try {
      const updated = await hotelApi.uploadCandidateAvatar(file)
      setProfile(updated)
      toast.success('Profil fotoğrafı güncellendi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setAvatarUploading(false) }
  }

  async function handleAvatarDelete() {
    if (!confirm('Profil fotoğrafı silinsin mi?')) return
    try {
      await hotelApi.deleteCandidateAvatar()
      setProfile(prev => ({ ...prev, avatarUrl: null }))
      toast.success('Profil fotoğrafı silindi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleSetField(field, value) {
    setForm(prev => {
      const has = prev[field].includes(value)
      return {
        ...prev,
        [field]: has ? prev[field].filter(x => x !== value) : [...prev[field], value],
      }
    })
  }

  function setTriState(field, raw) {
    setForm(prev => ({
      ...prev,
      [field]: raw === 'unknown' ? null : raw === 'yes',
    }))
  }

  const triValue = (v) => v === null || v === undefined ? 'unknown' : (v ? 'yes' : 'no')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fullName.trim()) return toast.error('Ad soyad zorunlu')

    // #74: Phone + yaş validation (backend ile aynı kurallar)
    const phoneError = validateTurkeyPhone(form.phone, { mobileOnly: true })
    if (phoneError) return toast.error(phoneError)
    const ageError = validateAdultAge(form.birthDate)
    if (ageError) return toast.error(ageError)

    setSaving(true)
    try {
      const payload = {
        fullName:           form.fullName.trim(),
        phone:              form.phone.trim() || null,
        district:           form.district || null,
        neighborhood:       form.neighborhood?.trim() || null,
        birthDate:          form.birthDate || null,
        gender:             form.gender || null,
        education:          form.education || null,
        languages:          form.languages,
        availabilityTypes:  form.availabilityTypes,
        previousExperience: form.previousExperience.trim() || null,
        smokes:             form.smokes,
        hasLicense:         form.hasLicense,
        preferredDistricts: form.preferredDistricts,
        preferredPositions: form.preferredPositions,
      }
      const data = await hotelApi.updateCandidateProfile(payload)
      setProfile(data)
      toast.success('Profil güncellendi!')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>
  if (!form) return null

  // FAZ 1/#34 — Profil doluluk anlık hesap
  const completeness = calculateCandidateCompleteness(
    { ...form, avatarUrl: profile?.avatarUrl, about: profile?.about, experienceYears: profile?.experienceYears },
    { hasDocument: (profile?.documents?.length ?? 0) > 0 }
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
    <ProfileCompletenessCard data={completeness} />
    {/* D7: Profil fotoğrafı — form'un dışında ayrı kart (kendi upload akışı) */}
    <div className="card p-5">
      <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider mb-4">Profil Fotoğrafı</h3>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-cream-100 dark:bg-ink-700 border-2 border-cream-300 dark:border-ink-700 flex items-center justify-center overflow-hidden flex-shrink-0">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-ink-400 dark:text-ink-500">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <button type="button" onClick={() => setCropOpen(true)} disabled={avatarUploading}
            className={`block w-full px-4 py-2 text-sm font-medium rounded-lg cursor-pointer text-center transition-colors
              ${avatarUploading
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-500 cursor-wait'
                : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700 hover:bg-brand-200 dark:hover:bg-brand-900/60'}`}>
            {avatarUploading
              ? 'Yükleniyor...'
              : (profile?.avatarUrl ? 'Fotoyu Değiştir' : 'Foto Yükle')}
          </button>
          <AvatarCropModal open={cropOpen} onClose={() => setCropOpen(false)} onConfirm={handleCroppedAvatar} />
          {profile?.avatarUrl && (
            <button type="button" onClick={handleAvatarDelete}
              className="block w-full px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
              Fotoyu Kaldır
            </button>
          )}
          <p className="text-xs text-ink-400">Max 5 MB · JPG/PNG/WEBP/HEIC · Yüze odaklı 400x400 olarak kaydedilir</p>
        </div>
      </div>
    </div>

    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Block 1: Temel Bilgiler */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Temel Bilgiler</h3>

        <div>
          <label className="label">Ad Soyad *</label>
          <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className="input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">E-posta <span className="text-ink-400 font-normal">(değiştirilemez)</span></label>
            <input type="email" value={profile?.email || ''} disabled
              className="input bg-cream-50 text-ink-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input type="tel" name="phone" value={form.phone} maxLength={14}
              onChange={e => setForm(prev => ({ ...prev, phone: formatTurkeyPhoneInput(e.target.value) }))}
              className="input" placeholder="0555 123 45 67" />
          </div>
        </div>

        {/* İlçe + Mahalle (cascading) */}
        <DistrictNeighborhoodSelect
          district={form.district}
          neighborhood={form.neighborhood}
          onChange={({ district, neighborhood }) =>
            setForm(prev => ({ ...prev, district, neighborhood }))
          } />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Doğum Tarihi <span className="text-ink-400 font-normal text-[10px]">(16-65 yaş)</span></label>
            <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange}
              {...birthDateBounds()} className="input" />
          </div>
          <div>
            <label className="label">Cinsiyet</label>
            <select name="gender" value={form.gender} onChange={handleChange} className="input">
              <option value="">Belirtmedim</option>
              {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Block 2: Eğitim */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Eğitim</h3>

        <div>
          <label className="label">Eğitim Durumu <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
          <select name="education" value={form.education} onChange={handleChange} className="input">
            <option value="">Seçin</option>
            {Object.entries(EDUCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Block 3: İş Tercihleri */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">İş Tercihleri</h3>

        <div>
          <label className="label">Müsaitlik Türü <span className="text-ink-400 font-normal">(birden fazla seçebilirsin)</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(AVAILABILITY_LABELS).map(([key, label]) => {
              const active = form.availabilityTypes.includes(key)
              return (
                <button key={key} type="button" onClick={() => toggleSetField('availabilityTypes', key)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all
                    ${active
                      ? 'border-brand-500 dark:border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 shadow-sm'
                      : 'border-cream-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:border-brand-400 dark:hover:border-brand-500'}`}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="label">Önceki Deneyim <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
          <textarea name="previousExperience" value={form.previousExperience} onChange={handleChange}
            className="input resize-none h-24 text-sm"
            placeholder="Daha önce çalıştığın yerler, pozisyonlar, kazandığın deneyimler..." />
        </div>
      </div>

      {/* Block 4: Diğer */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Diğer</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Ehliyet</label>
            <select value={triValue(form.hasLicense)} onChange={e => setTriState('hasLicense', e.target.value)} className="input">
              <option value="unknown">Belirtmedim</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>
        </div>
      </div>

      {/* ADIM J: Bildirim tercihleri — ilgilendiği ilçeler + pozisyonlar */}
      <div className="card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Bildirim Tercihleri</h3>
          <p className="text-xs text-ink-500 mt-1">
            İlgini çekebilecek yeni ilan açıldığında otomatik bildirim al. Hiçbirini seçmezsen bildirim yok.
          </p>
        </div>

        <div>
          <label className="label">İlgilendiğin İlçeler</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-2 border border-cream-300 rounded-lg">
            {ISTANBUL_DISTRICTS.map(d => {
              const active = form.preferredDistricts.includes(d)
              return (
                <label key={d}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer
                    ${active ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 font-medium' : 'text-ink-600 hover:bg-cream-50'}`}>
                  <input type="checkbox" checked={active}
                    onChange={() => toggleSetField('preferredDistricts', d)}
                    className="w-3.5 h-3.5 accent-brand-700" />
                  {d}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-ink-400 mt-1">{form.preferredDistricts.length} ilçe seçili</p>
        </div>

        <div>
          <label className="label">İlgilendiğin Pozisyonlar</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(POSITION_LABELS).map(([value, label]) => {
              const active = form.preferredPositions.includes(value)
              return (
                <label key={value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm
                    ${active ? 'border-brand-500 dark:border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 font-medium' : 'border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500'}`}>
                  <input type="checkbox" checked={active}
                    onChange={() => toggleSetField('preferredPositions', value)}
                    className="w-4 h-4 accent-brand-700" />
                  {label}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-ink-400 mt-1">{form.preferredPositions.length} pozisyon seçili</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}>
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </form>

    {/* D3: Şifre Değiştir — ayrı form, profil form'unun dışında */}
    <ChangePasswordCard />
    </div>
  )
}

/* ── Main Dashboard ── */
export default function CandidateDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding(user?.id))
  const queryClient = useQueryClient()

  // FAZ 0/#10 (Aşama 4) — useQuery
  const { data, isLoading } = useQuery({
    queryKey: keys.applications.candidate(),
    queryFn: async () => {
      const res = await hotelApi.getMyApplications()
      return Array.isArray(res) ? res : (res?.content ?? [])
    },
  })
  const applications = data ?? []

  const refetchApplications = () =>
    queryClient.invalidateQueries({ queryKey: keys.applications.candidate() })

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {isLoading ? (
        <SkeletonList count={4} />
      ) : (
        <>
          {activeTab === 'overview'      && <OverviewTab user={user} applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'listings'      && <ListingsPage onApplicationSubmitted={refetchApplications} onMessagesOpen={() => setActiveTab('messages')} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={refetchApplications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'history'       && <HistoryTab applications={applications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'documents'     && <DocumentsTab />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'profile'       && <ProfileTab />}
        </>
      )}
      {showOnboarding && (
        <OnboardingWizard user={user} onClose={() => setShowOnboarding(false)} onTabChange={setActiveTab} />
      )}
    </DashboardLayout>
  )
}
