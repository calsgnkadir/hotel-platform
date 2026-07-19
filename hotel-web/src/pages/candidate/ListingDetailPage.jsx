/**
 * FAZ 1/#47 — Listing Detail kendi route
 *
 * Eskiden modal: ListingsPage içinde DetailModal pop-up.
 * Yeni: /listings/:id route — SEO friendly, paylaşılabilir, geri tuşuyla kapanır.
 *
 * FAZ 26 — Acik + teal sisteme gecirildi (kullanici istegi). Eski koyu grafit
 * + altin tema (glow blob'lar, sampanya renkler) birakildi. Kok .ah-surface
 * ile sarildi (bu sayfa DashboardLayout disinda oldugu icin otomatik almiyordu).
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
      <div className="min-h-screen ah-surface relative z-10" style={{ background: 'var(--ah-page)' }}>
        <SkeletonDetail />
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen ah-surface relative z-10 flex items-center justify-center"
           style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
        <div className="card max-w-md text-center p-8">
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ah-ink)' }}>İlan bulunamadı</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ah-ink-3)' }}>Bu ilan kaldırılmış veya yayında değil olabilir.</p>
          <button onClick={() => navigate(-1)}
            className="px-5 py-2.5 rounded-xl font-semibold transition-opacity hover:opacity-90"
            style={{ background: '#0f766e', color: '#ffffff' }}>
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

  const SEC_HEAD = { fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em', color: 'var(--ah-ink)' }
  const LABEL = { fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, color: 'var(--ah-ink-4)' }

  return (
    <div className="min-h-screen ah-surface relative z-10" style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      {/* Top bar — geri butonu + breadcrumb */}
      <header className="px-4 lg:px-6 py-3 sticky top-0 z-20 border-b"
              style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="flex items-center gap-3">
          <button onClick={handleBack}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--ah-ink-3)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ah-page)'; e.currentTarget.style.color = 'var(--ah-ink)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ah-ink-3)' }}
            title="Geri">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="text-xs truncate" style={{ color: 'var(--ah-ink-3)' }}>
            <Link to="/candidate" className="transition-colors hover:underline" style={{ color: 'var(--ah-brand)' }}>İlanlar</Link>
            <span className="mx-1.5" style={{ color: 'var(--ah-ink-4)' }}>/</span>
            <span className="font-medium" style={{ color: 'var(--ah-ink)' }}>{listing.title}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        <div className="xl:grid xl:grid-cols-[1fr_340px] xl:gap-5 space-y-5 xl:space-y-0">
        <div className="space-y-5 min-w-0">
        {/* HERO — sade acik band + teal monogram */}
        <div className="card !p-0 overflow-hidden">
          <div className="relative h-48 w-full flex items-center justify-center"
               style={{ background: 'var(--ah-brand-soft)', borderBottom: '1px solid var(--ah-line)' }}>
            <div className="relative z-10"
                 style={{ fontSize: '6rem', fontWeight: 700, color: 'var(--ah-brand)', letterSpacing: '-0.04em', lineHeight: 1 }}>
              {businessLetter}
            </div>
            <span className="absolute top-4 right-4 text-[10px] font-semibold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full"
                  style={{ background: 'var(--ah-card)', color: 'var(--ah-brand)', border: '1px solid var(--ah-line)' }}>
              {JOB_TYPE_LABELS[listing.jobType] || listing.jobType}
            </span>
          </div>

          <div className="p-6">
            <h1 className="text-2xl sm:text-[28px] font-semibold leading-tight"
                style={{ color: 'var(--ah-ink)', letterSpacing: '-0.025em' }}>
              {listing.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <p className="text-base" style={{ color: 'var(--ah-ink-3)' }}>{listing.businessName}</p>
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
              <div style={LABEL}>{s.label}</div>
              <div className="text-sm font-semibold mt-1" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.005em' }}>{s.value}</div>
              {s.sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--ah-ink-4)' }}>{s.sub}</div>}
            </div>
          ))}
        </div>

        {/* Dalga 4 / Ozellik 6 — Maas benchmark chip (Glassdoor pattern) */}
        {benchmark && benchmark.count > 0 && benchmark.avgMin && (
          <div className="card !p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="mb-1" style={LABEL}>
                İstanbul {POSITION_LABELS[listing.position] || listing.position} ortalaması
              </div>
              <div className="text-base font-semibold tabular-nums"
                   style={{ color: 'var(--ah-brand)', letterSpacing: '-0.01em' }}>
                {Number(benchmark.avgMin).toLocaleString('tr-TR')}₺
                {benchmark.avgMax && Number(benchmark.avgMax) !== Number(benchmark.avgMin) &&
                  ` – ${Number(benchmark.avgMax).toLocaleString('tr-TR')}₺`}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
                {benchmark.count} aktif ilan baz alındı
                {listing.salaryMin && benchmark.avgMin &&
                  ` · Bu ilan ${Number(listing.salaryMin) >= Number(benchmark.avgMin) ? 'ortalamanın üzerinde' : 'ortalamanın altında'}`}
              </div>
            </div>
          </div>
        )}

        {/* Açıklama */}
        <div className="card p-6">
          <h3 className="mb-3" style={SEC_HEAD}>Açıklama</h3>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--ah-ink-2)' }}>
            {listing.description || 'Açıklama eklenmemiş.'}
          </p>
        </div>

        {listing.requirements && (
          <div className="card p-6">
            <h3 className="mb-3" style={SEC_HEAD}>Gereksinimler</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--ah-ink-2)' }}>
              {listing.requirements}
            </p>
          </div>
        )}

        {hasDates && (
          <div className="card p-6">
            <h3 className="mb-3" style={SEC_HEAD}>Kontrat Dönemi</h3>
            <p className="text-sm" style={{ color: 'var(--ah-ink-2)' }}>
              {listing.startDate && new Date(listing.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {listing.startDate && listing.endDate && ' — '}
              {listing.endDate && new Date(listing.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}

        {/* Vardiyalar */}
        {slots.length > 0 && (
          <div className="card p-6">
            <h3 className="mb-3" style={SEC_HEAD}>
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
                      background: full ? 'var(--ah-page)' : 'var(--ah-brand-soft)',
                      border: '1px solid var(--ah-line)',
                      opacity: full ? 0.7 : 1,
                    }}>
                    <div className="text-sm">
                      <span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>{dateLabel}</span>
                      <span className="ml-2 tabular-nums" style={{ color: 'var(--ah-brand)' }}>{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</span>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] px-2 py-0.5 rounded-full"
                          style={full
                            ? { background: 'rgba(192, 57, 43, 0.10)', color: 'var(--ah-danger)', border: '1px solid rgba(192, 57, 43, 0.28)' }
                            : { background: 'rgba(10, 124, 66, 0.10)', color: 'var(--ah-ok)', border: '1px solid rgba(10, 124, 66, 0.28)' }}>
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
          {/* Başvur Card */}
          <div className="card p-6">
            <div className="mb-2" style={LABEL}>ÜCRET</div>
            <div className="mb-4 tabular-nums"
                 style={{ color: 'var(--ah-ink)', fontSize: '30px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              {salary || '—'}
            </div>

            <div className="space-y-2 mb-5 pb-5" style={{ borderBottom: '1px solid var(--ah-line)' }}>
              <DetailRow label="Pozisyon" value={POSITION_LABELS[listing.position] || listing.position} />
              <DetailRow label="İlçe"     value={listing.businessDistrict || '—'} />
              {shift && <DetailRow label="Vardiya" value={shift.label} sub={shift.time} />}
              <DetailRow label="Tür" value={JOB_TYPE_LABELS[listing.jobType] || listing.jobType} />
            </div>

            <button
              onClick={handleApply}
              disabled={!hasFuture || applying}
              className="w-full py-3.5 text-[14px] font-semibold rounded-xl transition-all disabled:cursor-not-allowed hover:opacity-90"
              style={hasFuture
                ? { background: '#0f766e', color: '#ffffff' }
                : { background: 'var(--ah-page)', color: 'var(--ah-ink-4)', border: '1px solid var(--ah-line)' }}>
              {hasFuture ? 'Bu İlana Başvur' : 'Süresi Doldu'}
            </button>

            {hasFuture && (
              <p className="text-[11px] text-center mt-3" style={{ color: 'var(--ah-ink-4)' }}>
                Başvurmak 30 saniye sürer
              </p>
            )}
          </div>

          {/* Konum + Harita */}
          {listing.businessDistrict && (
            <div className="card p-4">
              <h3 className="mb-3" style={SEC_HEAD}>Konum</h3>
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
                <p className="text-[12px] mt-3" style={{ color: 'var(--ah-ink-3)' }}>{listing.businessAddress}</p>
              )}
              {listing.businessLatitude == null && (
                <p className="text-[11px] mt-1 italic" style={{ color: 'var(--ah-warn)' }}>
                  Yaklaşık konum — işletme tam adresi haritada işaretlememiş.
                </p>
              )}
            </div>
          )}

          {/* Bu isletme hakkinda (trust signals) */}
          <div className="card p-4">
            <div className="mb-3" style={LABEL}>Bu işletme hakkında</div>
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
      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, color: 'var(--ah-ink-4)' }}>{label}</div>
      <div className="text-base font-semibold mt-1 tabular-nums" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: 'var(--ah-ink-4)' }}>{sub}</div>}
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
    <section className="mt-8">
      <div className="flex items-baseline gap-2 mb-4">
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--ah-ink)' }}>Benzer İlanlar</h2>
        <span className="text-[12px]" style={{ color: 'var(--ah-ink-3)' }}>bu ilana yakın {similar.length} fırsat</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {similar.map(l => {
          const salary = formatSalary(l.salaryMin, l.salaryMax, l.salaryType, l.tipsIncluded)
          return (
            <button key={l.id} onClick={() => onNavigate(l.id)}
              className="card p-4 text-left transition-colors"
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f9f9' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--ah-card)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>
                    {l.title}
                  </div>
                  <div className="text-[12px] truncate mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>{l.businessName}</div>
                </div>
                {l.businessReviewCount > 0 && (
                  <StarRating value={l.businessAverageRating} count={l.businessReviewCount} size="xs" />
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[12px]" style={{ color: 'var(--ah-ink-3)' }}>
                <span>{l.businessDistrict || 'İstanbul'}</span>
                <span style={{ color: 'var(--ah-ink-4)' }}>·</span>
                <span>{POSITION_LABELS[l.position] || l.position}</span>
                <span style={{ color: 'var(--ah-ink-4)' }}>·</span>
                <span>{JOB_TYPE_LABELS[l.jobType] || l.jobType}</span>
              </div>
              {salary && (
                <div className="mt-2 inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums"
                     style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)', color: 'var(--ah-brand)' }}>
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
      <span className="flex-shrink-0" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.16em', fontWeight: 600, color: 'var(--ah-ink-4)' }}>{label}</span>
      <div className="text-right min-w-0">
        <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>{value}</div>
        {sub && <div className="text-[10px]" style={{ color: 'var(--ah-ink-4)' }}>{sub}</div>}
      </div>
    </div>
  )
}
