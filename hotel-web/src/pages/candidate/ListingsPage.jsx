import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'

// FAZ 5.4 — stagger variants (daha belirgin: scale + y + slow)
const LIST_STAGGER = {
  hidden:  { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.075, delayChildren: 0.08 } },
}
const LIST_ITEM = {
  hidden:  { opacity: 0, y: 28, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import { keys } from '../../lib/queryClient'
import ReportModal from '../../components/ReportModal'
import StarRating from '../../components/StarRating'
import VerifiedBadge from '../../components/VerifiedBadge'
import HoverPhotoCarousel from '../../components/HoverPhotoCarousel'  // FAZ D3
import GalleryCarousel from '../../components/GalleryCarousel'
import MapView from '../../components/MapView'
import EmptyState from '../../components/EmptyState'
import { SkeletonListingGrid } from '../../components/Skeleton'
import SavedSearchManager from '../../components/SavedSearchManager'
// ListingsMapView kaldirildi (kullanici istegi)
import { ISTANBUL_DISTRICTS } from '../../data/istanbul'
import { formatSalary } from '../../lib/salary'  // FAZ 2/#25

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}
const JOB_TYPE_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}
const BUSINESS_TYPE_LETTER = { HOTEL: 'O', RESTAURANT: 'R', CAFE: 'K' }
const SHIFT_INFO = {
  MORNING: { icon: '', label: 'Sabah', time: '08:00–16:00' },
  EVENING: { icon: '', label: 'Akşam', time: '16:00–24:00' },
  NIGHT:   { icon: '', label: 'Gece',  time: '22:00–08:00' },
}
const WEEKDAYS_SHORT = [
  { key: 'MONDAY',    label: 'Pzt' },
  { key: 'TUESDAY',   label: 'Sal' },
  { key: 'WEDNESDAY', label: 'Çar' },
  { key: 'THURSDAY',  label: 'Per' },
  { key: 'FRIDAY',    label: 'Cum' },
  { key: 'SATURDAY',  label: 'Cmt' },
  { key: 'SUNDAY',    label: 'Paz' },
]

// Hassas belge tipleri — açık olanlar (CV, TRANSCRIPT, STUDENT_CERTIFICATE) zaten herkese açık
const SENSITIVE_DOC_LABELS = {
  CRIMINAL_RECORD:    'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT:  'Kimlik Fotokopisi',
}
const SENSITIVE_DOC_TYPES = Object.keys(SENSITIVE_DOC_LABELS)

// FAZ 2/#25 — formatSalary ortak helper'a tasindi (lib/salary.js)

