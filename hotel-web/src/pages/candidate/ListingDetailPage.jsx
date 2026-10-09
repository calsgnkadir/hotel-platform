/**
 * FAZ 1/#47 — Listing Detail kendi route
 *
 * Eskiden modal: ListingsPage içinde DetailModal pop-up.
 * Yeni: /listings/:id route — SEO friendly, paylaşılabilir, geri tuşuyla kapanır.
 *
 * UI Paket 3 — mobil öncelikli:
 *  - Dev harfli kapak kaldırıldı; yerine başlık bloğu (logo/baş harf + pozisyon +
 *    işletme · ilçe + ücret). İlçe/pozisyon/ücret yalnız başlıkta.
 *  - Galeri kartı yalnız fotoğraf varsa render edilir.
 *  - Bölüm sırası: Vardiyalar → Ödeme ve kıyafet → Açıklama → Konum → İşletme hakkında.
 *  - lg altında sabit alt bar: [ücret /gün] [Başvur] — sayfa açılır açılmaz görünür.
 *  - lg+ yan panel: vardiya özeti + başvuru eylemi + işletme kısa bilgisi.
 */
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as hotelApi from '../../api/hotel'
import { keys } from '../../lib/queryClient'
import { useAuth } from '../../context/AuthContext'
import GalleryCarousel from '../../components/GalleryCarousel'
import MapView from '../../components/MapView'
import { SkeletonDetail } from '../../components/Skeleton'
import toast from 'react-hot-toast'
import { useEffect, useState } from 'react'
import { ApplyModal } from './ListingsPage'
import { formatSalary, formatPayment, salaryTypeShort } from '../../lib/salary'  // FAZ 2/#25
import { logoColor } from '../../lib/logoColor'
import cldImg, { ImgSize } from '../../lib/cldImg'

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}
const JOB_TYPE_LABELS = { PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı' }

/** Ücreti tutar + birim olarak ayırır: { amount: '800 – 1.200 ₺', unit: 'gün' }. */
function salaryParts(l) {
  if (l.salaryType === 'NEGOTIABLE') return { amount: 'Görüşülecek', unit: '' }
  if (!l.salaryMin && !l.salaryMax) return null
  // min == max ise "1.500 – 1.500 ₺" yerine tek tutar
  const max = Number(l.salaryMax) === Number(l.salaryMin) ? null : l.salaryMax
  return { amount: formatSalary(l.salaryMin, max, null, false), unit: salaryTypeShort(l.salaryType) }
}

function fmtDay(date) {
  return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })
}

