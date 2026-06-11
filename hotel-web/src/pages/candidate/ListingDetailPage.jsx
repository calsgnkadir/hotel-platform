/**
 * FAZ 1/#47 — Listing Detail kendi route
 *
 * Eskiden modal: ListingsPage içinde DetailModal pop-up.
 * Yeni: /listings/:id route — SEO friendly, paylaşılabilir, geri tuşuyla kapanır.
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as hotelApi from '../../api/hotel'
import { keys } from '../../lib/queryClient'
import { useAuth } from '../../context/AuthContext'
import StarRating from '../../components/StarRating'
import GalleryCarousel from '../../components/GalleryCarousel'
import MapView from '../../components/MapView'
import toast from 'react-hot-toast'
import { useState } from 'react'

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}
const JOB_TYPE_LABELS = { PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı' }
const BUSINESS_TYPE_LETTER = { HOTEL: 'H', RESTAURANT: 'R', CAFE: 'C', BAR: 'B', CLUB: 'K' }
const SHIFT_INFO = {
  MORNING: { label: 'Sabah', icon: '☀', time: '08:00–16:00' },
  EVENING: { label: 'Akşam', icon: '🌆', time: '16:00–24:00' },
  NIGHT:   { label: 'Gece',  icon: '🌙', time: '22:00–08:00' },
  FLEXIBLE:{ label: 'Esnek', icon: '⏰', time: 'Esnek saatler' },
}

function formatSalary(min, max) {
  if (!min && !max) return null
  const fmt = (n) => Number(n).toLocaleString('tr-TR')
  if (min && max) return `${fmt(min)} – ${fmt(max)} ₺`
  return `${fmt(min || max)} ₺`
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [applying] = useState(false)

  const { data: listing, isLoading, error } = useQuery({
    queryKey: keys.listings.detail(id),
    queryFn: () => hotelApi.getListing(id),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="spinner" />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="card max-w-md text-center p-8">
          <h2 className="text-xl font-bold mb-2">İlan bulunamadı</h2>
          <p className="text-sm opacity-80 mb-4">Bu ilan kaldırılmış veya yayında değil olabilir.</p>
          <button onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-lg text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
            Geri Dön
          </button>
        </div>
      </div>
    )
  }

  const shift = listing.shift ? SHIFT_INFO[listing.shift] : null
  const salary = formatSalary(listing.salaryMin, listing.salaryMax)
  const hasDates = listing.startDate || listing.endDate
  const slots = [...(listing.shiftSlots || [])].sort((a, b) => {
    const c = (a.date || '').localeCompare(b.date || '')
    return c !== 0 ? c : (a.startTime || '').localeCompare(b.startTime || '')
  })
  const todayStr = new Date().toISOString().slice(0, 10)
  const hasFuture = slots.some(s => (s.date || '') >= todayStr)
  const businessLetter = BUSINESS_TYPE_LETTER[listing.businessType] || listing.businessName?.charAt(0) || '?'

  function handleBack() {
    // Eğer geçmiş varsa geri, yoksa ilanlar sayfasına
    if (window.history.length > 1) navigate(-1)
    else navigate(user?.role === 'CANDIDATE' ? '/candidate' : '/')
  }

  function handleApply() {
    if (!user) {
      toast('Başvurmak için giriş yapmalısın')
      navigate('/login?return=' + encodeURIComponent(`/listings/${id}`))
      return
    }
    if (user.role !== 'CANDIDATE') {
      toast.error('Başvurabilmek için aday hesabı gerek')
      return
    }
    // Şimdilik ilanlar sayfasına yönlendir + apply modal otomatik açılsın
    // Sonraki iterasyon: ApplyModal'ı ayrı component yap + burada direkt aç
    navigate(`/candidate?tab=listings&apply=${id}`)
  }

  return (
    <div className="min-h-screen bg-cream-100 dark:bg-ink-900">
      {/* Top bar — geri butonu + breadcrumb */}
      <header className="px-4 lg:px-6 py-3 sticky top-0 z-20 bg-cream-100/85 backdrop-blur-lg border-b border-cream-300">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={handleBack}
            className="p-2 rounded-lg hover:bg-cream-200 transition-colors text-ink-700"
            title="Geri">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="text-xs text-ink-500 truncate">
            <Link to="/candidate" className="hover:text-brand-700">İlanlar</Link>
            <span className="mx-1.5">/</span>
            <span className="text-ink-700 font-medium">{listing.title}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-6 py-6 space-y-5">
        {/* HERO — büyük gradient kart */}
        <div className="card !p-0 overflow-hidden">
          <div className="relative h-48 w-full flex items-center justify-center overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, #4c1d95 0%, #7e22ce 50%, #a855f7 100%)',
               }}>
            <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20"
                 style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />
            <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full opacity-15"
                 style={{ background: 'radial-gradient(circle, #fff 0%, transparent 70%)' }} />

            <div className="text-white font-black opacity-90 relative z-10"
                 style={{ fontSize: '6rem', textShadow: '0 6px 24px rgba(0,0,0,0.4)', fontFamily: '"Fraunces", serif' }}>
              {businessLetter}
            </div>

            <span className="absolute top-4 right-4 text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-md"
                  style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
              {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
            </span>
          </div>

          <div className="p-5">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: '#faf5ff' }}>
              {listing.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <p className="text-base" style={{ color: '#d8b4fe' }}>{listing.businessName}</p>
              {listing.businessReviewCount > 0 && (
                <StarRating value={listing.businessAverageRating}
                  count={listing.businessReviewCount} size="sm" />
              )}
            </div>
          </div>
        </div>

        {/* İşletme galerisi */}
        {listing.businessId && (
          <div className="card !p-3 overflow-hidden">
            <GalleryCarousel businessId={listing.businessId} height="h-56" />
          </div>
        )}

        {/* Quick facts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'İlçe', value: listing.businessDistrict || '—' },
            { label: 'Pozisyon', value: POSITION_LABELS[listing.position] || listing.position },
            ...(shift ? [{ label: 'Vardiya', value: `${shift.icon} ${shift.label}`, sub: shift.time }] : []),
            ...(salary ? [{ label: 'Ücret', value: salary }] : []),
          ].map(s => (
            <div key={s.label} className="card !p-3 text-center">
              <div className="text-[10px] uppercase tracking-wider opacity-70">{s.label}</div>
              <div className="text-sm font-semibold mt-0.5" style={{ color: '#faf5ff' }}>{s.value}</div>
              {s.sub && <div className="text-[10px] opacity-60 mt-0.5">{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Konum */}
        {listing.businessDistrict && (
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">Konum</h3>
            <MapView
              position={listing.businessLatitude != null && listing.businessLongitude != null
                ? [Number(listing.businessLatitude), Number(listing.businessLongitude)]
                : null}
              district={listing.businessDistrict}
              neighborhood={listing.businessNeighborhood}
              title={listing.businessName}
              height="280px"
            />
            {listing.businessAddress && (
              <p className="text-sm mt-3 opacity-90">{listing.businessAddress}</p>
            )}
            {listing.businessLatitude == null && (
              <p className="text-xs mt-1 italic" style={{ color: '#fbbf24' }}>
                Yaklaşık konum — işletme henüz tam adresi haritada işaretlemedi.
              </p>
            )}
          </div>
        )}

        {/* Açıklama */}
        <div className="card p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">Açıklama</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#f3e8ff' }}>
            {listing.description || 'Açıklama eklenmemiş.'}
          </p>
        </div>

        {listing.requirements && (
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">Gereksinimler</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#f3e8ff' }}>
              {listing.requirements}
            </p>
          </div>
        )}

        {hasDates && (
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">Kontrat Dönemi</h3>
            <p className="text-sm" style={{ color: '#f3e8ff' }}>
              {listing.startDate && new Date(listing.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {listing.startDate && listing.endDate && ' — '}
              {listing.endDate && new Date(listing.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {/* Vardiyalar */}
        {slots.length > 0 && (
          <div className="card p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">
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
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ background: full ? 'rgba(0,0,0,0.25)' : 'rgba(168,85,247,0.20)', opacity: full ? 0.6 : 1 }}>
                    <div className="text-sm">
                      <span className="font-semibold" style={{ color: '#faf5ff' }}>{dateLabel}</span>
                      <span className="ml-2" style={{ color: '#d8b4fe' }}>{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</span>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: full ? '#dc2626' : '#a855f7', color: '#fff' }}>
                      {full ? 'DOLU' : `${(s.slotsNeeded - (s.slotsFilled || 0))} açık`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Footer — başvur butonu sticky */}
        <div className="sticky bottom-4 mt-8">
          <button
            onClick={handleApply}
            disabled={!hasFuture || applying}
            className="w-full py-4 text-base font-bold text-white rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 shadow-2xl"
            style={{ background: hasFuture
              ? 'linear-gradient(135deg, #d946ef, #a855f7)'
              : '#6b7280',
              boxShadow: '0 8px 32px rgba(168,85,247,0.45)' }}>
            {hasFuture ? 'Bu İlana Başvur →' : 'Süresi Doldu'}
          </button>
        </div>
      </main>
    </div>
  )
}
