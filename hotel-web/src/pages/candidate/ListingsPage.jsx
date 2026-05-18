import { useState, useEffect } from 'react'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}
const JOB_TYPE_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}
const BUSINESS_TYPE_ICONS = { HOTEL: '🏨', RESTAURANT: '🍽️', CAFE: '☕' }
const SHIFT_INFO = {
  MORNING: { icon: '🌅', label: 'Sabah', time: '08:00–16:00' },
  EVENING: { icon: '🌆', label: 'Akşam', time: '16:00–24:00' },
  NIGHT:   { icon: '🌙', label: 'Gece',  time: '22:00–08:00' },
}
const ISTANBUL_DISTRICTS = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu',
]

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

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await hotelApi.applyToListing({ jobListingId: listing.id, coverLetter, availabilities: [] })
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
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              {BUSINESS_TYPE_ICONS[listing.businessType] || '🏨'}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{listing.title}</h2>
              <p className="text-sm text-slate-500">{listing.businessName} · {listing.businessDistrict}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Ön Yazı <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
            <textarea
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              className="input resize-none h-32 text-sm leading-relaxed"
              placeholder="Kendinizi kısaca tanıtın, neden bu pozisyonda çalışmak istediğinizi anlatın..."
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">{coverLetter.length} karakter</p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">İptal</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.35)' }}>
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
  const shift = listing.shift ? SHIFT_INFO[listing.shift] : null
  const salary = formatSalary(listing.salaryMin, listing.salaryMax)
  const hasCustomHours = listing.shiftStart || listing.shiftEnd
  const hasDates = listing.startDate || listing.endDate

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0 shadow-sm"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              {BUSINESS_TYPE_ICONS[listing.businessType] || '🏨'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{listing.title}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{listing.businessName}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-700 flex-shrink-0">
              {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Quick facts grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">İlçe</div>
              <div className="text-sm font-semibold text-slate-700 mt-0.5">
                📍 {listing.businessDistrict || '—'}
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
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Çalışma Dönemi</h3>
              <p className="text-sm text-slate-700">
                {listing.startDate && new Date(listing.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {listing.startDate && listing.endDate && ' — '}
                {listing.endDate && new Date(listing.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          )}

          {hasCustomHours && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Özel Saat Aralığı</h3>
              <p className="text-sm text-slate-700">
                🕐 {listing.shiftStart || '?'} — {listing.shiftEnd || '?'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Kapat</button>
          <button onClick={() => { onApply(listing); onClose() }}
            className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.35)' }}>
            Başvur →
          </button>
        </div>
      </div>
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
      className="card cursor-pointer hover:border-violet-200 hover:-translate-y-1 transition-all duration-200 group"
    >
      <div className="p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0 shadow-sm"
               style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
            {BUSINESS_TYPE_ICONS[listing.businessType] || '🏨'}
          </div>
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-violet-50 text-violet-700">
            {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
          </span>
        </div>

        <h3 className="font-bold text-slate-800 text-base leading-snug line-clamp-2 group-hover:text-violet-700 transition-colors">
          {listing.title}
        </h3>
        <p className="text-sm text-slate-500 mt-0.5">{listing.businessName}</p>

        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400 flex-wrap">
          <span>📍 {listing.businessDistrict || 'İstanbul'}</span>
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

        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{listing.description}</p>

        <div className="flex-1" />

        <div className="flex gap-2 mt-4">
          <button
            onClick={(e) => { e.stopPropagation(); onDetail(listing) }}
            className="flex-1 py-2 px-3 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-all">
            Detay
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onApply(listing) }}
            className="flex-1 py-2 px-3 text-sm font-semibold text-white rounded-lg
                       transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.3)' }}>
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

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 400)
    return () => clearTimeout(t)
  }, [keyword])

  useEffect(() => {
    setLoading(true)
    hotelApi.getListings({
      position, jobType, shifts, district, minSalary,
      keyword: debouncedKeyword,
    })
      .then(setListings)
      .catch(() => toast.error('İlanlar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [position, jobType, shifts, district, minSalary, debouncedKeyword])

  function toggleShift(shift) {
    setShifts(prev => prev.includes(shift) ? prev.filter(s => s !== shift) : [...prev, shift])
  }

  function clearFilters() {
    setKeyword(''); setPosition(''); setJobType('')
    setDistrict(''); setMinSalary(''); setShifts([])
  }

  const activeFilterCount =
    (keyword ? 1 : 0) + (position ? 1 : 0) + (jobType ? 1 : 0) +
    (district ? 1 : 0) + (minSalary ? 1 : 0) + shifts.length

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
            <span className="bg-violet-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
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

        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">Vardiya</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(SHIFT_INFO).map(([key, s]) => {
              const active = shifts.includes(key)
              return (
                <button key={key} type="button" onClick={() => toggleShift(key)}
                  className={`p-2.5 rounded-lg border text-xs font-medium transition-all text-center
                    ${active
                      ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
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
              className="text-xs text-slate-500 hover:text-violet-600 font-medium">
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
            <span className="text-5xl mb-4">{activeFilterCount > 0 ? '🔎' : '📌'}</span>
            <p className="font-medium text-slate-700">
              {activeFilterCount > 0 ? 'Filtrelere uyan ilan yok' : 'Henüz aktif ilan yok'}
            </p>
            {activeFilterCount > 0 ? (
              <button onClick={clearFilters} className="mt-3 text-sm font-medium" style={{ color: '#7c3aed' }}>
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
