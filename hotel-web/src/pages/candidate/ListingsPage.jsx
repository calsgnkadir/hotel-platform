import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
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
import ListingsMapView from '../../components/ListingsMapView'
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
    try {
      // 1) Application gönder backend conversation açar + sistem mesajı yazar
      const appResp = await hotelApi.applyToListing({
        jobListingId: listing.id,
        coverLetter,
        slotIds: selectedSlotIds,
        grantedSensitiveTypes: [],   // legacy alan — yeni akışta kullanılmaz
      })

      const convId = appResp.conversationId
      // 2) Seçili dosyaları conversation'a attachment olarak yükle
      if (convId && files.length > 0) {
        toast.loading(`${files.length} belge yükleniyor...`, { id: 'upload' })
        for (const f of files) {
          try {
            await hotelApi.sendMessageAttachment(convId, f, '')
          } catch (err) {
            toast.error(`${f.name} yüklenemedi: ${extractErrorMessage(err)}`, { id: f.name })
          }
        }
        toast.dismiss('upload')
      }

      toast.success('Başvurun gönderildi! Mesajlaşma açıldı.')
      onSuccess?.()
      onClose()
      // 3) Mesajlaşma sekmesine yönlendir
      onMessagesOpen?.(convId)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-cream-200 sticky top-0 bg-white dark:bg-ink-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)' }}>
              {BUSINESS_TYPE_LETTER[listing.businessType] || '?'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink-900">{listing.title}</h2>
              <p className="text-sm text-ink-500">{listing.businessName} · {listing.businessDistrict}</p>
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

          {/* Footer */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-ink-800 py-3 -mx-6 px-6 border-t border-cream-200">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">İptal</button>
            <button type="submit" disabled={loading || !hasFutureSlots}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
              style={{ background: '#047857', boxShadow: '0 3px 12px rgba(4,120,87,0.35)' }}>
              {loading ? 'Gönderiliyor...' : !hasFutureSlots ? 'Süresi Doldu' : 'Başvur'}
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
                 style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)' }}>
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
function ListingCard({ listing, onApply, onDetail }) {
  const shift = null  // legacy shift kategorisi kaldirildi
  const salary = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)

  return (
    <div
      onClick={() => onDetail(listing)}
      className="card cursor-pointer hover:-translate-y-1 transition-all duration-200 group overflow-hidden !p-0"
    >
      {/* HERO — foto-merkezli üst alan */}
      <div className="relative h-32 w-full overflow-hidden"
           style={{
             background: 'linear-gradient(135deg, #15243d 0%, #234a82 100%)',
           }}>
        {/* Galeri fotoğrafları varsa hover carousel; yoksa düz gradient (placeholder harfi kaldirildi) */}
        {listing.businessPhotoUrls?.length > 0 && (
          <HoverPhotoCarousel photos={listing.businessPhotoUrls}
                              alt={`${listing.businessName} galeri`} />
        )}

        {/* Job type chip — sağ üst */}
        <span className="absolute top-3 right-3 text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-md z-10"
              style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
          {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
        </span>

        {/* Salary chip — sol alt (öne çıkar) */}
        {salary && (
          <span className="absolute bottom-3 left-3 text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md z-10"
                style={{ background: 'rgba(0,0,0,0.40)', color: '#fff' }}>
            {salary}
          </span>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-4 flex flex-col">
        <h3 className="font-bold text-base leading-snug line-clamp-2 group-hover:opacity-90 transition-opacity"
            style={{ color: '#f1f5fb' }}>
          {listing.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          <p className="text-sm inline-flex items-center" style={{ color: '#fde9a5' }}>
            {listing.businessName}
            {listing.businessVerified && <VerifiedBadge size="sm" />}
          </p>
          {listing.businessReviewCount > 0 && (
            <StarRating value={listing.businessAverageRating}
              count={listing.businessReviewCount} size="xs" />
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-2 text-xs flex-wrap" style={{ color: '#fde9a5' }}>
          <span>{listing.businessDistrict || 'İstanbul'}</span>
          <span>·</span>
          <span>{POSITION_LABELS[listing.position] || listing.position}</span>
          {shift && (
            <>
              <span>·</span>
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
            <div className="text-xs font-medium mt-1.5" style={{ color: '#fbbf24' }}>
              {slots.length} vardiya
              {openCount === 0 && ' · tümü dolu'}
              {openCount > 0 && nextStr && ` · ${nextStr}`}
            </div>
          )
        })()}

        <p className="text-xs mt-2 line-clamp-2" style={{ color: '#fde9a5', opacity: 0.85 }}>{listing.description}</p>

        {/* Tek CTA — kart tiklamasi detaya goturur, sadece "Basvur" butonu durur */}
        <div className="mt-4">
          <button
            onClick={(e) => { e.stopPropagation(); onApply(listing) }}
            className="w-full py-2 px-3 text-sm font-bold text-white rounded-lg
                       transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #d4a853, #d4a853)', boxShadow: '0 4px 16px rgba(212, 168, 83,0.40)' }}>
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
  const [highlightedId, setHighlightedId] = useState(null)   // FAZ 1/#30

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
  const filters = {
    position, jobType, shifts, district, minSalary,
    keyword: debouncedKeyword,
    dateFrom: dateRange.dateFrom,
    dateTo:   dateRange.dateTo,
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

  return (
    <div className="xl:grid xl:grid-cols-5 xl:gap-4 space-y-4 xl:space-y-0">
      {/* SOL PANEL — header + filtre + liste */}
      <div className="xl:col-span-3 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900">İş İlanları</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            {loading ? '...' : `${listings.length} ilan`}
            {activeFilterCount > 0 && ` · ${activeFilterCount} filtre aktif`}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(s => !s)}
            className="sm:hidden btn-secondary text-sm flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="21" y1="4" x2="14" y2="4" />
              <line x1="10" y1="4" x2="3" y2="4" />
              <line x1="21" y1="12" x2="12" y2="12" />
              <line x1="8" y1="12" x2="3" y2="12" />
              <line x1="21" y1="20" x2="16" y2="20" />
              <line x1="12" y1="20" x2="3" y2="20" />
              <line x1="14" y1="2" x2="14" y2="6" />
              <line x1="8" y1="10" x2="8" y2="14" />
              <line x1="16" y1="18" x2="16" y2="22" />
            </svg>
            Filtreler
            {activeFilterCount > 0 && (
              <span className="bg-brand-700 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Dalga 1 — Aktif filtre bar (yatay scroll chip'ler) */}
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
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
             width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className={`card p-4 space-y-4 ${showFilters ? '' : 'hidden sm:block'}`}>
        {/* Dalga 1 — Eski "FİLTRE AKTİF" banner üst ActiveFilterBar'a tasindi */}

        {/* İlçe — dropdown (39 ilçe pill chip mantıksız) */}
        <div>
          <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider block mb-1">İlçe</label>
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
            <label className="text-xs font-semibold text-ink-500 uppercase tracking-wider">Min Ücret</label>
            <span className="text-sm font-bold text-brand-700 dark:text-brand-300">
              {minSalary ? `${Number(minSalary).toLocaleString('tr-TR')} ₺+` : 'Tümü'}
            </span>
          </div>
          <input type="range" min="0" max="50000" step="1000"
            value={minSalary || 0}
            onChange={e => setMinSalary(e.target.value === '0' ? '' : e.target.value)}
            className="w-full accent-brand-600 cursor-pointer" />
          <div className="mt-2">
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
                <label className="text-xs text-ink-500">Başlangıç</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="input text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-ink-500">Bitiş</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  min={customFrom || new Date().toISOString().split('T')[0]}
                  className="input text-sm mt-1" />
              </div>
            </div>
          )}
        </div>

        {/* Legacy vardiya kategorisi filtresi kaldirildi — slot tarih/saat filtreleri yeterli */}

        {activeFilterCount > 0 && (
          <div className="flex justify-end pt-1">
            <button onClick={clearFilters}
              className="text-xs text-ink-500 hover:text-brand-700 dark:text-brand-700 font-medium inline-flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
              Filtreleri temizle
            </button>
          </div>
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
        <motion.div
          className="grid sm:grid-cols-2 xl:grid-cols-2 lg:grid-cols-3 gap-4"
          variants={LIST_STAGGER}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.05, margin: '0px 0px -10% 0px' }}
        >
          {listings.map(listing => (
            <motion.div key={listing.id}
              variants={LIST_ITEM}
              onMouseEnter={() => setHighlightedId(listing.id)}
              onMouseLeave={() => setHighlightedId(null)}>
              <ListingCard
                listing={listing}
                onApply={setApplyTarget}
                onDetail={openDetail}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
      </div>  {/* SOL PANEL kapanış */}

      {/* SAĞ PANEL — Harita (xl+ ekranda sticky) */}
      <aside className="hidden xl:block xl:col-span-2">
        <div className="sticky top-4" style={{ height: 'calc(100vh - 6rem)' }}>
          {!loading && listings.length > 0 && (
            <ListingsMapView
              listings={listings}
              highlightedId={highlightedId}
              onMarkerClick={openDetail}
            />
          )}
          {!loading && listings.length === 0 && (
            <div className="card h-full flex items-center justify-center text-center">
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: '#0c1726' }}>
                  Filtreye uyan ilan yok
                </p>
                <p className="text-xs" style={{ color: '#1e3a5f' }}>
                  Filtreleri değiştir, harita yeniden çizilir.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>


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
            className="group flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(212, 168, 83, 0.12)',
              color: '#fde9a5',
              border: '1px solid rgba(212, 168, 83, 0.28)',
            }}>
            <span className="truncate max-w-[180px]">{c.text}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                 className="opacity-70 group-hover:opacity-100" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        ))}
      </div>
      <button onClick={onClearAll}
        type="button"
        className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-full flex-shrink-0 transition-all hover:-translate-y-0.5"
        style={{
          background: 'rgba(248, 113, 113, 0.10)',
          color: '#f87171',
          border: '1px solid rgba(248, 113, 113, 0.30)',
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
        <label className="block mb-2 font-bebas text-xs tracking-[0.2em] uppercase"
               style={{ color: '#fde9a5' }}>
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

function FilterChip({ active, sub, onClick, children }) {
  const style = active
    ? {
        background: 'linear-gradient(135deg, #1e3a5f 0%, #b8902d 100%)',
        color: '#ffffff',
        border: '1px solid transparent',
        boxShadow: '0 0 14px rgba(212, 168, 83, 0.40)',
      }
    : {
        background: 'rgba(21, 36, 61, 0.65)',
        color: '#fde9a5',
        border: '1px solid rgba(212, 168, 83, 0.18)',
      }
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:-translate-y-0.5"
      style={style}>
      <div>{children}</div>
      {sub && (
        <div className="text-[10px] mt-0.5 font-normal"
             style={{ opacity: 0.75 }}>
          {sub}
        </div>
      )}
    </button>
  )
}
