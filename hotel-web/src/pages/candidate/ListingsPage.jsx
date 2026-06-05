import { useState, useEffect } from 'react'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import ReportModal from '../../components/ReportModal'
import StarRating from '../../components/StarRating'
import GalleryCarousel from '../../components/GalleryCarousel'
import { ISTANBUL_DISTRICTS } from '../../data/istanbul'

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}
const JOB_TYPE_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}
const BUSINESS_TYPE_ICONS = { HOTEL: '', RESTAURANT: '', CAFE: '' }
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

function formatSalary(min, max) {
  if (min && max) return `${min.toLocaleString('tr-TR')} – ${max.toLocaleString('tr-TR')} ₺`
  if (min)        return `${min.toLocaleString('tr-TR')} ₺ den itibaren`
  if (max)        return `${max.toLocaleString('tr-TR')} ₺ ye kadar`
  return null
}

/* ── Apply Modal ── */
function ApplyModal({ listing, onClose, onSuccess }) {
  const [coverLetter, setCoverLetter] = useState('')
  const [loading, setLoading] = useState(false)

  // Faz E3: Adayın seçtiği slotlar (id listesi)
  const [selectedSlotIds, setSelectedSlotIds] = useState([])

  // Backend tarihe göre sıralı dönüyor; yine de güvenli ol
  const allSlots = [...(listing.shiftSlots || [])].sort((a, b) => {
    const c = (a.date || '').localeCompare(b.date || '')
    return c !== 0 ? c : (a.startTime || '').localeCompare(b.startTime || '')
  })
  const hasSlots = allSlots.length > 0

  // Hassas belge izinleri (sadece kullanıcının yüklediği türler arasından seçilebilir)
  const [myDocs, setMyDocs] = useState([])
  const [grantedTypes, setGrantedTypes] = useState([])

  useEffect(() => {
    hotelApi.getMyDocuments().then(setMyDocs).catch(() => setMyDocs([]))
  }, [])

  // Kullanıcının yüklediği hassas belge tipleri (eşsiz)
  const uploadedSensitiveTypes = [...new Set(
    myDocs.map(d => d.type).filter(t => SENSITIVE_DOC_TYPES.includes(t))
  )]

  function toggleSlot(id, full) {
    if (full) return  // dolu slot toggle edilemez
    setSelectedSlotIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleGrant(type) {
    setGrantedTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type])
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (hasSlots && selectedSlotIds.length === 0) {
      return toast.error('En az 1 vardiya seçmelisiniz')
    }

    setLoading(true)
    try {
      await hotelApi.applyToListing({
        jobListingId: listing.id,
        coverLetter,
        slotIds: selectedSlotIds,
        grantedSensitiveTypes: grantedTypes,
      })
      toast.success('Başvurunuz gönderildi!')
      onSuccess()
      onClose()
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
        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0"
                 style={{ background: '#047857' }}>
              {BUSINESS_TYPE_ICONS[listing.businessType] || ''}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{listing.title}</h2>
              <p className="text-sm text-slate-500">{listing.businessName} · {listing.businessDistrict}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Ön Yazı */}
          <div>
            <label className="label">Ön Yazı <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
            <textarea
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              className="input resize-none h-24 text-sm leading-relaxed"
              placeholder="Kendinizi kısaca tanıtın, neden bu pozisyonda çalışmak istediğinizi anlatın..."
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">{coverLetter.length} karakter</p>
          </div>

          {/* Faz E3: Slot seçimi (zorunlu — min 1) */}
          {hasSlots ? (
            <div>
              <label className="label">
                Vardiya Seçimi *
                <span className="text-slate-400 font-normal ml-1">(çalışabileceğin günleri işaretle)</span>
              </label>
              <div className="space-y-1.5">
                {allSlots.map(s => {
                  const full = s.full || (s.slotsFilled >= s.slotsNeeded)
                  const selected = selectedSlotIds.includes(s.id)
                  const dateLabel = new Date(s.date).toLocaleDateString('tr-TR', {
                    day: 'numeric', month: 'short', weekday: 'short',
                  })
                  const timeLabel = `${(s.startTime || '').slice(0, 5)}–${(s.endTime || '').slice(0, 5)}`
                  return (
                    <label key={s.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all
                        ${full
                          ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
                          : selected
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 dark:border-brand-500 cursor-pointer shadow-sm'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer hover:border-brand-400 dark:hover:border-brand-500'}`}>
                      <input type="checkbox" checked={selected} disabled={full}
                        onChange={() => toggleSlot(s.id, full)}
                        className="w-4 h-4 accent-brand-700" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800">
                          {dateLabel} · {timeLabel}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {full
                            ? '⚠ Bu vardiya doldu'
                            : `${s.slotsFilled || 0}/${s.slotsNeeded} dolu — ${(s.slotsNeeded - (s.slotsFilled || 0))} açık`}
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
              {selectedSlotIds.length > 0 && (
                <p className="text-xs text-brand-700 dark:text-brand-400 font-medium mt-2">
                  ✓ {selectedSlotIds.length} vardiya seçtin
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
              ⚠ Bu ilana henüz vardiya eklenmemiş — başvuru alınamaz.
            </div>
          )}

          {/* Belge izinleri — sadece kullanıcının yüklediği hassas belgeler için */}
          {uploadedSensitiveTypes.length > 0 && (
            <div>
              <label className="label">Belge İzinleri <span className="text-slate-400 font-normal">(işletme talep etmeden görsün)</span></label>
              <div className="space-y-2">
                {uploadedSensitiveTypes.map(type => {
                  const checked = grantedTypes.includes(type)
                  return (
                    <label key={type}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all
                        ${checked
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 dark:border-brand-500'
                          : 'border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleGrant(type)}
                        className="w-4 h-4 accent-brand-700" />
                      <span className="text-sm text-slate-700">{SENSITIVE_DOC_LABELS[type]}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                ⓘ CV, transkript ve öğrenci belgesi zaten herkese açık — izin gerekmez.
              </p>
            </div>
          )}

          {uploadedSensitiveTypes.length === 0 && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 border border-slate-200">
              Hassas belge yüklemediysen "Belgelerim" sekmesinden ekleyebilir, başvuru sırasında işletmeye direkt izin verebilirsin.
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-slate-900 py-3 -mx-6 px-6 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">İptal</button>
            <button type="submit" disabled={loading || !hasSlots}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
              style={{ background: '#047857', boxShadow: '0 3px 12px rgba(4,120,87,0.35)' }}>
              {loading ? 'Gönderiliyor...' : 'Başvur →'}
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
  const shift = listing.shift ? SHIFT_INFO[listing.shift] : null
  const salary = formatSalary(listing.salaryMin, listing.salaryMax)
  const hasDates = listing.startDate || listing.endDate
  const slots = [...(listing.shiftSlots || [])].sort((a, b) => {
    const c = (a.date || '').localeCompare(b.date || '')
    return c !== 0 ? c : (a.startTime || '').localeCompare(b.startTime || '')
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0 shadow-sm"
                 style={{ background: '#047857' }}>
              {BUSINESS_TYPE_ICONS[listing.businessType] || ''}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{listing.title}</h2>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-sm text-slate-500">{listing.businessName}</p>
                {listing.businessReviewCount > 0 && (
                  <StarRating value={listing.businessAverageRating}
                    count={listing.businessReviewCount} size="sm" />
                )}
              </div>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 flex-shrink-0">
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
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">İlçe</div>
              <div className="text-sm font-semibold text-slate-700 mt-0.5">
                {listing.businessDistrict || '—'}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">Pozisyon</div>
              <div className="text-sm font-semibold text-slate-700 mt-0.5">
                {POSITION_LABELS[listing.position] || listing.position}
              </div>
            </div>
            {shift && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">Vardiya</div>
                <div className="text-sm font-semibold text-slate-700 mt-0.5">
                  {shift.icon} {shift.label}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{shift.time}</div>
              </div>
            )}
            {salary && (
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-emerald-600 uppercase tracking-wider">Ücret</div>
                <div className="text-xs font-semibold text-emerald-700 mt-0.5 leading-tight">{salary}</div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Açıklama</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {listing.requirements && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Gereksinimler</h3>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {listing.requirements}
              </p>
            </div>
          )}

          {hasDates && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Kontrat Dönemi</h3>
              <p className="text-sm text-slate-700">
                {listing.startDate && new Date(listing.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {listing.startDate && listing.endDate && ' — '}
                {listing.endDate && new Date(listing.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}

          {/* Faz E3: Vardiya listesi */}
          {slots.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                        ${full ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-brand-50/60 dark:bg-brand-900/20 border-brand-100 dark:border-brand-900/40'}`}>
                      <div className="text-sm">
                        <span className="font-medium text-slate-800">{dateLabel}</span>
                        <span className="text-slate-500 ml-2">{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${full ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
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
        <div className="flex gap-3 p-6 border-t border-slate-100 sticky bottom-0 bg-white dark:bg-slate-900 items-center">
          <button onClick={() => setShowReport(true)}
            title="Bu ilanı bildir"
            className="text-sm px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors flex-shrink-0">
            ⚠ Bildir
          </button>
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Kapat</button>
          <button onClick={() => { onApply(listing); onClose() }}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all hover:-translate-y-0.5"
            style={{ background: '#047857', boxShadow: '0 3px 12px rgba(4,120,87,0.35)' }}>
            Başvur →
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
  const shift = listing.shift ? SHIFT_INFO[listing.shift] : null
  const salary = formatSalary(listing.salaryMin, listing.salaryMax)

  return (
    <div
      onClick={() => onDetail(listing)}
      className="card cursor-pointer hover:border-brand-400 dark:hover:border-brand-500 hover:-translate-y-1 transition-all duration-200 group"
    >
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0 shadow-sm"
               style={{ background: '#047857' }}>
            {BUSINESS_TYPE_ICONS[listing.businessType] || ''}
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300">
            {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
          </span>
        </div>

        <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-2 group-hover:text-brand-700 dark:text-brand-400 transition-colors">
          {listing.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          <p className="text-sm text-slate-500">{listing.businessName}</p>
          {listing.businessReviewCount > 0 && (
            <StarRating value={listing.businessAverageRating}
              count={listing.businessReviewCount} size="xs" />
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 flex-wrap">
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

        {salary && (
          <div className="text-xs text-emerald-600 font-medium mt-1.5">
            💰 {salary}
          </div>
        )}

        {/* Faz E3: slot özeti */}
        {listing.shiftSlots?.length > 0 && (() => {
          const slots = [...listing.shiftSlots].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          const next = slots.find(s => !(s.full || s.slotsFilled >= s.slotsNeeded)) || slots[0]
          const openCount = slots.filter(s => !(s.full || s.slotsFilled >= s.slotsNeeded)).length
          const nextStr = next
            ? `${new Date(next.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${next.startTime?.slice(0, 5)}`
            : null
          return (
            <div className="text-xs text-brand-700 dark:text-brand-400 font-medium mt-1">
              {slots.length} vardiya
              {openCount === 0 && ' · ⚠ tümü dolu'}
              {openCount > 0 && nextStr && ` · ${nextStr}`}
            </div>
          )
        })()}

        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{listing.description}</p>

        <div className="flex-1" />

        <div className="flex gap-2 mt-4">
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(listing) }}
            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-400 transition-all">
            Detay
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onApply(listing) }}
            className="flex-1 py-2 px-3 text-sm font-semibold text-white rounded-lg
                       transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            style={{ background: '#047857', boxShadow: '0 3px 12px rgba(4,120,87,0.3)' }}>
            Başvur
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Listings Page ── */
export default function ListingsPage({ onApplicationSubmitted }) {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [applyTarget, setApplyTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [showFilters, setShowFilters] = useState(false)  // mobile toggle

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

  // Preset → dateFrom/dateTo (YYYY-MM-DD)
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

  useEffect(() => {
    setLoading(true)
    hotelApi.getListings({
      position, jobType, shifts, district, minSalary,
      keyword: debouncedKeyword,
      dateFrom: dateRange.dateFrom,
      dateTo:   dateRange.dateTo,
    })
      .then(setListings)
      .catch(() => toast.error('İlanlar yüklenemedi'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, jobType, shifts, district, minSalary, debouncedKeyword,
      datePreset, customFrom, customTo])

  function toggleShift(shift) {
    setShifts(prev => prev.includes(shift) ? prev.filter(s => s !== shift) : [...prev, shift])
  }

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">İş İlanları</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? '...' : `${listings.length} ilan`}
            {activeFilterCount > 0 && ` · ${activeFilterCount} filtre aktif`}
          </p>
        </div>
        <button onClick={() => setShowFilters(s => !s)}
          className="sm:hidden btn-secondary text-sm flex items-center gap-1.5">
          🔧 Filtreler
          {activeFilterCount > 0 && (
            <span className="bg-brand-700 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></span>
        <input type="text" value={keyword} onChange={e => setKeyword(e.target.value)}
          placeholder="İlan başlığında ara..."
          className="input pl-10 text-sm" />
        {keyword && (
          <button onClick={() => setKeyword('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
            ✕
          </button>
        )}
      </div>

      <div className={`card p-4 space-y-4 ${showFilters ? '' : 'hidden sm:block'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">İlçe</label>
            <select value={district} onChange={e => setDistrict(e.target.value)} className="input text-sm">
              <option value="">Tümü</option>
              {ISTANBUL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Pozisyon</label>
            <select value={position} onChange={e => setPosition(e.target.value)} className="input text-sm">
              <option value="">Tümü</option>
              {Object.entries(POSITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Çalışma Türü</label>
            <select value={jobType} onChange={e => setJobType(e.target.value)} className="input text-sm">
              <option value="">Tümü</option>
              {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Min Ücret ₺</label>
            <input type="number" value={minSalary} onChange={e => setMinSalary(e.target.value)}
              placeholder="5000" min="0" className="input text-sm" />
          </div>
        </div>

        {/* Faz E4: Tarih filtresi */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Tarih</label>
          <div className="flex flex-wrap gap-2">
            {[
              { key: '',         label: 'Tümü' },
              { key: 'TODAY',    label: 'Bugün' },
              { key: 'TOMORROW', label: 'Yarın' },
              { key: 'WEEK',     label: 'Bu Hafta' },
              { key: 'WEEKEND',  label: 'Haftasonu' },
              { key: 'CUSTOM',   label: 'Özel...' },
            ].map(p => {
              const active = datePreset === p.key
              return (
                <button key={p.key || 'all'} type="button" onClick={() => setDatePreset(p.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                    ${active
                      ? 'text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                  style={active ? { background: '#047857' } : {}}>
                  {p.label}
                </button>
              )
            })}
          </div>
          {datePreset === 'CUSTOM' && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs text-slate-500">Başlangıç</label>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="input text-sm mt-1" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Bitiş</label>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                  min={customFrom || new Date().toISOString().split('T')[0]}
                  className="input text-sm mt-1" />
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Vardiya</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SHIFT_INFO).map(([key, s]) => {
              const active = shifts.includes(key)
              return (
                <button key={key} type="button" onClick={() => toggleShift(key)}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-all text-center
                    ${active
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-brand-400 dark:hover:border-brand-500'}`}>
                  <div>{s.icon} {s.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-normal">{s.time}</div>
                </button>
              )
            })}
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex justify-end pt-1">
            <button onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-brand-700 dark:text-brand-400 font-medium">
              ✕ Filtreleri temizle
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="spinner" /></div>
      ) : listings.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <span className="text-5xl mb-4">{activeFilterCount > 0 ? '🔎' : ''}</span>
            <p className="font-medium text-slate-700">
              {activeFilterCount > 0 ? 'Filtrelere uyan ilan yok' : 'Henüz aktif ilan yok'}
            </p>
            {activeFilterCount > 0 ? (
              <button onClick={clearFilters} className="mt-3 text-sm font-medium text-brand-700 dark:text-brand-400">
                Filtreleri temizle
              </button>
            ) : (
              <p className="text-sm text-slate-500 mt-1">Daha sonra tekrar kontrol edin</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              onApply={setApplyTarget}
              onDetail={setDetailTarget}
            />
          ))}
        </div>
      )}

      {detailTarget && (
        <DetailModal
          listing={detailTarget}
          onClose={() => setDetailTarget(null)}
          onApply={setApplyTarget}
        />
      )}

      {applyTarget && (
        <ApplyModal
          listing={applyTarget}
          onClose={() => setApplyTarget(null)}
          onSuccess={() => onApplicationSubmitted?.()}
        />
      )}
    </div>
  )
}
