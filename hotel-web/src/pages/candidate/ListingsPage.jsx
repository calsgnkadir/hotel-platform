import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { motion } from 'framer-motion'

// Liste girişi: sakin, kısa (kurumsal ton; ölçek/zıplama yok)
const LIST_STAGGER = {
  hidden:  { opacity: 1 },
  visible: { opacity: 1, transition: { staggerChildren: 0.03 } },
}
const LIST_ITEM = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import { keys } from '../../lib/queryClient'
import EmptyState from '../../components/EmptyState'
import { SkeletonListingGrid } from '../../components/Skeleton'
import SavedSearchManager from '../../components/SavedSearchManager'
// ListingsMapView kaldirildi (kullanici istegi)
import { formatSalary, formatPayment } from '../../lib/salary'  // FAZ 2/#25
import { requestPushMoment } from '../../lib/webpush'
import { useMyLocation } from '../../lib/useMyLocation'                    // FAZ B.3
import { distanceKm, formatDistance } from '../../lib/distance'            // FAZ B.3
import {
  shiftDuration, formatShiftRange, compareSlots, isShiftStarted, nearestShift,
  relativeDayLabel, localDateISO,
} from '../../lib/shiftTime'                                                  // FAZ B.5.5 + gece vardiyası
import BusinessLogo from '../../components/BusinessLogo'
import LoadError from '../../components/ui/LoadError'
import useFocusTrap from '../../lib/useFocusTrap'
import { POSITION_LABELS, JOB_TYPE_LABELS, labelOf } from '../../utils/labels'
import { SHIFT_BANDS, SHIFT_BAND_LABELS, listingMatchesBands } from '../../lib/shiftBand'

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
  // Ön yazı varsayılan kapalı; kullanıcı "Not ekle"ye basınca açılır ve o an odaklanır
  // (açılışta autoFocus yok — mobilde klavye kendiliğinden açılmasın).
  const [showNote, setShowNote] = useState(false)
  const noteRef = useRef(null)
  useEffect(() => { if (showNote) noteRef.current?.focus() }, [showNote])

  const allSlots = [...(listing.shiftSlots || [])].sort(compareSlots)
  const hasSlots = allSlots.length > 0

  // F0/bugfix: TARİH değil, yerel başlangıç anına göre kontrol.
  // Başlamış vardiyaya (gece vardiyası dahil) başvuru engellenir.
  function isPastSlot(s) {
    return isShiftStarted(s)
  }
  const futureSlots = allSlots.filter(s => !isPastSlot(s))
  const hasFutureSlots = futureSlots.length > 0

  function toggleSlot(id, full, past) {
    if (full || past) return
    setSelectedSlotIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
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
      })

      const convId = appResp.conversationId
      // FAZ 11.W1.3 — success state: summary card + auto-close 6s
      setSuccessResp({ conversationId: convId, applicationId: appResp.id })
      setSubmitState('success')
      onSuccess?.()
      // Bildirim izni için doğru an: kart, onay penceresi kapanınca çıkar
      requestPushMoment('applied')
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
      ? `${new Date(`${firstSlot.date}T00:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} · ${formatShiftRange(firstSlot.startTime, firstSlot.endTime, { short: true })}`
      : null
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-8 flex flex-col items-center text-center">
            {/* Check morph icon */}
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                 style={{
                   background: 'rgba(107, 117, 116, 0.14)',
                   border: '1px solid rgba(107, 117, 116, 0.42)',
                   boxShadow: 'none',
                 }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b7574"
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

            <h2 className="type-section">Başvurun gönderildi</h2>
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
                          background: i === 0 ? '#1f2937' : 'rgba(31, 41, 55, 0.20)',
                          border: '1px solid rgba(31, 41, 55, 0.42)',
                        }} />
                  <span className="type-overline mt-2"
                        style={{ color: i === 0 ? 'var(--accent-action)' : 'var(--text-faint)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-8 w-full max-w-[320px]">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Başka ilan bul
              </button>
              <button type="button" onClick={handleOpenMessages} className="btn-primary flex-1">
                Mesajlaşmayı aç
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

  // UI Paket 3 — mobil öncelikli akış: vardiya (zorunlu) → ödeme/kıyafet özeti → isteğe bağlı not.
  const selectedCount = selectedSlotIds.length
  const needsSlot = hasSlots && hasFutureSlots && selectedCount === 0
  const submitDisabled = loading || !hasFutureSlots || needsSlot
  const submitLabel = loading
    ? 'Gönderiliyor…'
    : !hasFutureSlots
      ? 'Süresi doldu'
      : selectedCount > 0 ? `${selectedCount} vardiyaya başvur` : 'Başvur'
  const paymentText = formatPayment(listing.paymentPeriod, listing.paymentMethod)
  const dressText = listing.dressCode ? String(listing.dressCode).split('\n')[0].trim() : ''

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-sheet" role="dialog" aria-modal="true" aria-labelledby="apply-modal-title"
           onClick={e => e.stopPropagation()}>
        {/* Header — işletme logosu / baş harfi + pozisyon */}
        <div className="modal-sheet__head">
          <div className="flex items-center gap-3 min-w-0">
            {(listing.businessLogoUrl || listing.businessName) && (
              <BusinessLogo name={listing.businessName} logoUrl={listing.businessLogoUrl} size="sm" />
            )}
            <div className="min-w-0">
              <h2 id="apply-modal-title" className="type-card truncate">{listing.title}</h2>
              <p className="type-meta truncate">
                {[listing.businessName, listing.businessDistrict].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-sheet__form">
          <div className="modal-sheet__body space-y-5">
            {/* 1) Vardiya seçimi (zorunlu — min 1) */}
            {hasSlots ? (
              <fieldset>
                <legend className="type-label mb-2" style={{ color: 'var(--ah-ink)' }}>
                  Vardiya seçimi *
                  <span className="type-caption ml-1" style={{ color: 'var(--ah-ink-3)' }}>çalışabileceğin günleri işaretle</span>
                </legend>
                <div className="space-y-2">
                  {allSlots.map(s => {
                    const full = s.full || (s.slotsFilled >= s.slotsNeeded)
                    const past = isPastSlot(s)
                    const disabled = full || past
                    const selected = selectedSlotIds.includes(s.id)
                    const dateLabel = new Date(`${s.date}T00:00:00`).toLocaleDateString('tr-TR', {
                      day: 'numeric', month: 'short', weekday: 'short',
                    })
                    const timeLabel = formatShiftRange(s.startTime, s.endTime)
                    const openCount = (s.slotsNeeded || 0) - (s.slotsFilled || 0)
                    return (
                      <label key={s.id} className="ah-slot-option"
                             data-state={disabled ? 'disabled' : selected ? 'selected' : 'idle'}>
                        <input type="checkbox" checked={selected} disabled={disabled}
                          onChange={() => toggleSlot(s.id, full, past)}
                          className="w-5 h-5 flex-shrink-0" style={{ accentColor: 'var(--ah-brand)' }} />
                        <span className="flex-1 min-w-0">
                          <span className="type-subhead type-num block" style={{ color: 'var(--ah-ink)' }}>
                            {dateLabel} · {timeLabel}
                          </span>
                          <span className="type-caption block mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
                            {past
                              ? 'Geçti — başvurulamaz'
                              : full
                                ? 'Doldu'
                                : `${openCount} kişi aranıyor`}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ) : (
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 type-meta text-amber-700">
                Bu ilana henüz vardiya eklenmemiş — başvuru alınamaz.
              </div>
            )}

            {/* 2) Ödeme / kıyafet — kısa tek satır özet */}
            {(paymentText || dressText) && (
              <p className="type-meta" style={{ color: 'var(--ah-ink-2)' }} data-testid="apply-terms">
                {paymentText && (
                  <><span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Ödeme:</span> {paymentText}</>
                )}
                {paymentText && dressText && <span aria-hidden="true" style={{ color: 'var(--ah-ink-4)' }}> · </span>}
                {dressText && (
                  <><span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Kıyafet:</span> {dressText}</>
                )}
              </p>
            )}

            {/* 3) Ön yazı — varsayılan kapalı; mobilde klavye kendiliğinden açılmasın */}
            {showNote ? (
              <div>
                <label htmlFor="apply-cover-letter" className="label">
                  Not <span className="font-normal" style={{ color: 'var(--ah-ink-3)' }}>(isteğe bağlı)</span>
                </label>
                <textarea
                  id="apply-cover-letter"
                  ref={noteRef}
                  value={coverLetter}
                  onChange={e => setCoverLetter(e.target.value)}
                  className="input resize-none h-24 type-body"
                  placeholder="Kendini kısaca tanıt; bu işte neden iyi olacağını yaz."
                />
              </div>
            ) : (
              <button type="button" onClick={() => setShowNote(true)} className="btn-ghost !w-auto !px-2 -ml-2 gap-1.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                     strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Not ekle (isteğe bağlı)
              </button>
            )}

            <p className="type-caption" style={{ color: 'var(--ah-ink-3)' }}>
              Belge yüklemen gerekmez. İşletme isterse sohbetten paylaşabilirsin.
            </p>
          </div>

          {/* Alt bar — bottom sheet'te sabit; gövde kayar */}
          <div className="modal-sheet__foot">
            {needsSlot && (
              <p id="apply-submit-hint" className="type-caption mb-2" style={{ color: 'var(--ah-ink-3)' }}>
                Önce en az bir vardiya seç
              </p>
            )}
            {/* KVKK — işletme, başvuran adayın adını, e-postasını ve profilini görür */}
            <p className="type-caption mb-2" style={{ color: 'var(--ah-ink-3)' }} data-testid="apply-privacy-note">
              Başvurunla birlikte adın, e-postan ve profil bilgilerin bu işletmeyle paylaşılır.{' '}
              <a href="/kvkk" target="_blank" rel="noopener noreferrer"
                 className="underline" style={{ color: 'var(--ah-ink-2)' }}>
                Aydınlatma metni
              </a>
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                İptal
              </button>
              <button type="submit" disabled={submitDisabled}
                aria-describedby={needsSlot ? 'apply-submit-hint' : undefined}
                className="btn-primary relative overflow-hidden flex-1">
                {loading && (
                  <span aria-hidden className="absolute bottom-0 left-0 h-[2px]"
                        style={{
                          background: 'rgba(255, 255, 255, 0.6)',
                          opacity: 0.55,
                          animation: 'submit-progress 1400ms ease-in-out infinite',
                        }} />
                )}
                {submitLabel}
                <style>{`
                  @keyframes submit-progress {
                    0% { width: 0%; left: 0%; }
                    50% { width: 60%; left: 20%; }
                    100% { width: 0%; left: 100%; }
                  }
                `}</style>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* FAZ B.1 — En yakin (gelecekteki) vardiyanin insan-okunur etiketi.
   Sektorde karar "ne zaman + ne kadar" ile verilir; kartin ana capasi budur. */
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
const TR_DAYS   = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']

const isSlotFull = (s) => !!(s.full || s.slotsFilled >= s.slotsNeeded)

// Başvurulabilir = henüz başlamamış + dolu değil. Gece vardiyası başladığı
// güne aittir ("Bugün 22:00–06:00 +1").
export function nextShiftLabel(slots, now = new Date()) {
  if (!slots?.length) return null
  const s = nearestShift(slots, { now, filter: s => !isSlotFull(s) })
  if (!s) return null
  const more = slots.filter(x => x !== s && x.date && !isShiftStarted(x, now) && !isSlotFull(x)).length
  const d = new Date(`${s.date}T00:00:00`)
  const day = relativeDayLabel(s.date, now)
    || `${TR_DAYS[d.getDay()]} ${d.getDate()} ${TR_MONTHS[d.getMonth()]}`
  const time = formatShiftRange(s.startTime, s.endTime, { short: true })
  return { day, time, dur: shiftDuration(s.startTime, s.endTime), more }
}

/* ── İlan kartı (Paket 4) ──
   Erişilebilirlik: kartın tamamı tıklanabilir ama rolü "button" DEĞİL — başlık
   gerçek bir bağlantı (<a href="/listings/:id">) ve CSS ile kartı kaplar
   (stretched link, .ah-job__link::after). Kaydet ve Başvur düğmeleri bağlantının
   üstünde ayrı katmanda durur; iç içe etkileşimli öğe yoktur. */
export function ListingCard({ listing, onApply, onDetail, savedIds, onToggleSave }) {
  const salaryStr = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)
  const isSaved = savedIds?.has(listing.id)
  const position = POSITION_LABELS[listing.position] || listing.position || 'Personel'
  const href = `/listings/${listing.id}`

  // Ücret değeri + birim ayrı (büyük değer + küçük birim)
  let wageVal = '', wageUnit = ''
  if (salaryStr) {
    const parts = salaryStr.split(' / ')
    wageVal = parts[0]
    wageUnit = parts[1] ? '/ ' + parts[1] : ''
  }

  const shift = nextShiftLabel(listing.shiftSlots)
  const totalSlots = listing.shiftSlots?.length || 0
  // Doldu = başlamamış vardiya var ama hepsi dolu; hiç başlamamış yoksa süresi dolmuş
  const allFull = totalSlots > 0 && !shift && !!nearestShift(listing.shiftSlots)
  const expired = totalSlots > 0 && !shift && !allFull

  function openDetail(e) {
    // Yeni sekme / orta tık tarayıcıya kalsın; normal tıkta SPA yönlendirmesi
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
    e.preventDefault()
    onDetail?.(listing)
  }

  return (
    <article className={`ah-job ${listing.urgent ? 'ah-job--urgent' : ''}`} data-testid="listing-card">
      {/* Üst: logo + pozisyon (bağlantı) + işletme · ilçe · mesafe + kaydet */}
      <div className="ah-job__top">
        <BusinessLogo name={listing.businessName} logoUrl={listing.businessLogoUrl} />
        <div className="ah-job__hd">
          <h3 className="ah-job__title">
            <a href={href} onClick={openDetail} className="ah-job__link">{position}</a>
          </h3>
          {/* Tek meta satırı: işletme · ilçe · mesafe (ayıraçlar CSS'ten) */}
          <div className="ah-job__meta">
            <span className="ah-job__co-name">{listing.businessName}</span>
            <span>{listing.businessDistrict || 'İstanbul'}</span>
            {listing._distanceKm != null && (
              <span className="ah-job__dist" title="Sana kuş uçuşu mesafe">
                {formatDistance(listing._distanceKm)}
              </span>
            )}
          </div>
        </div>
        <button type="button"
                className={`ah-save ${isSaved ? 'ah-save--on' : ''}`}
                onClick={() => onToggleSave?.(listing.id, isSaved)}
                aria-pressed={!!isSaved}
                aria-label={isSaved ? 'Kaydedilenlerden çıkar' : 'Kaydet'}
                title={isSaved ? 'Kaydedilenlerden çıkar' : 'Kaydet'}>
          <svg width="15" height="15" viewBox="0 0 24 24"
               fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      {/* Ana çapa — en yakın vardiya + ücret */}
      <div className="ah-job__band">
        <div className="ah-job__when">
          <span className="ah-job__band-lbl">
            {shift ? 'En yakın vardiya' : allFull ? 'Vardiyalar' : 'Vardiya'}
          </span>
          {shift ? (
            <>
              <span className="ah-job__when-day">{shift.day}</span>
              {shift.time && (
                <span className="ah-job__when-time">
                  {shift.time}
                  {shift.dur && <span className="ah-job__when-dur">{shift.dur}</span>}
                </span>
              )}
            </>
          ) : (
            <span className="ah-job__when-day" style={{ color: 'var(--ah-ink-3)' }}>
              {allFull ? 'Doldu' : totalSlots === 0 ? 'Belirtilmemiş' : 'Geçti'}
            </span>
          )}
        </div>
        <div className="ah-job__wage">
          {wageVal ? (
            <>
              <span className="ah-job__wage-val">{wageVal}</span>
              {wageUnit && <span className="ah-job__wage-unit">{wageUnit}</span>}
            </>
          ) : (
            <span className="ah-job__wage-unit">Ücret görüşülür</span>
          )}
        </div>
      </div>

      {/* Durum + güven + ikincil bilgiler tek satırda (kart kısa kalsın) */}
      <div className="ah-job__tags">
        {expired && <span className="badge badge-neutral">Süresi doldu</span>}
        {allFull && <span className="badge badge-neutral">Vardiyalar dolu</span>}
        {listing.urgent && (
          <span className="ah-chip ah-chip--urgent" title="Acil ilan — işletme hemen personel arıyor">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            Acil
          </span>
        )}
        {listing.businessVerified && (
          <span className="ah-trust-item ah-trust-item--ok" title="İşletme doğrulandı">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
                 strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Doğrulandı
          </span>
        )}
        {listing.businessWorkerCount > 0 && (
          <span className="ah-trust-item" title="Bu işletmede tamamlanan iş sayısı">
            {listing.businessWorkerCount}+ tamamlanan iş
          </span>
        )}
        {listing.jobType && <span className="ah-chip">{labelOf(JOB_TYPE_LABELS, listing.jobType)}</span>}
        {shift && shift.more > 0 && (
          <span className="ah-chip">+{shift.more} vardiya daha</span>
        )}
      </div>

      {/* Başvur: mobilde gizli — kartın tamamı detay bağlantısı ve detay sayfasında
          sabit "Başvur" çubuğu var; böylece 375px'te ilk ekrana en az 2 kart sığar. */}
      {shift && (
        <div className="ah-job__cta hidden sm:block">
          <button type="button" className="ah-btn ah-btn--p ah-btn--block ah-btn--arrow"
                  onClick={() => onApply(listing)}>
            Başvur
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </article>
  )
}

/* ── Ücret sıralaması — birim normalizasyonu ──
   Farklı birimdeki ücretler GÜNLÜK karşılığa çevrilip karşılaştırılır:
     HOURLY  × 8   (8 saatlik iş günü)
     DAILY   × 1
     MONTHLY ÷ 26  (ayda 26 iş günü — 6 gün çalışma)
   Görüşülecek / birimi bilinmeyen / tutarı olmayan ilan null döner ve sıralamada
   sona düşer (bilmediğimiz birimi tahmin etmeyiz; bkz. lib/salary.js). Üst sınır
   varsa o, yoksa alt sınır kullanılır. */
export const WAGE_DAILY_FACTOR = { HOURLY: 8, DAILY: 1, MONTHLY: 1 / 26 }

export function dailyWage(listing) {
  const factor = WAGE_DAILY_FACTOR[listing?.salaryType]
  const raw = listing?.salaryMax ?? listing?.salaryMin
  if (!factor || raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n * factor : null
}

export function compareByDailyWageDesc(a, b) {
  const wa = dailyWage(a), wb = dailyWage(b)
  if (wa == null && wb == null) return 0
  if (wa == null) return 1
  if (wb == null) return -1
  return wb - wa
}

/* Ücret çipleri: ücret birimi çalışma türüne bağlı; "Tümü"yken filtre pasif. */
const SALARY_STEPS = {
  DAILY:     { unit: '₺/gün', values: [500, 800, 1000, 1500, 2000] },
  PART_TIME: { unit: '₺/gün', values: [500, 800, 1000, 1500, 2000] },
  PERMANENT: { unit: '₺/ay',  values: [10000, 15000, 20000, 25000, 30000] },
  SEASONAL:  { unit: '₺/ay',  values: [10000, 15000, 20000, 25000, 30000] },
}
export function salaryUnitFor(jobType) {
  return SALARY_STEPS[jobType]?.unit || null
}

/* ── Listings Page ── */
export const LISTINGS_PAGE_SIZE = 12

function useIsDesktop() {
  const query = '(min-width: 1024px)'
  const get = () => (typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia(query).matches : true)
  const [match, setMatch] = useState(get)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return match
}

export default function ListingsPage({ onApplicationSubmitted, onMessagesOpen }) {
  const navigate = useNavigate()
  const [applyTarget, setApplyTarget] = useState(null)
  // Filtre paneli: lg+ solda hep görünür; daha dar ekranda tam ekran alt sayfa.
  // Her ziyarette kapalı başlar — ilanlar ilk ekranda görünsün.
  const [showFilters, setShowFilters] = useState(false)
  const isDesktop = useIsDesktop()
  const sheetOpen = showFilters && !isDesktop
  const sheetRef = useRef(null)
  const closeSheet = () => setShowFilters(false)
  useFocusTrap(sheetRef, sheetOpen, closeSheet)
  useEffect(() => {
    if (!sheetOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [sheetOpen])

  const [visibleCount, setVisibleCount] = useState(LISTINGS_PAGE_SIZE)

  // Kaydedilen ilan ID'leri (kaydet ikonunun durumu için)
  const queryClient = useQueryClient()
  const { data: savedListings = [] } = useQuery({
    queryKey: ['my-saved-listings'],
    queryFn: () => hotelApi.getMySavedListings(),
    staleTime: 60_000,
  })
  const savedIds = useMemo(() => new Set(savedListings.map(l => l.id)), [savedListings])

  // Engellenen işletmelerin ilanları listeden düşürülür
  const { data: blockedBusinesses = [] } = useQuery({
    queryKey: ['my-blocked-businesses'],
    queryFn: () => hotelApi.getMyBlockedBusinesses(),
    staleTime: 60_000,
  })
  const blockedBusinessIds = useMemo(
    () => new Set(blockedBusinesses.map(b => b.id)), [blockedBusinesses])
  async function handleToggleSave(listingId, currentlySaved) {
    try {
      if (currentlySaved) await hotelApi.unsaveListing(listingId)
      else                await hotelApi.saveListing(listingId)
      queryClient.invalidateQueries({ queryKey: ['my-saved-listings'] })
    } catch {
      toast.error('Kaydetme işlemi başarısız')
    }
  }

  const openDetail = (listing) => navigate(`/listings/${listing.id}`)

  // Filtre durumu
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [position, setPosition] = useState('')
  const [jobType, setJobType] = useState('')
  const [minSalary, setMinSalary] = useState('')
  // Vardiya saati bandları (MORNING/EVENING/NIGHT) — istemci tarafı; API'ye
  // gönderilmez (bkz. lib/shiftBand.js gerekçesi).
  const [shifts, setShifts] = useState([])

  // datePreset: '' | 'TODAY' | 'TOMORROW' | 'WEEK' | 'WEEKEND' | 'CUSTOM'
  const [datePreset, setDatePreset] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const dateRange = (() => {
    const today = new Date()
    const fmt = (d) => localDateISO(d)   // yerel gün (UTC kayması yok)
    const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c }
    switch (datePreset) {
      case 'TODAY':    return { dateFrom: fmt(today),             dateTo: fmt(today) }
      case 'TOMORROW': return { dateFrom: fmt(addDays(today, 1)), dateTo: fmt(addDays(today, 1)) }
      case 'WEEK':     return { dateFrom: fmt(today),             dateTo: fmt(addDays(today, 7)) }
      case 'WEEKEND': {
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

  // Ücret filtresi çalışma türüne bağlı (birim farklı); tür kalkınca ücret de kalkar.
  function chooseJobType(v) {
    setJobType(v)
    if (v !== jobType) setMinSalary('')
  }

  // ranked=true: aday tercihlerine göre "sana özel" sıralama.
  // `shifts` bilerek gönderilmez (istemci tarafında süzülür).
  const filters = {
    position, jobType,
    minSalary: jobType ? minSalary : '',
    keyword: debouncedKeyword,
    dateFrom: dateRange.dateFrom,
    dateTo:   dateRange.dateTo,
    ranked: true,
  }
  const { data: listings = [], isLoading: loading, isFetching, error, refetch } = useQuery({
    queryKey: keys.listings.list(filters),
    queryFn: () => hotelApi.getListings(filters),
    placeholderData: keepPreviousData,  // filtre değişirken eski liste görünür
  })

  function clearFilters() {
    setKeyword(''); setPosition(''); setJobType('')
    setMinSalary(''); setShifts([])
    setDatePreset(''); setCustomFrom(''); setCustomTo('')
  }

  // Boş durumdan tek tıkla "bu aramaya ilan çıkınca haber ver".
  // Vardiya saati kayıtlı aramaya eklenmez (backend eşleştirmesi ilanın boş
  // `shift` alanına bakıyor; eklenirse yeni ilanlarla hiç eşleşmez).
  async function saveCurrentSearchQuick() {
    const parts = [POSITION_LABELS[position], debouncedKeyword].filter(Boolean)
    const name = parts.length ? parts.join(' · ') : 'Kayıtlı arama'
    try {
      await hotelApi.createSavedSearch({
        name,
        position: position || null,
        jobType: jobType || null,
        keyword: debouncedKeyword || null,
        minSalary: jobType && minSalary ? Number(minSalary) : null,
        dateFrom: dateRange.dateFrom || null,
        dateTo: dateRange.dateTo || null,
        shifts: null,
      })
      toast.success('Arama kaydedildi · yeni eşleşmelerde bildirim alacaksın')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  const activeFilterCount =
    (keyword ? 1 : 0) + (position ? 1 : 0) + (jobType ? 1 : 0) +
    (minSalary ? 1 : 0) + shifts.length + (datePreset ? 1 : 0)

  // Konum + mesafe. Kullanıcı açıkça "Yakınlar" derse istenir.
  const myLoc = useMyLocation()
  const [nearbyFirst, setNearbyFirst] = useState(false)
  // 'relevance' = API'nin "sana özel" (ranked) sırası.
  const [sortBy, setSortBy] = useState('relevance')

  // Görünen liste: engelli işletme + vardiya saati süzgeci, mesafe, sıralama.
  // Sayaç, boş durum ve sayfalama hep BU listeyi kullanır.
  const visibleListings = useMemo(() => {
    let list = listings
    if (blockedBusinessIds.size > 0) list = list.filter(l => !blockedBusinessIds.has(l.businessId))
    if (shifts.length > 0) list = list.filter(l => listingMatchesBands(l, shifts))

    if (myLoc.location) {
      list = list.map(l => ({
        ...l,
        _distanceKm: distanceKm(
          myLoc.location.lat, myLoc.location.lng,
          l.businessLatitude, l.businessLongitude
        ),
      }))
    }

    if (nearbyFirst && myLoc.location) {
      list = [...list].sort((a, b) => {
        const da = a._distanceKm, db = b._distanceKm
        if (da == null && db == null) return 0
        if (da == null) return 1
        if (db == null) return -1
        return da - db
      })
    } else if (sortBy === 'newest') {
      list = [...list].sort((a, b) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || (b.id - a.id))
    } else if (sortBy === 'wage') {
      list = [...list].sort(compareByDailyWageDesc)
    }
    return list
  }, [listings, blockedBusinessIds, shifts, myLoc.location, nearbyFirst, sortBy])

  // Genel bakış şeridi — görünen listeden türetilir.
  const overview = useMemo(() => {
    const urgentCount = visibleListings.filter(l => l.urgent).length
    const dists = visibleListings.map(l => l._distanceKm).filter(d => d != null)
    const nearestKm = dists.length ? Math.min(...dists) : null
    // Ortalama günlük ücret: yalnız DAILY tipli ilanlar; taban olarak salaryMin.
    const daily = visibleListings
      .filter(l => l.salaryType === 'DAILY' && l.salaryMin != null)
      .map(l => Number(l.salaryMin))
    const avgDaily = daily.length
      ? Math.round(daily.reduce((sum, v) => sum + v, 0) / daily.length)
      : null
    return { total: visibleListings.length, urgentCount, nearestKm, avgDaily }
  }, [visibleListings])

  const total = visibleListings.length
  const pageItems = useMemo(
    () => visibleListings.slice(0, visibleCount), [visibleListings, visibleCount])
  const remaining = Math.max(0, total - pageItems.length)
  // Filtre/sıralama değişince ilk 12'ye dön
  useEffect(() => { setVisibleCount(LISTINGS_PAGE_SIZE) },
    [debouncedKeyword, position, jobType, minSalary, shifts, datePreset, customFrom, customTo, sortBy, nearbyFirst])

  const salaryCfg = SALARY_STEPS[jobType]
  const showError = !!error && listings.length === 0

  return (
    <div className="ah-surface space-y-3">
      {/* Araç çubuğu: 1. satır arama + Filtreler, 2. satır sayı + sıralama + düğmeler.
          Sayfa başlığı panelde (DashboardLayout) — burada tekrar edilmez. */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                 width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 style={{ color: 'var(--ah-ink-4)' }}
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input type="search" value={keyword} onChange={e => setKeyword(e.target.value)}
              placeholder="İlan başlığında ara"
              aria-label="İlan başlığında ara"
              className="input text-sm"
              style={{ paddingLeft: '2.5rem', paddingRight: keyword ? '2.75rem' : undefined }} />
            {keyword && (
              <button type="button" onClick={() => setKeyword('')}
                aria-label="Aramayı temizle"
                className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center"
                style={{ color: 'var(--ah-ink-3)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setShowFilters(true)}
          aria-expanded={sheetOpen} aria-controls="listing-filters"
          className="lg:hidden btn-secondary flex-shrink-0 !px-3">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M7 12h10M10 18h4" />
          </svg>
          Filtreler
          {activeFilterCount > 0 && (
            <span className="badge badge-neutral tabular-nums" aria-label={`${activeFilterCount} aktif filtre`}>
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 py-0.5 no-scrollbar">
        <span className="type-meta tabular-nums flex-shrink-0 mr-auto pr-1" data-testid="listing-count"
              aria-live="polite">
          {loading ? 'Yükleniyor' : `${total} ilan`}
        </span>
        <label className="inline-flex flex-shrink-0 items-center gap-1.5 type-meta">
          <span className="hidden sm:inline">Sırala</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                  disabled={nearbyFirst}
                  aria-label="Sıralama"
                  title={nearbyFirst ? 'Yakınlar açıkken sıralama mesafeye göre' : 'Sıralama'}
                  className="input text-sm"
                  style={{ padding: '6px 28px 6px 10px', width: 'auto', minWidth: 132 }}>
            <option value="relevance">Sana özel</option>
            <option value="newest">En yeni</option>
            <option value="wage">Ücret (günlük karşılık)</option>
          </select>
        </label>
        <div className="flex-shrink-0 whitespace-nowrap flex items-center gap-2">
          <AvailableNowToggle />
          <NearbyToggle
            nearbyFirst={nearbyFirst}
            onToggle={async () => {
              if (nearbyFirst) { setNearbyFirst(false); return }
              let pos = myLoc.location
              if (!pos) pos = await myLoc.request()
              if (pos) setNearbyFirst(true)
            }}
            loading={myLoc.loading}
            hasLocation={!!myLoc.location}
            error={myLoc.error}
          />
        </div>
      </div>

      {/* Mini genel bakış — mobilde gizli (ilk ekranda kartlara yer kalsın) */}
      {!loading && !showError && overview.total > 0 && (
        <div className="hidden sm:block">
          <OverviewStrip overview={overview} hasLocation={!!myLoc.location} />
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-5 lg:items-start space-y-3 lg:space-y-0">
      <aside id="listing-filters" ref={sheetRef}
             className={`ah-filter-sheet${sheetOpen ? ' is-open' : ''}`}
             role={sheetOpen ? 'dialog' : undefined}
             aria-modal={sheetOpen ? 'true' : undefined}
             aria-labelledby={sheetOpen ? 'listing-filters-title' : undefined}
             aria-label={sheetOpen ? undefined : 'Filtreler'}>
        <div className="ah-filter-sheet__head">
          <h2 id="listing-filters-title" className="type-section">Filtreler</h2>
          <button type="button" onClick={closeSheet} aria-label="Filtreleri kapat"
                  className="w-11 h-11 grid place-items-center rounded-lg -mr-2"
                  style={{ color: 'var(--ah-ink-2)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="ah-filter-sheet__body">
        <div className="card ah-filter-card">
          <div className="space-y-3">
            <FilterRow label="Tarih">
              {[
                { v: '',         l: 'Tümü' },
                { v: 'TODAY',    l: 'Bugün' },
                { v: 'TOMORROW', l: 'Yarın' },
                { v: 'WEEK',     l: 'Bu hafta' },
                { v: 'WEEKEND',  l: 'Hafta sonu' },
                { v: 'CUSTOM',   l: 'Özel tarih' },
              ].map(o => (
                <FilterChip key={o.v} active={datePreset === o.v}
                            onClick={() => setDatePreset(o.v)}>{o.l}</FilterChip>
              ))}
            </FilterRow>

            {datePreset === 'CUSTOM' && (
              <div className="grid grid-cols-2 gap-3 max-w-md">
                <FilterField label="Başlangıç" htmlFor="lf-from">
                  <input id="lf-from" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    min={localDateISO()} className="input text-sm" />
                </FilterField>
                <FilterField label="Bitiş" htmlFor="lf-to">
                  <input id="lf-to" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    min={customFrom || localDateISO()} className="input text-sm" />
                </FilterField>
              </div>
            )}

            <FilterRow label="Vardiya saati">
              <FilterChip active={shifts.length === 0} onClick={() => setShifts([])}>Tümü</FilterChip>
              {SHIFT_BANDS.map(b => {
                const on = shifts.includes(b.id)
                return (
                  <FilterChip key={b.id} active={on}
                              onClick={() => setShifts(prev => on ? prev.filter(x => x !== b.id) : [...prev, b.id])}>
                    {b.label} <span className="tabular-nums" style={{ opacity: 0.75 }}>{b.hint}</span>
                  </FilterChip>
                )
              })}
            </FilterRow>

            <FilterRow label="Çalışma türü">
              <FilterChip active={!jobType} onClick={() => chooseJobType('')}>Tümü</FilterChip>
              {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => (
                <FilterChip key={v} active={jobType === v}
                            onClick={() => chooseJobType(jobType === v ? '' : v)}>{l}</FilterChip>
              ))}
            </FilterRow>

            <FilterRow label={salaryCfg ? `En az ücret (${salaryCfg.unit})` : 'En az ücret'}>
              {salaryCfg ? (
                <>
                  <FilterChip active={!minSalary} onClick={() => setMinSalary('')}>Tümü</FilterChip>
                  {salaryCfg.values.map(v => (
                    <FilterChip key={v} active={minSalary === String(v)}
                                onClick={() => setMinSalary(minSalary === String(v) ? '' : String(v))}>
                      {v.toLocaleString('tr-TR')} {salaryCfg.unit}+
                    </FilterChip>
                  ))}
                </>
              ) : (
                <span className="type-caption" data-testid="salary-hint">Önce çalışma türü seç</span>
              )}
            </FilterRow>

            <div className="max-w-xs">
              <FilterField label="Pozisyon" htmlFor="lf-position">
                <select id="lf-position" value={position} onChange={e => setPosition(e.target.value)} className="input text-sm">
                  <option value="">Tüm pozisyonlar</option>
                  {Object.entries(POSITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </FilterField>
            </div>
          </div>

          <div className="flex items-start gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--ah-line)' }}>
            <div className="min-w-0 flex-1">
              <SavedSearchManager
                filters={{
                  position, jobType, keyword: debouncedKeyword,
                  minSalary: jobType ? minSalary : '',
                  dateFrom: dateRange.dateFrom, dateTo: dateRange.dateTo,
                  shiftBandsActive: shifts.length > 0,
                }}
                onApply={(ss) => {
                  setPosition(ss.position || '')
                  setJobType(ss.jobType || '')
                  setKeyword(ss.keyword || '')
                  setMinSalary(ss.jobType && ss.minSalary != null ? String(ss.minSalary) : '')
                  // Eski kayıtlı aramalardaki Shift değerleri bandlara birebir uyar
                  setShifts(ss.shifts ? Array.from(ss.shifts).filter(x => SHIFT_BAND_LABELS[x]) : [])
                  if (ss.dateFrom && ss.dateTo) {
                    setDatePreset('CUSTOM'); setCustomFrom(ss.dateFrom); setCustomTo(ss.dateTo)
                  } else {
                    setDatePreset(''); setCustomFrom(''); setCustomTo('')
                  }
                  toast.success(`"${ss.name}" uygulandı`)
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <button type="button" onClick={clearFilters} className="btn-ghost flex-shrink-0 hidden lg:inline-flex">
                Temizle
              </button>
            )}
          </div>
        </div>
        </div>

        {/* Mobil alt sayfa: sabit sonuç düğmesi */}
        <div className="ah-filter-sheet__foot">
          <button type="button" onClick={clearFilters} className="btn-secondary !w-auto"
                  disabled={activeFilterCount === 0}>
            Temizle
          </button>
          <button type="button" onClick={closeSheet} className="btn-primary flex-1" data-testid="filters-apply">
            {isFetching && !loading ? 'Güncelleniyor' : `${total} ilanı göster`}
          </button>
        </div>
      </aside>

      <div className="min-w-0 space-y-3">
        <ActiveFilterBar
          filters={{ keyword: debouncedKeyword, position, jobType, minSalary, shifts, datePreset, customFrom, customTo }}
          onRemove={(key) => {
            if (key === 'keyword')   { setKeyword(''); setDebouncedKeyword('') }
            if (key === 'position')  setPosition('')
            if (key === 'jobType')   chooseJobType('')
            if (key === 'minSalary') setMinSalary('')
            if (key === 'datePreset'){ setDatePreset(''); setCustomFrom(''); setCustomTo('') }
            if (key.startsWith('shift:')) setShifts(prev => prev.filter(x => x !== key.slice(6)))
          }}
          onClearAll={clearFilters}
        />

        {loading ? (
          <SkeletonListingGrid count={6} />
        ) : showError ? (
          <LoadError message="İlanlar yüklenemedi." onRetry={() => refetch()} />
        ) : total === 0 ? (
          <div className="card">
            <EmptyState
              type={activeFilterCount > 0 ? 'search' : 'listings'}
              title={activeFilterCount > 0 ? 'Bu aramaya uyan ilan yok' : 'Henüz aktif ilan yok'}
              description={activeFilterCount > 0
                ? 'Filtreleri gevşetebilir ya da bu aramaya ilan çıkınca haber alabilirsin.'
                : 'Daha sonra tekrar kontrol et; yeni ilanlar her gün eklenir.'}
              ctaLabel={activeFilterCount > 0 ? 'Filtreleri temizle' : null}
              onCta={activeFilterCount > 0 ? clearFilters : undefined}
              ctaSecondaryLabel={activeFilterCount > 0 ? 'Bu aramaya ilan çıkınca haber ver' : null}
              onCtaSecondary={activeFilterCount > 0 ? saveCurrentSearchQuick : undefined}
            />
          </div>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
              variants={LIST_STAGGER}
              initial="hidden"
              animate="visible"
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
            <div className="flex flex-col items-center gap-2 pt-2">
              <p className="type-caption tabular-nums">{pageItems.length} / {total} ilan gösteriliyor</p>
              {remaining > 0 && (
                <button type="button" className="btn-secondary"
                        onClick={() => setVisibleCount(c => c + LISTINGS_PAGE_SIZE)}>
                  Daha fazla göster
                </button>
              )}
            </div>
          </>
        )}
      </div>
      </div>

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

/* Aktif filtre şeridi (her çipte X ile kaldır) */
const DATE_PRESET_LABELS = {
  TODAY: 'Bugün', TOMORROW: 'Yarın', WEEK: 'Bu hafta',
  WEEKEND: 'Hafta sonu', CUSTOM: 'Özel tarih',
}

function ActiveFilterBar({ filters, onRemove, onClearAll }) {
  const chips = []
  if (filters.keyword)   chips.push({ key: 'keyword',   text: `"${filters.keyword}"` })
  if (filters.position)  chips.push({ key: 'position',  text: labelOf(POSITION_LABELS, filters.position) })
  if (filters.jobType)   chips.push({ key: 'jobType',   text: labelOf(JOB_TYPE_LABELS, filters.jobType) })
  if (filters.minSalary && filters.jobType) {
    chips.push({
      key: 'minSalary',
      text: `${Number(filters.minSalary).toLocaleString('tr-TR')} ${salaryUnitFor(filters.jobType) || '₺'}+`,
    })
  }
  if (filters.datePreset) {
    const dt = filters.datePreset === 'CUSTOM' && (filters.customFrom || filters.customTo)
      ? `${filters.customFrom || '...'} → ${filters.customTo || '...'}`
      : DATE_PRESET_LABELS[filters.datePreset] || filters.datePreset
    chips.push({ key: 'datePreset', text: dt })
  }
  (filters.shifts || []).forEach(sh =>
    chips.push({ key: `shift:${sh}`, text: SHIFT_BAND_LABELS[sh] || sh })
  )

  if (chips.length === 0) return null

  return (
    <div className="flex items-center gap-2 -mx-1 px-1">
      <div className="flex items-center gap-2 overflow-x-auto flex-1 py-1 no-scrollbar">
        {chips.map(c => (
          <button key={c.key}
            type="button"
            onClick={() => onRemove(c.key)}
            aria-label={`Filtreyi kaldır: ${c.text}`}
            className="chip is-active flex-shrink-0">
            <span className="truncate max-w-[180px]">{c.text}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        ))}
      </div>
      <button onClick={onClearAll} type="button" className="btn-ghost flex-shrink-0">
        Hepsini temizle
      </button>
    </div>
  )
}

/* FAZ B.5 — Ust filtre bari alan sarmalayici (kucuk etiket + kontrol) */
function FilterField({ label, htmlFor, children }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="type-label" htmlFor={htmlFor} style={{ color: 'var(--ah-ink-3)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

/* FAZ B.5.2 — Chip filtre satiri: kucuk etiket + yatay chip grubu.
   Dar ekranda yatay kaydirilir (sarmak yerine), scrollbar gizli. */
function FilterRow({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0" role="group" aria-label={label}>
      <span className="type-label" style={{ color: 'var(--ah-ink-3)' }}>
        {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {children}
      </div>
    </div>
  )
}

/* FAZ B.5.2 — Tek tikla secilen filtre chip'i (dropdown yerine). */
function FilterChip({ active, onClick, children }) {
  /* print-keep yalnız AKTİF çipte: yazdırmada hangi filtrenin uygulandığı görünsün. */
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`chip cand-filter-chip flex-shrink-0${active ? ' is-active print-keep' : ''}`}>
      {children}
    </button>
  )
}

/* FAZ C.2.3 — Ilanlar sekmesi genel bakis seridi.
   Gorunen listeden turetilen 3-4 kucuk stat; discovery hook + acil vitrini. */
/* Kompakt ozet seridi: 3 koca kart yerine tek satir. Toplam ilan sayisi
   zaten baslikta oldugu icin burada tekrarlanmaz; yalnizca deger katan
   bilgiler (ort. ucret · acil · en yakin). Bilgi yoksa hic gorunmez. */
function OverviewStrip({ overview, hasLocation }) {
  const { urgentCount, nearestKm, avgDaily } = overview
  const bits = []
  if (avgDaily != null)
    bits.push({ strong: `${avgDaily.toLocaleString('tr-TR')} ₺`, soft: 'ort. günlük ücret' })
  if (urgentCount > 0)
    bits.push({ strong: `${urgentCount} acil`, soft: 'hemen aranıyor' })
  if (hasLocation && nearestKm != null)
    bits.push({ strong: formatDistance(nearestKm), soft: 'en yakın' })
  if (!bits.length) return null

  return (
    <div className="card flex items-center flex-wrap gap-x-2 gap-y-1"
         style={{ padding: '10px 14px' }}>
      {bits.map((b, i) => (
        <span key={i} className="inline-flex items-baseline gap-1.5 text-[12.5px]">
          {i > 0 && <span className="mr-1.5" style={{ color: 'var(--ah-line-2)' }}>·</span>}
          <span className="font-semibold tabular-nums" style={{ color: 'var(--ah-ink)' }}>{b.strong}</span>
          <span style={{ color: 'var(--ah-ink-3)' }}>{b.soft}</span>
        </span>
      ))}
    </div>
  )
}

/* FAZ C.2 — "Bugun musaitim" toggle.
   Acildiginda aday "hemen musait" havuzuna girer; bir isletme ilanini acil
   isaretlerse bildirim ilk bu havuza gider. Musaitlik gun sonunda kendiliginden
   duser — aday her gun yeniden isaretler. Bu kasitli bir surtunme: bayat
   bayraklarla dolu bir havuzun otele hicbir faydasi yok. */
function AvailableNowToggle() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['availability-now'],
    queryFn: () => hotelApi.getAvailabilityNow(),
    staleTime: 60_000,
  })
  const [busy, setBusy] = useState(false)
  const active = !!data?.availableNow

  async function toggle() {
    setBusy(true)
    try {
      const res = await hotelApi.setAvailabilityNow(!active)
      qc.setQueryData(['availability-now'], res)
      toast.success(res.availableNow
        ? 'Bugün müsaitsin — acil ilanlarda ilk sana haber gelecek'
        : 'Müsaitlik kapatıldı')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally { setBusy(false) }
  }

  const untilLabel = active && data?.availableUntil
    ? new Date(data.availableUntil).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <button type="button" onClick={toggle} disabled={busy || isLoading}
      aria-pressed={active}
      title={active
        ? `Bugün ${untilLabel}'a kadar müsait görünüyorsun. Kapatmak için tıkla.`
        : 'Bugün çalışabilecek durumdaysan işaretle — acil ilanlarda önceliklisin'}
      className={`chip cand-filter-chip disabled:opacity-60${active ? ' is-active' : ''}`}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      {busy ? 'Kaydediliyor'
        : active ? `Bugün müsaitsin · ${untilLabel}` : 'Bugün müsaitim'}
    </button>
  )
}

/* FAZ B.3 — "Yakinlar once" toggle. Konum yoksa istekle, varsa siralaya al. */
function NearbyToggle({ nearbyFirst, onToggle, loading, hasLocation, error }) {
  const active = nearbyFirst && hasLocation
  const title = error ? error
    : loading ? 'Konum alınıyor...'
    : active ? 'Yakınlar önce (kapatmak için tıkla)'
    : 'Yakın ilanları önce göster (konum izni gerekir)'
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={loading}
      title={title}
      aria-pressed={active}
      className={`chip cand-filter-chip disabled:opacity-60${active ? ' is-active' : ''}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" /><path d="M12 2v20M2 12h20" />
      </svg>
      {loading ? 'Konum alınıyor' : (active ? 'Yakınlar önce' : 'Yakınlar')}
    </button>
  )
}