export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
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

  // Galeri burada çekilir: fotoğraf yoksa kart hiç render edilmez (boş kutu kalmasın)
  const { data: gallery = [] } = useQuery({
    queryKey: ['business-gallery', listing?.businessId],
    queryFn: () => hotelApi.getBusinessGallery(listing.businessId),
    enabled: !!listing?.businessId,
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
      <div className="min-h-screen ah-surface relative z-10 flex items-center justify-center p-4"
           style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
        <div className="card max-w-md text-center p-8">
          <h1 className="type-section mb-2" style={{ color: 'var(--ah-ink)' }}>İlan bulunamadı</h1>
          <p className="type-body mb-4" style={{ color: 'var(--ah-ink-3)' }}>Bu ilan kaldırılmış veya yayında değil olabilir.</p>
          <button type="button" onClick={() => navigate(-1)} className="btn-primary !w-auto">
            Geri dön
          </button>
        </div>
      </div>
    )
  }

  const positionLabel = POSITION_LABELS[listing.position] || listing.position || 'Personel'
  const sal = salaryParts(listing)
  const payment = formatPayment(listing.paymentPeriod, listing.paymentMethod)
  const hasDates = listing.startDate || listing.endDate
  const photos = Array.isArray(gallery) ? gallery : []
  const slots = [...(listing.shiftSlots || [])].sort((a, b) => {
    const c = (a.date || '').localeCompare(b.date || '')
    return c !== 0 ? c : (a.startTime || '').localeCompare(b.startTime || '')
  })
  const isFull = (s) => s.full || (s.slotsFilled >= s.slotsNeeded)
  const todayStr = new Date().toISOString().slice(0, 10)
  const futureSlots = slots.filter(s => (s.date || '') >= todayStr)
  const hasFuture = futureSlots.length > 0
  const openSlots = futureSlots.filter(s => !isFull(s))
  const openPeople = openSlots.reduce((n, s) => n + Math.max(0, (s.slotsNeeded || 0) - (s.slotsFilled || 0)), 0)
  const canApply = hasFuture && openSlots.length > 0
  // Mevcut duruma uygun pasif metin (başvurulmuş durumu ilan verisinde yok; backend reddeder)
  const applyLabel = !hasFuture ? 'Süresi doldu' : openSlots.length === 0 ? 'Kontenjan doldu' : 'Başvur'
  const initial = (listing.businessName || '').trim().charAt(0).toLocaleUpperCase('tr-TR')
  const metaParts = [listing.businessName, listing.businessDistrict, JOB_TYPE_LABELS[listing.jobType]].filter(Boolean)

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

  const businessFacts = (
    <BusinessFacts listing={listing} />
  )

  return (
    <div className="min-h-screen ah-surface relative z-10 has-mobile-apply-bar"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      {/* Top bar — geri butonu + breadcrumb */}
      <header className="px-4 lg:px-6 py-2 sticky top-0 z-20 border-b"
              style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={handleBack} aria-label="Geri"
            className="btn-ghost !w-auto !px-2 flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <nav className="type-meta truncate min-w-0" aria-label="Konum">
            <Link to="/candidate" className="hover:underline" style={{ color: 'var(--ah-brand)' }}>İlanlar</Link>
            <span className="mx-1.5" style={{ color: 'var(--ah-ink-4)' }}>/</span>
            <span style={{ color: 'var(--ah-ink)' }}>{listing.title}</span>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 space-y-4 lg:space-y-0">
        <div className="space-y-4 min-w-0">

        {/* BAŞLIK BLOĞU — logo/baş harf + pozisyon + işletme · ilçe + ücret */}
        <section className="card p-5 sm:p-6" aria-labelledby="listing-title">
          <div className="flex items-start gap-4">
            {listing.businessLogoUrl ? (
              <img src={cldImg(listing.businessLogoUrl, { w: ImgSize.avatarMd })} alt=""
                   className="ah-logo" style={{ objectFit: 'cover' }} />
            ) : initial ? (
              <span className="ah-logo" aria-hidden="true" style={{ background: logoColor(listing.businessName) }}>{initial}</span>
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 id="listing-title" className="type-page" style={{ color: 'var(--ah-ink)' }}>{positionLabel}</h1>
              {listing.title && listing.title !== positionLabel && (
                <p className="type-body mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>{listing.title}</p>
              )}
              <p className="type-meta mt-1" style={{ color: 'var(--ah-ink-3)' }}>{metaParts.join(' · ')}</p>
            </div>
          </div>
          {sal && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--ah-line)' }}>
              <p className="type-section type-num" style={{ color: 'var(--ah-ok)' }} data-testid="listing-salary">
                {sal.amount}
                {sal.unit && <span className="type-meta ml-1" style={{ color: 'var(--ah-ink-3)' }}>/{sal.unit}</span>}
                {listing.tipsIncluded && <span className="type-meta ml-1" style={{ color: 'var(--ah-ink-3)' }}>+ bahşiş</span>}
              </p>
              {benchmark && benchmark.count > 0 && benchmark.avgMin && (
                <p className="type-caption mt-1" style={{ color: 'var(--ah-ink-3)' }}>
                  İstanbul {positionLabel} ortalaması{' '}
                  <span className="type-num">
                    {Number(benchmark.avgMin).toLocaleString('tr-TR')} ₺
                    {benchmark.avgMax && Number(benchmark.avgMax) !== Number(benchmark.avgMin) &&
                      ` – ${Number(benchmark.avgMax).toLocaleString('tr-TR')} ₺`}
                  </span>
                  {' '}({benchmark.count} aktif ilan)
                </p>
              )}
            </div>
          )}
        </section>

        {/* İşletme galerisi — yalnız fotoğraf varsa */}
        {photos.length > 0 && (
          <div className="card !p-3 overflow-hidden" data-testid="listing-gallery">
            <GalleryCarousel photos={photos} height="h-56" />
          </div>
        )}

        {/* 1) Vardiyalar */}
        {slots.length > 0 && (
          <section className="card p-5 sm:p-6">
            <h2 className="type-card mb-3" style={{ color: 'var(--ah-ink)' }}>
              Vardiyalar <span className="type-meta" style={{ color: 'var(--ah-ink-3)' }}>({slots.length})</span>
            </h2>
            <ul className="space-y-2">
              {slots.map(s => {
                const full = isFull(s)
                return (
                  <li key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                    style={{ background: full ? 'var(--ah-band)' : 'var(--ah-card)', border: '1px solid var(--ah-line)' }}>
                    <span className="type-body min-w-0">
                      <span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>{fmtDay(s.date)}</span>
                      <span className="ml-2 type-num" style={{ color: 'var(--ah-ink-2)' }}>{s.startTime?.slice(0, 5)}–{s.endTime?.slice(0, 5)}</span>
                    </span>
                    <span className="type-badge px-2 py-0.5 rounded-full flex-shrink-0"
                          style={full
                            ? { background: 'var(--ah-danger-soft)', color: 'var(--ah-danger)' }
                            : { background: 'var(--ah-ok-soft)', color: 'var(--ah-ok)' }}>
                      {full ? 'Dolu' : `${(s.slotsNeeded - (s.slotsFilled || 0))} açık`}
                    </span>
                  </li>
                )
              })}
            </ul>
            {hasDates && (
              <p className="type-meta mt-3" style={{ color: 'var(--ah-ink-3)' }}>
                Dönem:{' '}
                {listing.startDate && new Date(listing.startDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {listing.startDate && listing.endDate && ' — '}
                {listing.endDate && new Date(listing.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </section>
        )}

        {/* 2) Ödeme ve kıyafet — başvurmadan önce net görünsün */}
        {(payment || listing.paymentNote || listing.dressCode || listing.meetingPoint) && (
          <section className="card p-5 sm:p-6 space-y-4">
            <h2 className="type-card" style={{ color: 'var(--ah-ink)' }}>Ödeme ve kıyafet</h2>
            {(payment || listing.paymentNote) && (
              <div>
                <h3 className="type-label mb-1" style={{ color: 'var(--ah-ink-3)' }}>Ödeme</h3>
                {payment && <p className="type-subhead" style={{ color: 'var(--ah-ink)' }}>{payment}</p>}
                {listing.paymentNote && (
                  <p className="type-body mt-0.5" style={{ color: 'var(--ah-ink-2)' }}>{listing.paymentNote}</p>
                )}
              </div>
            )}
            {listing.dressCode && (
              <div>
                <h3 className="type-label mb-1" style={{ color: 'var(--ah-ink-3)' }}>Kıyafet ve getirilecekler</h3>
                <p className="type-body whitespace-pre-line" style={{ color: 'var(--ah-ink-2)' }}>{listing.dressCode}</p>
              </div>
            )}
            {listing.meetingPoint && (
              <div>
                <h3 className="type-label mb-1" style={{ color: 'var(--ah-ink-3)' }}>Toplanma yeri</h3>
                <p className="type-body whitespace-pre-line" style={{ color: 'var(--ah-ink-2)' }}>
                  {listing.meetingPoint}
                  {listing.meetingMinutesBefore ? ` — vardiyadan ${listing.meetingMinutesBefore} dk önce` : ''}
                </p>
                <p className="type-caption mt-1" style={{ color: 'var(--ah-ink-3)' }}>
                  Vardınca oradaki QR kodu telefonunla okut, girişin kaydedilir.
                </p>
              </div>
            )}
          </section>
        )}

        {/* 3) Açıklama (+ gereksinimler) */}
        <section className="card p-5 sm:p-6">
          <h2 className="type-card mb-2" style={{ color: 'var(--ah-ink)' }}>Açıklama</h2>
          <p className="type-body whitespace-pre-line" style={{ color: 'var(--ah-ink-2)' }}>
            {listing.description || 'Açıklama eklenmemiş.'}
          </p>
          {listing.requirements && (
            <>
              <h3 className="type-subhead mt-4 mb-1" style={{ color: 'var(--ah-ink)' }}>Gereksinimler</h3>
              <p className="type-body whitespace-pre-line" style={{ color: 'var(--ah-ink-2)' }}>{listing.requirements}</p>
            </>
          )}
        </section>

        {/* 4) Konum + Harita */}
        {listing.businessDistrict && (
          <section className="card p-4 sm:p-5">
            <h2 className="type-card mb-3" style={{ color: 'var(--ah-ink)' }}>Konum</h2>
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
              <p className="type-meta mt-3" style={{ color: 'var(--ah-ink-3)' }}>{listing.businessAddress}</p>
            )}
            {listing.businessLatitude == null && (
              <p className="type-caption mt-1" style={{ color: 'var(--ah-warn)' }}>
                Yaklaşık konum — işletme tam adresi haritada işaretlememiş.
              </p>
            )}
          </section>
        )}

        {/* 5) İşletme hakkında — lg altında burada; lg+ yan panelde */}
        <section className="card p-4 sm:p-5 lg:hidden">
          {businessFacts}
        </section>

        </div>  {/* SOL kolon kapanis */}

        {/* === SAĞ PANEL (lg+): vardiya özeti + başvuru eylemi + işletme kısa bilgisi === */}
        <aside className="hidden lg:block">
          <div className="lg:sticky lg:top-20 space-y-4">
            <div className="card p-5">
              <h2 className="type-card" style={{ color: 'var(--ah-ink)' }}>Başvuru</h2>
              <ShiftSummary hasFuture={hasFuture} openSlots={openSlots} openPeople={openPeople} />
              <button type="button" onClick={handleApply} disabled={!canApply} className="btn-primary mt-4">
                {applyLabel}
              </button>
              {canApply && (
                <p className="type-caption text-center mt-2" style={{ color: 'var(--ah-ink-3)' }}>
                  Başvurmak 30 saniye sürer
                </p>
              )}
            </div>
            <div className="card p-5">
              {businessFacts}
            </div>
          </div>
        </aside>
        </div>  {/* grid kapanis */}

        {/* FAZ 16 — Benzer İlanlar (content-based) */}
        <SimilarListings listingId={id} onNavigate={(lid) => navigate(`/listings/${lid}`)} />
      </main>

      {/* MOBİL SABİT ALT BAR (lg altı): [ücret /birim] [Başvur] */}
      <div className="mobile-apply-bar" data-testid="mobile-apply-bar">
        <div className="min-w-0 flex-1">
          {sal ? (
            <p className="type-card type-num truncate" style={{ color: 'var(--ah-ok)' }}>
              {sal.amount}
              {sal.unit && <span className="type-meta ml-1" style={{ color: 'var(--ah-ink-3)' }}>/{sal.unit}</span>}
            </p>
          ) : (
            <p className="type-meta truncate" style={{ color: 'var(--ah-ink-3)' }}>Ücret belirtilmemiş</p>
          )}
          <p className="type-caption truncate" style={{ color: 'var(--ah-ink-3)' }}>
            {!hasFuture ? 'Vardiyaların tarihi geçti'
              : openSlots.length === 0 ? 'Tüm vardiyalar dolu'
              : `${openSlots.length} açık vardiya`}
          </p>
        </div>
        <button type="button" onClick={handleApply} disabled={!canApply}
          className="btn-primary !w-auto flex-shrink-0 min-w-[132px]">
          {applyLabel}
        </button>
      </div>

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

/* Yan panel vardiya özeti: "3 açık vardiya · ilk: 12 Eki Pzt 09:00 · 5 kişi aranıyor" */
function ShiftSummary({ hasFuture, openSlots, openPeople }) {
  if (!hasFuture) {
    return <p className="type-meta mt-1" style={{ color: 'var(--ah-ink-3)' }}>Bu ilanın vardiyalarının tarihi geçti.</p>
  }
  if (openSlots.length === 0) {
    return <p className="type-meta mt-1" style={{ color: 'var(--ah-ink-3)' }}>Tüm vardiyalar doldu.</p>
  }
  const first = openSlots[0]
  return (
    <ul className="mt-2 space-y-1 type-meta" style={{ color: 'var(--ah-ink-2)' }}>
      <li><span className="font-semibold type-num" style={{ color: 'var(--ah-ink)' }}>{openSlots.length}</span> açık vardiya</li>
      <li>İlk: <span className="type-num">{fmtDay(first.date)} · {first.startTime?.slice(0, 5)}</span></li>
      {openPeople > 0 && <li><span className="type-num">{openPeople}</span> kişi aranıyor</li>}
    </ul>
  )
}

/* İşletme kısa bilgisi (güven sinyalleri — puan/skor YOK) */
function BusinessFacts({ listing }) {
  const items = []
  if (listing.businessCreatedAt) items.push({ label: 'Kadrom üyeliği', value: memberSince(listing.businessCreatedAt) })
  if (typeof listing.businessWorkerCount === 'number') items.push({ label: 'Tamamlanan iş', value: `${listing.businessWorkerCount}+` })
  if (typeof listing.viewCount === 'number') items.push({ label: 'Görüntülenme', value: listing.viewCount.toLocaleString('tr-TR') })
  return (
    <>
      <h2 className="type-card" style={{ color: 'var(--ah-ink)' }}>İşletme hakkında</h2>
      <p className="type-meta mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>{listing.businessName}</p>
      {items.length > 0 && (
        <dl className="grid grid-cols-3 lg:grid-cols-1 gap-3 mt-3">
          {items.map(it => <TrustSignal key={it.label} label={it.label} value={it.value} />)}
        </dl>
      )}
    </>
  )
}

/* Dalga 4 / Ozellik 4 — Guven sinyali kucuk kutu */
function TrustSignal({ label, value }) {
  return (
    <div className="text-left min-w-0">
      <dt className="type-caption" style={{ color: 'var(--ah-ink-3)' }}>{label}</dt>
      <dd className="type-subhead type-num mt-0.5" style={{ color: 'var(--ah-ink)' }}>{value}</dd>
    </div>
  )
}

/* "2 ay", "1 yıl" — uyelik suresi insan-okunabilir */
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
