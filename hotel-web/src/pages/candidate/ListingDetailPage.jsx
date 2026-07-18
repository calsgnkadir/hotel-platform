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
import { SkeletonDetail } from '../../components/Skeleton'
import toast from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { ApplyModal } from './ListingsPage'
import { formatSalary } from '../../lib/salary'  // FAZ 2/#25

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}
const JOB_TYPE_LABELS = { PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı' }
const BUSINESS_TYPE_LETTER = { HOTEL: 'H', RESTAURANT: 'R', CAFE: 'C', BAR: 'B', CLUB: 'K' }
const SHIFT_INFO = {
  MORNING: { label: 'Sabah', icon: '', time: '08:00–16:00' },
  EVENING: { label: 'Akşam', icon: '', time: '16:00–24:00' },
  NIGHT:   { label: 'Gece',  icon: '', time: '22:00–08:00' },
  FLEXIBLE:{ label: 'Esnek', icon: '', time: 'Esnek saatler' },
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [applying] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)  // ApplyModal state

  const { data: listing, isLoading, error } = useQuery({
    queryKey: keys.listings.detail(id),
    queryFn: () => hotelApi.getListing(id),
    enabled: !!id,
  })

  // Dalga 4 / Teknik 5 — Goruntulenme sayaci (mount'ta 1 kez tetiklenir)
  useEffect(() => {
    if (id) hotelApi.trackListingView(id)
  }, [id])

  // Dalga I2 — Incelediklerim localStorage'a kaydet (listing yuklenince)
  useEffect(() => {
    if (listing?.id) {
      import('../../lib/recentlyViewed').then(m => m.recordView(listing))
    }
  }, [listing?.id])

  // Dalga 4 / Ozellik 6 — Pozisyon bazli maas benchmark
  const { data: benchmark } = useQuery({
    queryKey: ['salary-benchmark', listing?.position],
    queryFn: () => hotelApi.getSalaryBenchmark(listing.position),
    enabled: !!listing?.position,
    staleTime: 5 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen text-white relative z-10">
        <SkeletonDetail />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white relative z-10">
        <div className="card max-w-md text-center p-8">
          <h2 className="text-xl font-bold mb-2">İlan bulunamadı</h2>
          <p className="text-sm opacity-80 mb-4">Bu ilan kaldırılmış veya yayında değil olabilir.</p>
          <button onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-2xl font-semibold transition-all hover:-translate-y-0.5"
            style={{
              background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
              color: '#1a1208',
              boxShadow: '0 10px 24px rgba(205, 183, 143, 0.25), inset 0 1px 0 rgba(255,255,255,0.22)',
            }}>
            Geri Dön
          </button>
        </div>
      </div>
    )
  }

  const shift = null  // legacy shift kategorisi gosterilmiyor — slot saatleri yeterli
  const salary = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)
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
    setApplyOpen(true)  // ApplyModal direkt aç
  }

  return (
    <div className="min-h-screen text-white relative z-10">
      {/* Top bar — geri butonu + breadcrumb */}
      <header className="px-4 lg:px-6 py-3 sticky top-0 z-20 backdrop-blur-lg"
              style={{
                background: 'rgba(19, 17, 15, 0.72)',
                borderBottom: '1px solid rgba(205, 183, 143, 0.08)',
              }}>
        <div className="flex items-center gap-3">
          <button onClick={handleBack}
            className="p-2 rounded-2xl transition-colors"
            style={{ color: '#c9bdaa' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(205, 183, 143, 0.06)'; e.currentTarget.style.color = '#ede4d3' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c9bdaa' }}
            title="Geri">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="text-xs truncate" style={{ color: '#928678' }}>
            <Link to="/candidate" className="transition-colors hover:text-[color:#cdb78f]" style={{ color: '#c9bdaa' }}>İlanlar</Link>
            <span className="mx-1.5" style={{ color: '#6b6358' }}>/</span>
            <span className="font-medium" style={{ color: '#ede4d3' }}>{listing.title}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        <div className="xl:grid xl:grid-cols-[1fr_340px] xl:gap-5 space-y-5 xl:space-y-0">
        <div className="space-y-5 min-w-0">
        {/* HERO — graphite + champagne wash, editorial monogram */}
        <div className="card !p-0 overflow-hidden">
          <div className="relative h-56 w-full flex items-center justify-center overflow-hidden"
               style={{
                 background: 'linear-gradient(135deg, #221f1b 0%, #2d2823 50%, #1b1815 100%)',
               }}>
            {/* Champagne blob — top right */}
            <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-50"
                 style={{ background: 'radial-gradient(circle, rgba(205, 183, 143, 0.40) 0%, transparent 65%)', filter: 'blur(40px)' }} />
            {/* Deep champagne blob — bottom left */}
            <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full opacity-30"
                 style={{ background: 'radial-gradient(circle, rgba(184, 144, 45, 0.50) 0%, transparent 65%)', filter: 'blur(36px)' }} />
            {/* Subtle paper-grain wash */}
            <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
                 style={{ background: 'repeating-linear-gradient(45deg, rgba(205,183,143,0.10) 0 1px, transparent 1px 8px)' }} />

            {/* Editorial monogram — Syne, large, ivory + champagne drop-shadow */}
            <div className="relative z-10"
                 style={{
                   fontSize: '7rem',
                   fontWeight: 700,
                   color: '#f5efe2',
                   letterSpacing: '-0.04em',
                   lineHeight: 1,
                   filter: 'drop-shadow(0 8px 32px rgba(205, 183, 143, 0.30))',
                 }}>
              {businessLetter}
            </div>

            <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-[0.22em] px-3 py-1.5 rounded-full backdrop-blur-md"
                  style={{
                    background: 'rgba(205, 183, 143, 0.12)',
                    color: '#cdb78f',
                    border: '1px solid rgba(205, 183, 143, 0.32)',
                  }}>
              {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
            </span>
          </div>

          <div className="p-6">
            <h1 className="text-2xl sm:text-[28px] font-semibold leading-tight"
                style={{ color: '#f5efe2', letterSpacing: '-0.025em' }}>
              {listing.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <p className="text-base" style={{ color: '#cdb78f' }}>{listing.businessName}</p>
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
              <div className="text-[10px] uppercase tracking-[0.22em] font-medium" style={{ color: '#928678' }}>{s.label}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: '#f5efe2', letterSpacing: '-0.005em' }}>{s.value}</div>
              {s.sub && <div className="text-[10px] mt-0.5" style={{ color: '#6b6358' }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Dalga 4 / Ozellik 6 — Maas benchmark chip (Glassdoor pattern) */}
        {benchmark && benchmark.count > 0 && benchmark.avgMin && (
          <div className="card !p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] font-medium mb-1" style={{ color: '#928678' }}>
                İstanbul {POSITION_LABELS[listing.position] || listing.position} ortalaması
              </div>
              <div className="text-base font-semibold tabular-nums"
                   style={{ color: '#cdb78f', letterSpacing: '-0.01em' }}>
                {Number(benchmark.avgMin).toLocaleString('tr-TR')}₺
                {benchmark.avgMax && Number(benchmark.avgMax) !== Number(benchmark.avgMin) &&
                  ` – ${Number(benchmark.avgMax).toLocaleString('tr-TR')}₺`}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#928678' }}>
                {benchmark.count} aktif ilan baz alındı
                {listing.salaryMin && benchmark.avgMin &&
                  ` · Bu ilan ${Number(listing.salaryMin) >= Number(benchmark.avgMin) ? 'ortalamanın üzerinde' : 'ortalamanın altında'}`}
              </div>
            </div>
          </div>
        )}

        {/* Açıklama */}
        <div className="card p-6">
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#cdb78f' }}>Açıklama</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#ede4d3' }}>
            {listing.description || 'Açıklama eklenmemiş.'}
          </p>
        </div>

        {listing.requirements && (
          <div className="card p-6">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#cdb78f' }}>Gereksinimler</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: '#ede4d3' }}>
              {listing.requirements}
            </p>
          </div>
        )}

        {hasDates && (
          <div className="card p-6">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#cdb78f' }}>Kontrat Dönemi</h3>
            <p className="text-sm" style={{ color: '#ede4d3' }}>
              {listing.startDate && new Date(listing.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {listing.startDate && listing.endDate && ' — '}
              {listing.endDate && new Date(listing.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {/* Vardiyalar */}
        {slots.length > 0 && (
          <div className="card p-6">
            <h3 className="text-[13px] font-semibold uppercase tracking-[0.22em] mb-3" style={{ color: '#cdb78f' }}>
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
                    className="flex items-center justify-between rounded-xl px-3 py-2.5"
                    style={{
                      background: full ? 'rgba(255, 255, 255, 0.55)' : 'rgba(205, 183, 143, 0.06)',
                      border: `1px solid ${full ? 'rgba(146, 134, 120, 0.10)' : 'rgba(205, 183, 143, 0.16)'}`,
                      opacity: full ? 0.55 : 1,
                    }}>
                    <div className="text-sm">
                      <span className="font-semibold" style={{ color: '#ede4d3' }}>{dateLabel}</span>
                      <span className="ml-2 tabular-nums" style={{ color: '#cdb78f' }}>{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full"
                          style={full
                            ? { background: 'rgba(180, 106, 85, 0.14)', color: '#d39481', border: '1px solid rgba(180, 106, 85, 0.32)' }
                            : { background: 'rgba(122, 159, 122, 0.14)', color: '#a8c8a8', border: '1px solid rgba(122, 159, 122, 0.32)' }}>
                      {full ? 'DOLU' : `${(s.slotsNeeded - (s.slotsFilled || 0))} açık`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        </div>  {/* SOL kolon kapanis */}

        {/* === SAG KOLON: Basvur Card + Konum + Isletme bilgileri === */}
        <aside className="space-y-4">
          {/* Başvur Card — sole bright-gold CTA on this page */}
          <div className="card p-6">
            <div className="text-[10px] uppercase tracking-[0.22em] font-medium mb-2"
                 style={{ color: '#928678' }}>
              ÜCRET
            </div>
            <div className="mb-4 tabular-nums"
                 style={{
                   color: '#f5efe2',
                   fontSize: '32px',
                   fontWeight: 600,
                   letterSpacing: '-0.03em',
                   lineHeight: 1,
                   filter: 'drop-shadow(0 0 16px rgba(205, 183, 143, 0.30))',
                 }}>
              {salary || '—'}
            </div>

            <div className="space-y-2 mb-5 pb-5"
                 style={{ borderBottom: '1px solid rgba(205, 183, 143, 0.10)' }}>
              <DetailRow label="Pozisyon" value={POSITION_LABELS[listing.position] || listing.position} />
              <DetailRow label="İlçe"     value={listing.businessDistrict || '—'} />
              {shift && <DetailRow label="Vardiya" value={shift.label} sub={shift.time} />}
              <DetailRow label="Tür" value={JOB_TYPE_LABELS[listing.jobType] || listing.jobType} />
            </div>

            <button
              onClick={handleApply}
              disabled={!hasFuture || applying}
              className="w-full py-3.5 text-[14px] font-semibold uppercase tracking-[0.14em] rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5"
              style={hasFuture
                ? {
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    color: '#1a1208',
                    boxShadow: '0 14px 36px rgba(205, 183, 143, 0.30), inset 0 1px 0 rgba(255,255,255,0.28)',
                  }
                : {
                    background: 'rgba(146, 134, 120, 0.12)',
                    color: '#928678',
                    border: '1px solid rgba(146, 134, 120, 0.22)',
                  }}>
              {hasFuture ? 'Bu İlana Başvur' : 'Süresi Doldu'}
            </button>

            {hasFuture && (
              <p className="text-[11px] text-center mt-3"
                 style={{ color: '#6b6358' }}>
                Başvurmak 30 saniye sürer
              </p>
            )}
          </div>

          {/* Konum + Harita */}
          {listing.businessDistrict && (
            <div className="card p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-70 mb-3">Konum</h3>
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
                <p className="text-[12px] mt-3 opacity-90">{listing.businessAddress}</p>
              )}
              {listing.businessLatitude == null && (
                <p className="text-[11px] mt-1 italic" style={{ color: '#c8923a' }}>
                  Yaklaşık konum — işletme tam adresi haritada işaretlememiş.
                </p>
              )}
            </div>
          )}

          {/* Bu isletme hakkinda (trust signals) */}
          <div className="card p-4">
            <div className="text-[10px] uppercase tracking-wider opacity-70 mb-3">Bu işletme hakkında</div>
            <div className="grid grid-cols-1 gap-3">
              {listing.businessCreatedAt && (
                <TrustSignal label="Üyelik" value={memberSince(listing.businessCreatedAt)} />
              )}
              {typeof listing.businessWorkerCount === 'number' && (
                <TrustSignal label="Tamamlanan iş" value={`${listing.businessWorkerCount}+`} sub="kabul + çalışma" />
              )}
              {typeof listing.viewCount === 'number' && (
                <TrustSignal label="Görüntülenme" value={listing.viewCount.toLocaleString('tr-TR')} sub="bu ilan" />
              )}
            </div>
          </div>
        </aside>
        </div>  {/* xl:grid kapanis */}

        {/* FAZ 16 — Benzer İlanlar (content-based) */}
        <SimilarListings listingId={id} onNavigate={(lid) => navigate(`/listings/${lid}`)} />
      </main>

      {/* ApplyModal - başvur butonuna basınca açılır */}
      {applyOpen && (
        <ApplyModal
          listing={listing}
          onClose={() => setApplyOpen(false)}
          onSuccess={() => setApplyOpen(false)}
          onMessagesOpen={() => navigate('/candidate?tab=messages')}
        />
      )}
    </div>
  )
}

/* Dalga 4 / Ozellik 4 — Guven sinyali kucuk kutu */
function TrustSignal({ label, value, sub }) {
  return (
    <div className="text-left">
      <div className="text-[10px] uppercase tracking-[0.22em] font-medium" style={{ color: '#928678' }}>{label}</div>
      <div className="text-base font-semibold mt-1 tabular-nums" style={{ color: '#cdb78f', letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: '#6b6358' }}>{sub}</div>}
    </div>
  )
}

/* "2 ay önce", "1 yıl önce" — uyelik suresi insan-okunabilir */
function memberSince(iso) {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days < 30)    return `${days} gün`
  if (days < 365)   return `${Math.floor(days / 30)} ay`
  return `${Math.floor(days / 365)} yıl`
}

/* ── FAZ 16 — Benzer İlanlar bölümü ── */
function SimilarListings({ listingId, onNavigate }) {
  const { data: similar = [], isLoading } = useQuery({
    queryKey: ['similar-listings', listingId],
    queryFn: () => hotelApi.getSimilarListings(listingId, 6),
    enabled: !!listingId,
    staleTime: 5 * 60_000,
  })

  if (isLoading || similar.length === 0) return null

  return (
    <section className="mt-8 px-4 lg:px-0">
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="type-heading" style={{ fontSize: '18px' }}>Benzer İlanlar</h2>
        <span className="type-caption">bu ilana yakın {similar.length} fırsat</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {similar.map(l => {
          const salary = formatSalary(l.salaryMin, l.salaryMax, l.salaryType, l.tipsIncluded)
          return (
            <button key={l.id} onClick={() => onNavigate(l.id)}
              className="tier-raised tier-raised-hover p-4 text-left transition-all group">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="type-body font-semibold truncate" style={{ color: 'var(--text-headline)' }}>
                    {l.title}
                  </div>
                  <div className="type-caption truncate mt-0.5">{l.businessName}</div>
                </div>
                {l.businessReviewCount > 0 && (
                  <StarRating value={l.businessAverageRating} count={l.businessReviewCount} size="xs" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap type-caption">
                <span>{l.businessDistrict || 'İstanbul'}</span>
                <span style={{ color: 'var(--text-faint)' }}>·</span>
                <span>{POSITION_LABELS[l.position] || l.position}</span>
                <span style={{ color: 'var(--text-faint)' }}>·</span>
                <span>{JOB_TYPE_LABELS[l.jobType] || l.jobType}</span>
              </div>
              {salary && (
                <div className="mt-2 inline-flex items-center type-overline px-2 py-0.5 rounded-full tabular-nums"
                     style={{ background: 'rgba(205, 183, 143, 0.08)', border: '1px solid rgba(205, 183, 143, 0.22)', color: 'var(--accent-action)' }}>
                  {salary}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* Sticky basvur kart icinde satir */
function DetailRow({ label, value, sub }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-[0.22em] flex-shrink-0 font-medium"
            style={{ color: '#928678' }}>{label}</span>
      <div className="text-right min-w-0">
        <div className="text-[13px] font-semibold truncate" style={{ color: '#ede4d3' }}>{value}</div>
        {sub && <div className="text-[10px]" style={{ color: '#6b6358' }}>{sub}</div>}
      </div>
    </div>
  )
}