/* ── Apply Modal (Chat refactor v2) ──
   Akış:
   1) Aday slotu seçer + ön yazı yazar + ekstra dosya (opsiyonel) seçer
   2) "Başvur" POST /applications backend conversation açar + sistem mesajı atar
   3) Seçili dosyalar conversation'a attachment mesajı olarak yüklenir
   4) /candidate mesajlar sekmesine yönlendir (conversationId query ile)
*/
export function ApplyModal({ listing, onClose, onSuccess, onMessagesOpen }) {
  const [coverLetter, setCoverLetter] = useState('')
  const [loading, setLoading] = useState(false)
  // FAZ 11.W1.3 — Success choreography state
  // idle -> submitting -> success -> (auto-close 6s or user acts)
  const [submitState, setSubmitState] = useState('idle')
  const [successResp, setSuccessResp] = useState(null)  // { conversationId, applicationId }

  const [selectedSlotIds, setSelectedSlotIds] = useState([])
  const [files, setFiles] = useState([])   // [{file, type}]

  const allSlots = [...(listing.shiftSlots || [])].sort((a, b) => {
    const c = (a.date || '').localeCompare(b.date || '')
    return c !== 0 ? c : (a.startTime || '').localeCompare(b.startTime || '')
  })
  const hasSlots = allSlots.length > 0

  // Chat-v2 bugfix: bugünden önceki tarihler "geçti" sayılır
  const todayStr = new Date().toISOString().slice(0, 10)
  // F0/bugfix: TARİH değil, başlangıç DateTime'a göre kontrol.
  // Bugün başlayan ama saat geçmiş vardiyaya başvuru engellenir.
  function isPastSlot(s) {
    if (!s.date) return false
    if (s.date < todayStr) return true                  // dünden eski geçmiş
    if (s.date > todayStr) return false                 // yarın+ gelecek
    // Bugünse saat karşılaştır
    if (!s.startTime) return false                      // saat yoksa kabul
    const startHHMM = String(s.startTime).slice(0, 5)   // 14:00:00 14:00
    const nowHHMM = new Date().toTimeString().slice(0, 5)
    return startHHMM <= nowHHMM
  }
  const futureSlots = allSlots.filter(s => !isPastSlot(s))
  const hasFutureSlots = futureSlots.length > 0

  function toggleSlot(id, full, past) {
    if (full || past) return
    setSelectedSlotIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function onFilesChange(e) {
    const picked = Array.from(e.target.files || [])
    const filtered = picked.filter(f => {
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} 15 MB'dan büyük — atlandı`)
        return false
      }
      return true
    })
    setFiles(prev => [...prev, ...filtered])
    e.target.value = ''   // aynı dosyayı tekrar seçebilmek için
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (hasSlots && selectedSlotIds.length === 0) {
      return toast.error('En az 1 vardiya seçmelisiniz')
    }

    setLoading(true)
    setSubmitState('submitting')
    try {
      // 1) Application gönder backend conversation açar + sistem mesajı yazar
      const appResp = await hotelApi.applyToListing({
        jobListingId: listing.id,
        coverLetter,
        slotIds: selectedSlotIds,
        grantedSensitiveTypes: [],
      })

      const convId = appResp.conversationId
      // 2) Seçili dosyaları conversation'a attachment olarak yükle
      if (convId && files.length > 0) {
        for (const f of files) {
          try {
            await hotelApi.sendMessageAttachment(convId, f, '')
          } catch (err) {
            toast.error(`${f.name} yüklenemedi: ${extractErrorMessage(err)}`, { id: f.name })
          }
        }
      }

      // FAZ 11.W1.3 — success state: summary card + auto-close 6s
      setSuccessResp({ conversationId: convId, applicationId: appResp.id })
      setSubmitState('success')
      onSuccess?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
      setSubmitState('idle')
    } finally {
      setLoading(false)
    }
  }

  // Auto-close after 6s in success state
  useEffect(() => {
    if (submitState !== 'success') return
    const t = setTimeout(() => onClose(), 6000)
    return () => clearTimeout(t)
  }, [submitState, onClose])

  function handleOpenMessages() {
    onMessagesOpen?.(successResp?.conversationId)
    onClose()
  }

  // FAZ 11.W1.3 — Success view (submit sonrasi 6sn kalir)
  if (submitState === 'success') {
    const firstSlot = allSlots.find(s => selectedSlotIds.includes(s.id))
    const firstSlotStr = firstSlot
      ? `${new Date(firstSlot.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} · ${(firstSlot.startTime || '').slice(0, 5)}`
      : null
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-8 flex flex-col items-center text-center">
            {/* Check morph icon */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                 style={{
                   background: 'rgba(122, 159, 122, 0.14)',
                   border: '1px solid rgba(122, 159, 122, 0.42)',
                   boxShadow: '0 0 24px rgba(122, 159, 122, 0.25)',
                 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7a9f7a"
                   strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                   style={{ animation: 'check-morph 400ms ease-out forwards' }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <style>{`
                @keyframes check-morph {
                  0% { stroke-dasharray: 30; stroke-dashoffset: 30; transform: scale(0.9); }
                  100% { stroke-dasharray: 30; stroke-dashoffset: 0; transform: scale(1); }
                }
              `}</style>
            </div>

            <h2 className="type-display" style={{ fontSize: '22px' }}>Başvurun gönderildi</h2>
            <p className="type-body mt-2" style={{ color: 'var(--text-secondary)' }}>
              <b>{listing.businessName}</b> · {listing.title}
            </p>
            {firstSlotStr && (
              <p className="type-caption mt-1">İlk vardiya: {firstSlotStr}</p>
            )}

            {/* Timeline preview: 3 nodes */}
            <div className="w-full max-w-[280px] mt-6 flex items-center justify-between">
              {['Başvuruldu', 'İnceleniyor', 'Karar'].map((label, i) => (
                <div key={label} className="flex flex-col items-center flex-1">
                  <span className="w-3 h-3 rounded-full"
                        style={{
                          background: i === 0 ? '#cdb78f' : 'rgba(205, 183, 143, 0.20)',
                          border: '1px solid rgba(205, 183, 143, 0.42)',
                          boxShadow: i === 0 ? '0 0 12px rgba(205, 183, 143, 0.55)' : 'none',
                        }} />
                  <span className="type-overline mt-2"
                        style={{ color: i === 0 ? 'var(--accent-action)' : 'var(--text-faint)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-8 w-full max-w-[320px]">
              <button type="button" onClick={onClose}
                      className="tier-raised tier-raised-hover flex-1 py-2.5 type-overline"
                      style={{ color: 'var(--text-secondary)' }}>
                Başka ilan bul
              </button>
              <button type="button" onClick={handleOpenMessages}
                      className="flex-1 py-2.5 type-overline rounded-2xl transition-all hover:-translate-y-0.5"
                      style={{
                        background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                        color: '#1a1208',
                        boxShadow: '0 6px 18px rgba(205, 183, 143, 0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
                      }}>
                Mesajlaşmayı Aç
              </button>
            </div>

            <p className="type-caption mt-4" style={{ color: 'var(--text-faint)' }}>
              6 saniye içinde otomatik kapanır
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-hairline sticky top-0 z-10" style={{ background: 'var(--surface-raised)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                 style={{ background: 'rgba(205, 183, 143, 0.10)', border: '1px solid rgba(205, 183, 143, 0.32)', color: 'var(--accent-action)' }}>
              {BUSINESS_TYPE_LETTER[listing.businessType] || '?'}
            </div>
            <div>
              <h2 className="type-heading">{listing.title}</h2>
              <p className="type-caption">{listing.businessName} · {listing.businessDistrict}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Ön Yazı */}
          <div>
            <label className="label">Ön Yazı <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
            <textarea
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              className="input resize-none h-24 text-sm leading-relaxed"
              placeholder="Kendinizi kısaca tanıtın, neden bu pozisyonda çalışmak istediğinizi anlatın..."
              autoFocus
            />
          </div>

          {/* Faz E3: Slot seçimi (zorunlu — min 1) */}
          {hasSlots ? (
            <div>
              <label className="label">
                Vardiya Seçimi *
                <span className="text-ink-400 font-normal ml-1">(çalışabileceğin günleri işaretle)</span>
              </label>
              <div className="space-y-1.5">
                {allSlots.map(s => {
                  const full = s.full || (s.slotsFilled >= s.slotsNeeded)
                  const past = isPastSlot(s)
                  const disabled = full || past
                  const selected = selectedSlotIds.includes(s.id)
                  const dateLabel = new Date(s.date).toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'short', weekday: 'short',
                  })
                  const timeLabel = `${(s.startTime || '').slice(0, 5)}–${(s.endTime || '').slice(0, 5)}`
                  return (
                    <label key={s.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all
                        ${disabled
                          ? 'border-cream-300 bg-cream-50 cursor-not-allowed opacity-60'
                          : selected
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 dark:border-brand-500 cursor-pointer shadow-sm'
                            : 'border-cream-300 dark:border-ink-700 bg-white dark:bg-ink-800 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500'}`}>
                      <input type="checkbox" checked={selected} disabled={disabled}
                        onChange={() => toggleSlot(s.id, full, past)}
                        className="w-4 h-4 accent-brand-700" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink-800 flex items-center gap-1.5">
                          {dateLabel} · {timeLabel}
                          {past && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded
                                             bg-cream-200 text-ink-600">
                              Geçti
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-ink-500 mt-0.5">
                          {past
                            ? 'Bu vardiya geçmişte — başvurulamaz'
                            : full
                              ? 'Bu vardiya doldu'
                              : `${s.slotsFilled || 0}/${s.slotsNeeded} dolu — ${(s.slotsNeeded - (s.slotsFilled || 0))} açık`}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              {selectedSlotIds.length > 0 && (
                <p className="text-xs text-brand-700 dark:text-brand-700 font-medium mt-2">
                  {selectedSlotIds.length} vardiya seçtin
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
              Bu ilana henüz vardiya eklenmemiş — başvuru alınamaz.
            </div>
          )}

          {/* Chat refactor v2: Belge ekleme — başvuruyla beraber mesajlaşmaya yüklenir */}
          <div>
            <label className="label">
              Belgeler / Fotoğraflar
              <span className="text-ink-400 font-normal ml-1">(opsiyonel — CV, transkript, sertifika vb.)</span>
            </label>

            <label className="block cursor-pointer rounded-lg border-2 border-dashed border-slate-300 dark:border-ink-700
                              hover:border-brand-400 dark:hover:border-brand-500 transition-colors
                              bg-cream-50 dark:bg-ink-800/50 px-4 py-5 text-center">
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx"
                onChange={onFilesChange}
                className="hidden"
              />
              <div className="flex items-center justify-center gap-2 text-sm text-ink-600 dark:text-ink-300">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="font-semibold">Dosya seç</span>
                <span className="text-xs text-ink-400">PDF / JPG / PNG / DOC — her biri max 15 MB</span>
              </div>
            </label>

            {/* Seçilen dosyalar listesi */}
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((f, i) => (
                  <div key={i}
                       className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                                  border border-cream-300 dark:border-ink-700 bg-white dark:bg-ink-800">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                           strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-ink-500 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 3.75-3-3m0 0-3 3m3-3v11.25m6-2.25h.008v.008H15v-.008Zm0 0H4.5" />
                      </svg>
                      <span className="text-sm text-ink-700 dark:text-cream-200 truncate">{f.name}</span>
                      <span className="text-[10px] text-ink-400 font-mono shrink-0">
                        {(f.size / 1024).toFixed(0)} KB
                      </span>
                    </div>
                    <button type="button" onClick={() => removeFile(i)}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold shrink-0">
                      Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-ink-400 mt-1.5">
              ⓘ Belgelerin işletmeyle mesajlaşmada otomatik paylaşılır. Daha sonra mesajdan da ekleyebilirsin.
            </p>
          </div>

          {/* Footer — filled amber CTA (modal-icinde tek accent) */}
          <div className="flex gap-3 pt-2 sticky bottom-0 py-3 -mx-6 px-6 border-t border-hairline"
               style={{ background: 'var(--surface-raised)' }}>
            <button type="button" onClick={onClose}
                    className="tier-raised tier-raised-hover flex-1 py-2.5 type-overline"
                    style={{ color: 'var(--text-secondary)' }}>
              İptal
            </button>
            <button type="submit" disabled={loading || !hasFutureSlots}
              className="relative overflow-hidden flex-1 py-2.5 type-overline rounded-2xl transition-all disabled:opacity-60 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                color: '#1a1208',
                border: '1px solid rgba(205, 183, 143, 0.45)',
                boxShadow: '0 6px 18px rgba(205, 183, 143, 0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
              }}>
              {loading && (
                <span aria-hidden className="absolute bottom-0 left-0 h-[2px]"
                      style={{
                        background: '#1a1208',
                        opacity: 0.55,
                        animation: 'submit-progress 1400ms ease-in-out infinite',
                      }} />
              )}
              {loading ? 'Gönderiliyor…' : !hasFutureSlots ? 'Süresi Doldu' : 'Başvur'}
              <style>{`
                @keyframes submit-progress {
                  0% { width: 0%; left: 0%; }
                  50% { width: 60%; left: 20%; }
                  100% { width: 0%; left: 100%; }
                }
              `}</style>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Detail Modal ── */
function DetailModal({ listing, onClose, onApply }) {
  const [showReport, setShowReport] = useState(false)
  const shift = null  // legacy shift kategorisi kaldirildi
  const salary = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)
  const hasDates = listing.startDate || listing.endDate
  const slots = [...(listing.shiftSlots || [])].sort((a, b) => {
    const c = (a.date || '').localeCompare(b.date || '')
    return c !== 0 ? c : (a.startTime || '').localeCompare(b.startTime || '')
  })
  // Chat-v2: hiç gelecek slot yoksa "süresi doldu"
  const detailTodayStr = new Date().toISOString().slice(0, 10)
  const detailHasFuture = slots.some(s => (s.date || '') >= detailTodayStr)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-cream-200 sticky top-0 bg-white dark:bg-ink-800 z-10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0 shadow-sm"
                 style={{ background: 'rgba(205, 183, 143, 0.10)', border: '1px solid rgba(205, 183, 143, 0.32)', color: '#cdb78f' }}>
              {BUSINESS_TYPE_LETTER[listing.businessType] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-ink-900 leading-tight">{listing.title}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-sm text-ink-500">{listing.businessName}</p>
                {listing.businessReviewCount > 0 && (
                  <StarRating value={listing.businessAverageRating}
                    count={listing.businessReviewCount} size="sm" />
                )}
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 flex-shrink-0">
              {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* #87: İşletme galerisi carousel — varsa göster */}
          {listing.businessId && (
            <GalleryCarousel businessId={listing.businessId} height="h-56" />
          )}

          {/* Quick facts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-cream-50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-ink-500 uppercase tracking-wider">İlçe</div>
              <div className="text-sm font-semibold text-ink-700 mt-0.5">
                {listing.businessDistrict || '—'}
              </div>
            </div>
            <div className="bg-cream-50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-ink-500 uppercase tracking-wider">Pozisyon</div>
              <div className="text-sm font-semibold text-ink-700 mt-0.5">
                {POSITION_LABELS[listing.position] || listing.position}
              </div>
            </div>
            {shift && (
              <div className="bg-cream-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-ink-500 uppercase tracking-wider">Vardiya</div>
                <div className="text-sm font-semibold text-ink-700 mt-0.5">
                  {shift.icon} {shift.label}
                </div>
                <div className="text-[10px] text-ink-400 mt-0.5">{shift.time}</div>
              </div>
            )}
            {salary && (
              <div className="bg-brand-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-brand-700 uppercase tracking-wider">Ücret</div>
                <div className="text-xs font-semibold text-brand-700 mt-0.5 leading-tight">{salary}</div>
              </div>
            )}
          </div>

          {/* #81 v2: Konum — tam koordinat varsa onu, yoksa ilçe merkezi fallback */}
          {listing.businessDistrict && (
            <div>
              <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Konum</h3>
              <MapView
                position={listing.businessLatitude != null && listing.businessLongitude != null
                  ? [Number(listing.businessLatitude), Number(listing.businessLongitude)]
                  : null}
                district={listing.businessDistrict}
                neighborhood={listing.businessNeighborhood}
                title={listing.businessName}
                height="240px"
              />
              {listing.businessAddress && (
                <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-2">
                  {listing.businessAddress}
                </p>
              )}
              {listing.businessLatitude == null && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 italic">
                  Yaklaşık konum — işletme henüz tam adresi haritada işaretlemedi.
                </p>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Açıklama</h3>
            <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {listing.requirements && (
            <div>
              <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Gereksinimler</h3>
              <p className="text-sm text-ink-700 leading-relaxed whitespace-pre-line">
                {listing.requirements}
              </p>
            </div>
          )}

          {hasDates && (
            <div>
              <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Kontrat Dönemi</h3>
              <p className="text-sm text-ink-700">
                {listing.startDate && new Date(listing.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {listing.startDate && listing.endDate && ' — '}
                {listing.endDate && new Date(listing.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}

          {/* Faz E3: Vardiya listesi */}
          {slots.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">
                Vardiyalar ({slots.length})
              </h3>
              <div className="space-y-1.5">
                {slots.map(s => {
                  const full = s.full || (s.slotsFilled >= s.slotsNeeded)
                  const dateLabel = new Date(s.date).toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'short', weekday: 'short',
                  })
                  return (
                    <div key={s.id}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 border
                        ${full ? 'bg-cream-50 border-cream-300 opacity-60' : 'bg-brand-50/60 dark:bg-brand-900/20 border-brand-100 dark:border-brand-900/40'}`}>
                      <div className="text-sm">
                        <span className="font-medium text-ink-800">{dateLabel}</span>
                        <span className="text-ink-500 ml-2">{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${full ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700'}`}>
                        {full ? 'DOLU' : `${(s.slotsNeeded - (s.slotsFilled || 0))} açık`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-cream-200 sticky bottom-0 bg-white dark:bg-ink-800 items-center">
          <button onClick={() => setShowReport(true)}
            title="Bu ilanı bildir"
            className="text-sm px-3 py-2.5 rounded-lg text-ink-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
            Bildir
          </button>
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Kapat</button>
          <button
            onClick={() => { if (detailHasFuture) { onApply(listing); onClose() } }}
            disabled={!detailHasFuture}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{ background: '#047857', boxShadow: '0 3px 12px rgba(4,120,87,0.35)' }}>
            {detailHasFuture ? 'Başvur' : 'Süresi Doldu'}
          </button>
        </div>
      </div>

      {showReport && (
        <ReportModal
          targetType="LISTING"
          targetId={listing.id}
          targetLabel={`${listing.title} · ${listing.businessName}`}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}

/* ── Listing Card ── */
function ListingCard({ listing, onApply, onDetail, savedIds, onToggleSave }) {
  const shift = null  // legacy shift kategorisi kaldirildi
  const salary = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)
  const isSaved = savedIds?.has(listing.id)

  return (
    <div
      onClick={() => onDetail(listing)}
      className="cursor-pointer transition-all duration-300 group overflow-hidden relative"
      style={{
        background: '#1b1815',
        borderRadius: '28px 12px 12px 12px',                /* asymmetric tl */
        border: 'none',
        boxShadow: '0 12px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(245,239,226,0.03)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)'
        e.currentTarget.style.background = '#221f1b'
        e.currentTarget.style.boxShadow = '0 22px 52px rgba(0,0,0,0.42), inset 0 1px 0 rgba(245,239,226,0.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.background = '#1b1815'
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(245,239,226,0.03)'
      }}
    >
      {/* HERO — graphite gradient + champagne wash */}
      <div className="relative h-40 w-full overflow-hidden"
           style={{
             background: 'linear-gradient(135deg, #221f1b 0%, #2d2823 100%)',
           }}>
        {listing.businessPhotoUrls?.length > 0 && (
          <HoverPhotoCarousel photos={listing.businessPhotoUrls}
                              alt={`${listing.businessName} galeri`} />
        )}

        {/* Verified badge — sol üst */}
        {listing.businessVerified && (
          <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] px-2 py-1 rounded-full backdrop-blur-md"
                style={{
                  background: 'rgba(19, 17, 15, 0.78)',
                  color: '#cdb78f',
                  border: '1px solid rgba(205, 183, 143, 0.42)',
                }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Doğrulandı
          </span>
        )}

        {/* Job type chip — sağ üst */}
        <span className="absolute top-3 right-12 text-[10px] font-semibold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full backdrop-blur-md z-10"
              style={{
                background: 'rgba(19, 17, 15, 0.78)',
                color: '#c9bdaa',
                border: '1px solid rgba(205, 183, 143, 0.16)',
              }}>
          {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
        </span>

        {/* Dalga H1 — Kalp butonu (favori toggle) */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSave?.(listing.id, isSaved) }}
          aria-label={isSaved ? 'Kaydedilenlerden cikar' : 'Kaydet'}
          title={isSaved ? 'Kaydedilenlerden çıkar' : 'Kaydet'}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110"
          style={{
            background: 'rgba(19, 17, 15, 0.78)',
            border: `1px solid ${isSaved ? 'rgba(180, 106, 85, 0.55)' : 'rgba(205, 183, 143, 0.18)'}`,
            color: isSaved ? '#d39481' : '#928678',
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24"
               fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>

        {/* Salary chip — champagne hairline, no neon glow */}
        {salary && (
          <span className="absolute bottom-3 left-3 text-[12px] font-semibold tabular-nums px-3 py-1.5 rounded-full z-10 backdrop-blur-md"
                style={{
                  background: 'rgba(19, 17, 15, 0.78)',
                  color: '#cdb78f',
                  border: '1px solid rgba(205, 183, 143, 0.32)',
                  letterSpacing: '-0.005em',
                }}>
            {salary}
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-5 flex flex-col">
        <h3 className="font-semibold text-base leading-snug line-clamp-2 transition-colors duration-200"
            style={{ color: '#f5efe2', letterSpacing: '-0.015em' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#cdb78f' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#f5efe2' }}>
          {listing.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap mt-1.5">
          <p className="text-[13px] inline-flex items-center" style={{ color: '#cdb78f' }}>
            {listing.businessName}
          </p>
          {listing.businessReviewCount > 0 && (
            <StarRating value={listing.businessAverageRating}
              count={listing.businessReviewCount} size="xs" />
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-2 text-[12px] flex-wrap" style={{ color: '#928678' }}>
          <span>{listing.businessDistrict || 'İstanbul'}</span>
          <span style={{ color: '#6b6358' }}>·</span>
          <span>{POSITION_LABELS[listing.position] || listing.position}</span>
          {shift && (
            <>
              <span style={{ color: '#6b6358' }}>·</span>
              <span>{shift.icon} {shift.label}</span>
            </>
          )}
        </div>

        {/* Faz E3: slot özeti */}
        {listing.shiftSlots?.length > 0 && (() => {
          const slots = [...listing.shiftSlots].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          const next = slots.find(s => !(s.full || s.slotsFilled >= s.slotsNeeded)) || slots[0]
          const openCount = slots.filter(s => !(s.full || s.slotsFilled >= s.slotsNeeded)).length
          const nextStr = next
            ? `${new Date(next.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${next.startTime?.slice(0, 5)}`
            : null
          return (
            <div className="text-[11px] font-medium mt-2 tabular-nums"
                 style={{ color: openCount === 0 ? '#d39481' : '#c8923a' }}>
              {slots.length} vardiya
              {openCount === 0 && ' · tümü dolu'}
              {openCount > 0 && nextStr && ` · ${nextStr}`}
            </div>
          )
        })()}

        <p className="text-[12px] mt-3 line-clamp-2" style={{ color: '#928678' }}>{listing.description}</p>

        {/* Tek CTA — sole bright-gold per card */}
        <div className="mt-5">
          <button
            onClick={(e) => { e.stopPropagation(); onApply(listing) }}
            className="w-full py-2.5 px-3 text-[13px] font-semibold uppercase tracking-[0.14em] rounded-2xl
                       transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
              color: '#1a1208',
              boxShadow: '0 10px 24px rgba(205, 183, 143, 0.22), inset 0 1px 0 rgba(255,255,255,0.22)',
            }}>
            Başvur
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Listings Page — FAZ 0/#10 + FAZ 1/#47 + FAZ 1/#30 split + harita ── */
export default function ListingsPage({ onApplicationSubmitted, onMessagesOpen }) {
  const navigate = useNavigate()
  const [applyTarget, setApplyTarget] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 6

  // Dalga H1 — Kaydedilen ilan ID'leri (kalp ikonunun durumu icin)
  const queryClient = useQueryClient()
  const { data: savedListings = [] } = useQuery({
    queryKey: ['my-saved-listings'],
    queryFn: () => hotelApi.getMySavedListings(),
    staleTime: 60_000,
  })
  const savedIds = new Set(savedListings.map(l => l.id))

  // Dalga I1 — Engellenen isletmelerin ilanlari feed'den dusuruluyor
  const { data: blockedBusinesses = [] } = useQuery({
    queryKey: ['my-blocked-businesses'],
    queryFn: () => hotelApi.getMyBlockedBusinesses(),
    staleTime: 60_000,
  })
  const blockedBusinessIds = new Set(blockedBusinesses.map(b => b.id))
  async function handleToggleSave(listingId, currentlySaved) {
    try {
      if (currentlySaved) await hotelApi.unsaveListing(listingId)
      else                await hotelApi.saveListing(listingId)
      queryClient.invalidateQueries({ queryKey: ['my-saved-listings'] })
    } catch (e) {
      toast.error('Kaydetme islemi basarisiz')
    }
  }

  // #47: Detay artık modal değil, kendi route'a navigate
  const openDetail = (listing) => navigate(`/listings/${listing.id}`)

  // Filter state
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [position, setPosition] = useState('')
  const [jobType, setJobType] = useState('')
  const [district, setDistrict] = useState('')
  const [minSalary, setMinSalary] = useState('')
  const [shifts, setShifts] = useState([])

  // Faz E4: Tarih filtresi
  // datePreset: '' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'WEEKEND' | 'CUSTOM'
  const [datePreset, setDatePreset] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  // Preset dateFrom/dateTo (YYYY-MM-DD)
  const dateRange = (() => {
    const today = new Date()
    const fmt = (d) => d.toISOString().split('T')[0]
    const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c }
    switch (datePreset) {
      case 'TODAY':    return { dateFrom: fmt(today),                dateTo: fmt(today) }
      case 'TOMORROW': return { dateFrom: fmt(addDays(today, 1)),    dateTo: fmt(addDays(today, 1)) }
      case 'WEEK':     return { dateFrom: fmt(today),                dateTo: fmt(addDays(today, 7)) }
      case 'WEEKEND': {
        // En yakın Cmt (6) ve Paz (0)
        const dow = today.getDay()  // 0=Paz, 6=Cmt
        const daysToSat = dow === 6 ? 0 : (6 - dow + 7) % 7
        const sat = addDays(today, daysToSat)
        const sun = addDays(sat, 1)
        return { dateFrom: fmt(sat), dateTo: fmt(sun) }
      }
      case 'CUSTOM':   return { dateFrom: customFrom || null, dateTo: customTo || null }
      default:         return { dateFrom: null, dateTo: null }
    }
  })()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 400)
    return () => clearTimeout(t)
  }, [keyword])

  // FAZ 0/#10 — useQuery: filtreler dependency, otomatik refetch + cache
  // FAZ 5 — ranked=true: aday tercihlerine göre "sana özel" sıralama
  const filters = {
    position, jobType, shifts, district, minSalary,
    keyword: debouncedKeyword,
    dateFrom: dateRange.dateFrom,
    dateTo:   dateRange.dateTo,
    ranked: true,
  }
  const { data: listings = [], isLoading: loading, error } = useQuery({
    queryKey: keys.listings.list(filters),
    queryFn: () => hotelApi.getListings(filters),
    keepPreviousData: true,  // filtre değişirken eski listeyi göster (UX)
  })
  if (error) toast.error('İlanlar yüklenemedi')

  function clearFilters() {
    setKeyword(''); setPosition(''); setJobType('')
    setDistrict(''); setMinSalary(''); setShifts([])
    setDatePreset(''); setCustomFrom(''); setCustomTo('')
  }

  const activeFilterCount =
    (keyword ? 1 : 0) + (position ? 1 : 0) + (jobType ? 1 : 0) +
    (district ? 1 : 0) + (minSalary ? 1 : 0) + shifts.length +
    (datePreset ? 1 : 0)

  // Dalga I1 — Engelli isletmeleri client-side filtrele (backend rebuild gerekene kadar)
  const visibleListings = useMemo(
    () => blockedBusinessIds.size === 0
      ? listings
      : listings.filter(l => !blockedBusinessIds.has(l.businessId)),
    [listings, blockedBusinessIds]
  )

  // 6'lik pagination
  const totalPages = Math.max(1, Math.ceil(visibleListings.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageItems  = useMemo(
    () => visibleListings.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [visibleListings, safePage]
  )
  // Filtre/keyword degisirse sayfa 1'e dön (boş sayfada kalmamak için)
  useEffect(() => { setPage(1) }, [debouncedKeyword, position, jobType, district, minSalary, shifts, datePreset, customFrom, customTo])

  return (
    <div className="xl:grid xl:grid-cols-[280px_1fr] xl:gap-5 space-y-4 xl:space-y-0">
      {/* SOL PANEL — filtre paneli (sticky lg+) */}
      <aside className="xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
        <div className={`card p-4 space-y-4 ${showFilters ? '' : 'hidden xl:block'}`}>
        {/* Dalga 1 — Eski "FİLTRE AKTİF" banner üst ActiveFilterBar'a tasindi */}

        {/* İlçe — dropdown (39 ilçe pill chip mantıksız) */}
        <div>
          <label className="block mb-2 text-[11px] font-semibold tracking-[0.22em] uppercase"
                 style={{ color: '#928678' }}>İlçe</label>
          <select value={district} onChange={e => setDistrict(e.target.value)} className="input text-sm">
            <option value="">Tüm İstanbul</option>
            {ISTANBUL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {/* Pozisyon — FilterChipGroup */}
        <FilterChipGroup
          label="Pozisyon"
          value={position}
          onChange={setPosition}
          items={Object.entries(POSITION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />

        {/* Çalışma Türü — FilterChipGroup */}
        <FilterChipGroup
          label="Çalışma Türü"
          value={jobType}
          onChange={setJobType}
          items={Object.entries(JOB_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />

        {/* Min Ücret — range slider + preset chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[11px] font-semibold tracking-[0.22em] uppercase"
                   style={{ color: '#928678' }}>Min Ücret</label>
            <span className="text-[13px] font-semibold tabular-nums"
                  style={{ color: '#cdb78f', letterSpacing: '-0.005em' }}>
              {minSalary ? `${Number(minSalary).toLocaleString('tr-TR')} ₺+` : 'Tümü'}
            </span>
          </div>
          <input type="range" min="0" max="50000" step="1000"
            value={minSalary || 0}
            onChange={e => setMinSalary(e.target.value === '0' ? '' : e.target.value)}
            className="w-full cursor-pointer"
            style={{ accentColor: '#cdb78f' }} />
          <div className="mt-3">
            <FilterChipGroup
              label=""
              value={minSalary}
              onChange={(v) => setMinSalary(v)}
              items={[5000, 10000, 15000, 20000, 30000].map(v => ({
                value: String(v),
                label: `${v / 1000}K+`,
              }))}
            />
          </div>
        </div>

        {/* Faz E4: Tarih filtresi */}
        <div>
          <FilterChipGroup
            label="Tarih"
            value={datePreset}
            onChange={setDatePreset}
            items={[
              { value: 'TODAY',    label: 'Bugün' },
              { value: 'TOMORROW', label: 'Yarın' },
              { value: 'WEEK',     label: 'Bu Hafta' },
              { value: 'WEEKEND',  label: 'Haftasonu' },
              { value: 'CUSTOM',   label: 'Özel...' },
            ]}
          />
          {datePreset === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-[0.22em]" style={{ color: '#928678' }}>Başlangıç</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="input text-sm mt-1.5" />
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-[0.22em]" style={{ color: '#928678' }}>Bitiş</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  min={customFrom || new Date().toISOString().split('T')[0]}
                  className="input text-sm mt-1.5" />
              </div>
            </div>
          )}
        </div>

        {/* Legacy vardiya kategorisi filtresi kaldirildi — slot tarih/saat filtreleri yeterli */}

        {activeFilterCount > 0 && (
          <div className="flex justify-end pt-1">
            <button onClick={clearFilters}
              className="text-[11px] font-medium inline-flex items-center gap-1 transition-colors"
              style={{ color: '#928678' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#d39481' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#928678' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
              Filtreleri temizle
            </button>
          </div>
        )}

        {/* FAZ 5 — Kayıtlı aramalar + "Aramayı Kaydet" */}
        <div className="pt-3" style={{ borderTop: '1px solid rgba(205, 183, 143, 0.10)' }}>
          <SavedSearchManager
            filters={{
              position, jobType, district, keyword: debouncedKeyword, minSalary,
              dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo, shifts,
            }}
            onApply={(s) => {
              setPosition(s.position || '')
              setJobType(s.jobType || '')
              setDistrict(s.district || '')
              setKeyword(s.keyword || '')
              setMinSalary(s.minSalary != null ? String(s.minSalary) : '')
              setShifts(s.shifts ? Array.from(s.shifts) : [])
              if (s.dateFrom && s.dateTo) {
                setDatePreset('CUSTOM')
                setCustomFrom(s.dateFrom)
                setCustomTo(s.dateTo)
              } else {
                setDatePreset(''); setCustomFrom(''); setCustomTo('')
              }
              toast.success(`"${s.name}" uygulandı`)
            }}
          />
        </div>
        </div>  {/* card filtre paneli kapanis */}
      </aside>

      {/* SAG PANEL — header + search + chip bar + ilan grid + pagination */}
      <section className="space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-semibold"
                style={{ color: '#f5efe2', letterSpacing: '-0.02em' }}>İş İlanları</h2>
            <p className="text-[12px] mt-1 tabular-nums" style={{ color: '#928678' }}>
              {loading ? '...' : `${listings.length} ilan`}
              {activeFilterCount > 0 && ` · ${activeFilterCount} filtre aktif`}
            </p>
          </div>
          <button onClick={() => setShowFilters(s => !s)}
            className="xl:hidden btn-secondary text-sm flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="21" y1="4" x2="14" y2="4" /><line x1="10" y1="4" x2="3" y2="4" />
              <line x1="21" y1="12" x2="12" y2="12" /><line x1="8" y1="12" x2="3" y2="12" />
              <line x1="21" y1="20" x2="16" y2="20" /><line x1="12" y1="20" x2="3" y2="20" />
              <line x1="14" y1="2" x2="14" y2="6" /><line x1="8" y1="10" x2="8" y2="14" />
              <line x1="16" y1="18" x2="16" y2="22" />
            </svg>
            Filtreler
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                      color: '#1a1208',
                    }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <ActiveFilterBar
          filters={{ keyword: debouncedKeyword, position, jobType, district, minSalary, shifts, datePreset, customFrom, customTo }}
          labels={{ POSITION_LABELS, JOB_TYPE_LABELS }}
          onRemove={(key) => {
            if (key === 'keyword')   { setKeyword(''); setDebouncedKeyword('') }
            if (key === 'position')  setPosition('')
            if (key === 'jobType')   setJobType('')
            if (key === 'district')  setDistrict('')
            if (key === 'minSalary') setMinSalary('')
            if (key === 'datePreset'){ setDatePreset(''); setCustomFrom(''); setCustomTo('') }
            if (key.startsWith('shift:')) setShifts(prev => prev.filter(s => s !== key.slice(6)))
          }}
          onClearAll={clearFilters}
        />

        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
               width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#928678"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="İlan başlığında ara..."
            className="input pl-10 text-sm" />
          {keyword && (
            <button onClick={() => setKeyword('')}
              aria-label="Aramayı temizle"
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: '#928678' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ede4d3' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#928678' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonListingGrid count={6} />
        ) : listings.length === 0 ? (
          <div className="card">
            <EmptyState
              type={activeFilterCount > 0 ? 'search' : 'listings'}
              title={activeFilterCount > 0 ? 'Filtrelere uyan ilan yok' : 'Henüz aktif ilan yok'}
              description={activeFilterCount > 0
                ? 'Filtreleri değiştir veya temizleyerek daha fazla ilan görebilirsin.'
                : 'Daha sonra tekrar kontrol et — yeni ilanlar her gün eklenir.'}
              ctaLabel={activeFilterCount > 0 ? 'Filtreleri Temizle' : null}
              onCta={clearFilters}
            />
          </div>
        ) : (
          <>
            <motion.div
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={LIST_STAGGER}
              initial="hidden"
              animate="visible"
              key={safePage}  /* sayfa degisince stagger tekrar oynar */
            >
              {pageItems.map(listing => (
                <motion.div key={listing.id} variants={LIST_ITEM}>
                  <ListingCard
                    listing={listing}
                    onApply={setApplyTarget}
                    onDetail={openDetail}
                    savedIds={savedIds}
                    onToggleSave={handleToggleSave}
                  />
                </motion.div>
              ))}
            </motion.div>
            {totalPages > 1 && (
              <ListingsPagination page={safePage} totalPages={totalPages} onChange={(p) => {
                setPage(p)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }} />
            )}
          </>
        )}
      </section>


      {/* #47 — Detail kendi route */}

      {applyTarget && (
        <ApplyModal
          listing={applyTarget}
          onClose={() => setApplyTarget(null)}
          onSuccess={() => onApplicationSubmitted?.()}
          onMessagesOpen={(convId) => onMessagesOpen?.(convId)}
        />
      )}
    </div>
  )
}

/* Dalga 1 — Aktif filtre yatay scroll bar (her chip'te X ile sil) */
const DATE_PRESET_LABELS = {
  TODAY: 'Bugün', TOMORROW: 'Yarın', WEEK: 'Bu Hafta',
  WEEKEND: 'Haftasonu', CUSTOM: 'Özel Tarih',
}
const SHIFT_LABELS_INLINE = { MORNING: 'Sabah', EVENING: 'Akşam', NIGHT: 'Gece' }

function ActiveFilterBar({ filters, labels, onRemove, onClearAll }) {
  const { POSITION_LABELS: posLabels, JOB_TYPE_LABELS: jobLabels } = labels
  const chips = []
  if (filters.keyword)   chips.push({ key: 'keyword',   text: `"${filters.keyword}"` })
  if (filters.district)  chips.push({ key: 'district',  text: filters.district })
  if (filters.position)  chips.push({ key: 'position',  text: posLabels[filters.position] || filters.position })
  if (filters.jobType)   chips.push({ key: 'jobType',   text: jobLabels[filters.jobType] || filters.jobType })
  if (filters.minSalary) chips.push({ key: 'minSalary', text: `${Number(filters.minSalary).toLocaleString('tr-TR')} ₺+` })
  if (filters.datePreset) {
    const dt = filters.datePreset === 'CUSTOM' && (filters.customFrom || filters.customTo)
      ? `${filters.customFrom || '...'} → ${filters.customTo || '...'}`
      : DATE_PRESET_LABELS[filters.datePreset] || filters.datePreset
    chips.push({ key: 'datePreset', text: dt })
  }
  (filters.shifts || []).forEach(s =>
    chips.push({ key: `shift:${s}`, text: SHIFT_LABELS_INLINE[s] || s })
  )

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 -mx-1 px-1">
      <div className="flex items-center gap-2 overflow-x-auto flex-1 py-1
                      [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map(c => (
          <button key={c.key}
            type="button"
            onClick={() => onRemove(c.key)}
            className="group flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(205, 183, 143, 0.10)',
              color: '#cdb78f',
              border: '1px solid rgba(205, 183, 143, 0.22)',
            }}>
            <span className="truncate max-w-[180px]">{c.text}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                 className="opacity-65 group-hover:opacity-100" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        ))}
      </div>
      <button onClick={onClearAll}
        type="button"
        className="text-[10px] font-semibold uppercase tracking-[0.18em] px-2.5 py-1.5 rounded-full flex-shrink-0 transition-all hover:-translate-y-0.5"
        style={{
          background: 'rgba(180, 106, 85, 0.10)',
          color: '#d39481',
          border: '1px solid rgba(180, 106, 85, 0.28)',
        }}>
        Hepsini Temizle
      </button>
    </div>
  )
}

/* FAZ 5.13 — Reusable filter chip group (Bebas label + dark glass chips) */
function FilterChipGroup({
  label,
  value,
  onChange,
  items,
  allLabel = 'Tümü',
  multi = false,
  layout = 'flex',  // 'flex' | 'grid-3'
}) {
  const isActive = (v) => (multi
    ? Array.isArray(value) && value.includes(v)
    : value === v)

  function handleClick(v) {
    if (multi) {
      const arr = Array.isArray(value) ? value : []
      onChange(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v])
    } else {
      onChange(value === v ? '' : v)
    }
  }

  const wrapperClass = layout === 'grid-3'
    ? 'grid grid-cols-3 gap-2'
    : 'flex flex-wrap gap-2'

  return (
    <div>
      {label && (
        <label className="block mb-2 text-[11px] font-semibold tracking-[0.22em] uppercase"
               style={{ color: '#928678' }}>
          {label}
        </label>
      )}
      <div className={wrapperClass}>
        {!multi && (
          <FilterChip active={!value} onClick={() => onChange('')}>
            {allLabel}
          </FilterChip>
        )}
        {items.map(it => (
          <FilterChip key={it.value} active={isActive(it.value)}
                      sub={it.sub} onClick={() => handleClick(it.value)}>
            {it.label}
          </FilterChip>
        ))}
      </div>
    </div>
  )
}

/* shadcn-style pagination — 6'lik sayfalar */
function ListingsPagination({ page, totalPages, onChange }) {
  function pageNumbers() {
    const out = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) out.push(i)
      return out
    }
    out.push(1)
    if (page > 4) out.push('…')
    const start = Math.max(2, page - 1)
    const end   = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) out.push(i)
    if (page < totalPages - 3) out.push('…')
    out.push(totalPages)
    return out
  }
  return (
    <nav className="flex items-center justify-center gap-1 pt-4 flex-wrap" aria-label="Sayfalama">
      <ListingsPageBtn disabled={page === 1} onClick={() => onChange(page - 1)} ariaLabel="Önceki">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span className="ml-1">Önceki</span>
      </ListingsPageBtn>
      {pageNumbers().map((n, i) => (
        n === '…'
          ? <span key={`e${i}`} className="w-9 text-center text-[13px]" style={{ color: '#6b6358' }}>…</span>
          : <ListingsPageBtn key={n} active={n === page} onClick={() => onChange(n)} ariaLabel={`Sayfa ${n}`}>
              {n}
            </ListingsPageBtn>
      ))}
      <ListingsPageBtn disabled={page === totalPages} onClick={() => onChange(page + 1)} ariaLabel="Sonraki">
        <span className="mr-1">Sonraki</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </ListingsPageBtn>
    </nav>
  )
}

function ListingsPageBtn({ children, active, disabled, onClick, ariaLabel }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            aria-label={ariaLabel} aria-current={active ? 'page' : undefined}
            className="min-w-[36px] h-9 inline-flex items-center justify-center px-3 rounded-xl text-[12px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{
              background: active ? 'rgba(205, 183, 143, 0.12)' : 'rgba(27, 24, 21, 0.75)',
              color:      active ? '#f5efe2' : '#c9bdaa',
              border:    `1px solid ${active ? 'rgba(205, 183, 143, 0.42)' : 'rgba(205, 183, 143, 0.10)'}`,
            }}>
      {children}
    </button>
  )
}

function FilterChip({ active, sub, onClick, children }) {
  const style = active
    ? {
        background: 'rgba(205, 183, 143, 0.14)',
        color: '#f5efe2',
        border: '1px solid rgba(205, 183, 143, 0.45)',
      }
    : {
        background: 'rgba(27, 24, 21, 0.75)',
        color: '#c9bdaa',
        border: '1px solid rgba(205, 183, 143, 0.10)',
      }
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all hover:-translate-y-0.5"
      style={style}>
      <div>{children}</div>
      {sub && (
        <div className="text-[10px] mt-0.5 font-normal tabular-nums"
             style={{ opacity: 0.65 }}>
          {sub}
        </div>
      )}
    </button>
  )
}
