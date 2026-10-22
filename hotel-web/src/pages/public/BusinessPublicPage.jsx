import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { useAuth } from '../../context/AuthContext'
import ReportModal from '../../components/ReportModal'
import { keys } from '../../lib/queryClient'
import { useConfirm } from '../../lib/useConfirm'
import cldImg from '../../lib/cldImg'
import VerifiedBadge from '../../components/VerifiedBadge'
import BusinessLogo from '../../components/BusinessLogo'
import { SkeletonDetail } from '../../components/Skeleton'
import { BUSINESS_TYPE_LABELS } from '../../utils/labels'
import { panelPathFor } from '../../lib/navigation'

const MapView = lazy(() => import('../../components/MapView'))

/**
 * Yalnız http(s) adres bağlantı olur; javascript:, data: vb. null (düz metin gösterilir).
 * Sunucu da kayıtta yalnız http(s) kabul eder; bu, eski kayıtlara karşı ikinci katman.
 */
function safeHttpUrl(value) {
  if (!value || typeof value !== 'string') return null
  try {
    const u = new URL(value.trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname ? u.href : null
  } catch {
    return null
  }
}

/** Sosyal medya: tam http(s) adres ya da kullanıcı adı (ör. @otelim) → profil bağlantısı. */
function socialUrl(value, base) {
  if (!value || typeof value !== 'string') return null
  const v = value.trim()
  if (/^https?:/i.test(v)) return safeHttpUrl(v)
  const handle = v.replace(/^@/, '')
  return /^[A-Za-z0-9._-]{1,64}$/.test(handle) ? `${base}/${handle}` : null
}

/**
 * FAZ 5.9 — Isletme public profil sayfasi (paylasilabilir).
 *
 * Route: /p/business/:id
 * - Login gerektirmez
 * - SEO meta tags: document.title + og:title + og:image + description
 * - Logo + galeri + harita + iletisim (aktif ilan listesi icin backend'de
 *   isletmeye gore ilan ucu yok; bkz. Madde 6 raporu)
 */

// Etiket kaynağı utils/labels.js (backend BusinessType: HOTEL, RESTAURANT, CAFE).
// Bilinmeyen tip ham enum olarak değil "İşletme" olarak görünür.
const TYPE_LABELS = BUSINESS_TYPE_LABELS

function ShareIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={2} className="w-4 h-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={2} className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
    </svg>
  )
}

const DAY_LABELS_TR = {
  MONDAY: 'Pazartesi', TUESDAY: 'Salı', WEDNESDAY: 'Çarşamba',
  THURSDAY: 'Perşembe', FRIDAY: 'Cuma', SATURDAY: 'Cumartesi', SUNDAY: 'Pazar',
}
const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']

function parseWorkingHours(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw  // zaten parse'lanmis
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null  // serbest text
  try { return JSON.parse(trimmed) } catch { return null }
}

function useSeoMeta({ title, description, image, url }) {
  useEffect(() => {
    const prev = {
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.content,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogDesc:  document.querySelector('meta[property="og:description"]')?.content,
      ogImage: document.querySelector('meta[property="og:image"]')?.content,
      ogUrl:   document.querySelector('meta[property="og:url"]')?.content,
    }

    function setMeta(selector, attr, value, create) {
      let el = document.querySelector(selector)
      if (!el && create) {
        el = document.createElement('meta')
        const m = selector.match(/\[(\w+)="([^"]+)"\]/)
        if (m) el.setAttribute(m[1], m[2])
        document.head.appendChild(el)
      }
      if (el) el.setAttribute(attr, value || '')
    }

    if (title) document.title = title
    setMeta('meta[name="description"]',        'content', description, true)
    setMeta('meta[property="og:title"]',       'content', title,       true)
    setMeta('meta[property="og:description"]', 'content', description, true)
    setMeta('meta[property="og:image"]',       'content', image,       true)
    setMeta('meta[property="og:url"]',         'content', url,         true)
    setMeta('meta[property="og:type"]',        'content', 'profile',   true)
    setMeta('meta[name="twitter:card"]',       'content', 'summary_large_image', true)

    return () => {
      document.title = prev.title
      setMeta('meta[name="description"]',        'content', prev.desc    || '')
      setMeta('meta[property="og:title"]',       'content', prev.ogTitle || '')
      setMeta('meta[property="og:description"]', 'content', prev.ogDesc  || '')
      setMeta('meta[property="og:image"]',       'content', prev.ogImage || '')
      setMeta('meta[property="og:url"]',         'content', prev.ogUrl   || '')
    }
  }, [title, description, image, url])
}

export default function BusinessPublicPage() {
  const confirm = useConfirm()
  const { id } = useParams()
  const navigate = useNavigate()
  const [galleryIndex, setGalleryIndex] = useState(0)

  const { data: business, isLoading, error, refetch } = useQuery({
    queryKey: keys.businesses?.detail?.(id) ?? ['public-business', id],
    queryFn: () => hotelApi.getPublicBusiness(id),
    enabled: !!id,
  })

  // Dalga I1 — Takip + Bildir (sadece aday icin)
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isCandidate = user?.role === 'CANDIDATE'
  const [reportOpen, setReportOpen] = useState(false)
  const { data: following = [] } = useQuery({
    queryKey: ['my-following-businesses'],
    queryFn: () => hotelApi.getMyFollowingBusinesses(),
    enabled: isCandidate,
    staleTime: 60_000,
  })
  const { data: blocked = [] } = useQuery({
    queryKey: ['my-blocked-businesses'],
    queryFn: () => hotelApi.getMyBlockedBusinesses(),
    enabled: isCandidate,
    staleTime: 60_000,
  })
  const isFollowing = following.some(b => b.id === Number(id))
  const isBlocked   = blocked.some(b => b.id === Number(id))

  async function toggleFollow() {
    try {
      if (isFollowing) await hotelApi.unfollowBusiness(id)
      else             await hotelApi.followBusiness(id)
      queryClient.invalidateQueries({ queryKey: ['my-following-businesses'] })
      queryClient.invalidateQueries({ queryKey: ['my-blocked-businesses'] })
    } catch { toast.error('İşlem başarısız') }
  }
  const [blockLoading, setBlockLoading] = useState(false)
  async function toggleBlock() {
    const ok = await confirm(isBlocked
      ? {
          title: 'Engeli kaldır',
          description: 'Bu işletmenin ilanları ilan listende yeniden görünür.',
          confirmLabel: 'Engeli kaldır',
        }
      : {
          title: 'İşletmeyi engelle',
          description: 'Bu işletmenin ilanları ilan listende artık görünmez. İstediğin zaman engeli kaldırabilirsin.',
          confirmLabel: 'Evet, engelle',
          destructive: true,
        })
    if (!ok) return
    setBlockLoading(true)
    try {
      if (isBlocked) await hotelApi.unblockBusiness(id)
      else           await hotelApi.blockBusiness(id)
      toast.success(isBlocked ? 'Engel kaldırıldı.' : 'İşletme engellendi.')
      queryClient.invalidateQueries({ queryKey: ['my-blocked-businesses'] })
      queryClient.invalidateQueries({ queryKey: ['my-following-businesses'] })
    } catch { toast.error('İşlem başarısız') }
    finally { setBlockLoading(false) }
  }

  const { data: photos = [] } = useQuery({
    queryKey: ['public-business-photos', id],
    queryFn: () => hotelApi.getBusinessGallery(id),
    enabled: !!id,
  })

  // SEO
  const seoImage = business?.logoUrl
    ? cldImg(business.logoUrl, { w: 1200 })
    : (photos[0]?.url ? cldImg(photos[0].url, { w: 1200 }) : null)

  useSeoMeta({
    title: business ? `${business.name} · ${TYPE_LABELS[business.type] || 'İşletme'} · Kadrom` : 'Kadrom',
    description: business?.description?.slice(0, 160) ||
      (business ? `${business.name} hakkında bilgi, fotoğraflar ve iletişim bilgileri.` : ''),
    image: seoImage,
    url: typeof window !== 'undefined' ? window.location.href : '',
  })

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({
        title: business?.name || 'Kadrom',
        text: business?.description?.slice(0, 100) || '',
        url,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url)
      toast.success('Bağlantı kopyalandı')
    }
  }

  if (isLoading) {
    return (
      <div className="ah-surface min-h-screen" role="status" aria-live="polite">
        <span className="sr-only">İşletme profili yükleniyor</span>
        <SkeletonDetail />
      </div>
    )
  }

  if (error || !business) {
    const notFound = !error || error?.response?.status === 404
    return (
      <div className="ah-surface min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full text-center space-y-3" role="alert">
          <h1 className="type-section">{notFound ? 'İşletme bulunamadı' : 'Profil yüklenemedi'}</h1>
          <p className="type-body" style={{ color: 'var(--ah-ink-3)' }}>
            {notFound
              ? 'Bu bağlantıdaki işletme kaldırılmış ya da adres hatalı olabilir.'
              : 'Bağlantını kontrol edip yeniden dene.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
            {!notFound && (
              <button type="button" onClick={() => refetch()} className="btn-secondary">Tekrar dene</button>
            )}
            <Link to="/" className="btn-primary sm:!w-auto">Ana sayfaya dön</Link>
          </div>
        </div>
      </div>
    )
  }

  const typeLabel = TYPE_LABELS[business.type] || 'İşletme'
  const fullLocation = [business.district, business.neighborhood].filter(Boolean).join(' · ')
  const activePhoto = photos[galleryIndex]
  const websiteHref = safeHttpUrl(business.website)
  const instagramHref = socialUrl(business.instagram, 'https://instagram.com')
  const facebookHref = socialUrl(business.facebook, 'https://facebook.com')
  const hasContact = business.address || business.phone || business.website
  const workingHours = business.workingHours ? parseWorkingHours(business.workingHours) : null

  // Schema.org JSON-LD (rich snippet)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: business.name,
    description: business.description,
    address: {
      '@type': 'PostalAddress',
      addressLocality: business.district,
      addressRegion: business.city,
      addressCountry: 'TR',
      streetAddress: business.address,
    },
    telephone: business.phone,
    url: typeof window !== 'undefined' ? window.location.href : '',
    image: seoImage,
    geo: business.latitude && business.longitude ? {
      '@type': 'GeoCoordinates',
      latitude: business.latitude,
      longitude: business.longitude,
    } : undefined,
  }

  return (
    <div className="ah-surface min-h-screen relative">
      {/* Schema.org JSON-LD — XSS guard: isletme adi gibi user-data icinde
          '</script>' geçerse script tag'den kacis olabilirdi. JSON.stringify
          '<' karakterini escape etmiyor; '<' ile escape edilir. */}
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* Üst çubuk */}
      <header className="border-b backdrop-blur-xl sticky top-0 z-20"
              style={{ background: 'rgba(255, 255, 255, 0.88)', borderColor: 'var(--ah-line)' }}>
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-md min-h-[44px]">
            <span className="type-card" style={{ fontSize: 18, fontWeight: 700 }}>Kadrom</span>
            <span className="type-caption hidden sm:inline">İstanbul</span>
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button type="button" onClick={handleShare} className="btn-ghost">
              <ShareIcon /> <span className="sr-only sm:not-sr-only">Paylaş</span>
            </button>
            {user ? (
              <Link to={panelPathFor(user.role)} className="btn-secondary">Panelime dön</Link>
            ) : (
              <button type="button" onClick={() => navigate('/login')} className="btn-primary !w-auto">
                Giriş yap
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Başlık kartı — grafit şerit + logo + ad + konum */}
        <section className="card !p-0 overflow-hidden" aria-labelledby="business-name">
          <div className="h-20 sm:h-24" style={{ background: 'var(--ah-brand-gradient)' }} aria-hidden="true" />
          <div className="px-5 lg:px-8 pb-6 -mt-10 sm:-mt-12">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
              <BusinessLogo name={business.name} logoUrl={business.logoUrl} size="lg"
                            alt={`${business.name} logosu`}
                            style={{ border: '3px solid var(--ah-card)', boxShadow: 'var(--elev-2)' }} />
              <div className="min-w-0 flex-1 sm:pt-14">
                <p className="type-meta">
                  {typeLabel}
                  {business.category && <span> · {business.category}</span>}
                </p>
                <h1 id="business-name" className="type-page inline-flex items-center gap-2 break-words mt-0.5">
                  {business.name}
                  {business.verified && <VerifiedBadge size="lg" />}
                </h1>
                {(fullLocation || business.city) && (
                  <p className="type-body mt-1 inline-flex items-center gap-1.5 w-full" style={{ color: 'var(--ah-ink-3)' }}>
                    <PinIcon /> {fullLocation || business.city}
                  </p>
                )}
                {/* Aday için takip / engelle / bildir */}
                {isCandidate && (
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <button type="button" onClick={toggleFollow} aria-pressed={isFollowing}
                      className={`${isFollowing ? 'btn-primary' : 'btn-secondary'} !w-auto`}>
                      {isFollowing ? 'Takip ediliyor' : 'Takip et'}
                    </button>
                    <button type="button" onClick={toggleBlock} disabled={blockLoading}
                      className={isBlocked ? 'btn-secondary' : 'btn-danger'}>
                      {isBlocked ? 'Engeli kaldır' : 'Engelle'}
                    </button>
                    <button type="button" onClick={() => setReportOpen(true)} className="btn-ghost">
                      İşletmeyi bildir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Galeri */}
        {photos.length > 0 && (
          <section className="card !p-0 overflow-hidden" aria-label="Fotoğraflar">
            <div className="aspect-[16/9] relative" style={{ background: 'var(--ah-ink)' }}>
              <img src={cldImg(activePhoto.url, { w: 1200 })}
                   alt={`${business.name} fotoğrafı ${galleryIndex + 1}`}
                   className="w-full h-full object-cover" />
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={() => setGalleryIndex(i => (i - 1 + photos.length) % photos.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(255, 255, 255, 0.92)', border: '1px solid var(--ah-line-2)', color: 'var(--ah-ink)' }}
                          aria-label="Önceki fotoğraf"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
                  <button type="button" onClick={() => setGalleryIndex(i => (i + 1) % photos.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(255, 255, 255, 0.92)', border: '1px solid var(--ah-line-2)', color: 'var(--ah-ink)' }}
                          aria-label="Sonraki fotoğraf"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg></button>
                </>
              )}
              <div className="absolute bottom-3 right-3 px-2.5 py-0.5 rounded-full type-badge type-num"
                   style={{ background: 'rgba(17, 24, 39, 0.72)', color: 'var(--text-inverse)' }}>
                {galleryIndex + 1} / {photos.length}
              </div>
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-3 gap-5 sm:gap-6">
          {/* Hakkında + çalışma saatleri + konum */}
          <div className="lg:col-span-2 space-y-5 sm:space-y-6 min-w-0">
            {business.description ? (
              <section className="card !p-5" aria-labelledby="bp-about">
                <h2 id="bp-about" className="type-card mb-2">Hakkında</h2>
                <p className="type-body leading-relaxed whitespace-pre-wrap break-words" style={{ color: 'var(--ah-ink-2)' }}>
                  {business.description}
                </p>
              </section>
            ) : (
              <section className="card !p-5" aria-labelledby="bp-about">
                <h2 id="bp-about" className="type-card">Hakkında</h2>
                <p className="type-body mt-1" style={{ color: 'var(--ah-ink-3)' }}>
                  İşletme henüz tanıtım yazısı eklemedi.
                </p>
              </section>
            )}

            {business.workingHours && (
              <section className="card !p-5" aria-labelledby="bp-hours">
                <h2 id="bp-hours" className="type-card mb-2">Çalışma saatleri</h2>
                {workingHours ? (
                  <ul>
                    {DAY_ORDER.map(day => {
                      const d = workingHours[day]
                      if (!d) return null
                      return (
                        <li key={day} className="flex items-center justify-between gap-3 py-2 border-b last:border-0"
                            style={{ borderColor: 'var(--ah-line)' }}>
                          <span className="type-body" style={{ color: 'var(--ah-ink)' }}>{DAY_LABELS_TR[day]}</span>
                          {d.closed
                            ? <span className="badge badge-neutral">Kapalı</span>
                            : <span className="type-body type-num font-semibold" style={{ color: 'var(--ah-ink-2)' }}>{d.open} – {d.close}</span>}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="type-body leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--ah-ink-2)' }}>
                    {business.workingHours}
                  </p>
                )}
              </section>
            )}

            {business.latitude != null && business.longitude != null && (
              <section className="card !p-0 overflow-hidden" aria-labelledby="bp-map">
                <div className="px-5 py-3 flex items-center justify-between gap-3">
                  <h2 id="bp-map" className="type-card">Konum</h2>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`}
                     target="_blank" rel="noopener noreferrer" className="btn-ghost">
                    Haritada aç<span className="sr-only"> (Google Haritalar, yeni sekmede)</span>
                  </a>
                </div>
                <div className="h-[260px] lg:h-[320px] relative">
                  <Suspense fallback={
                    <div className="absolute inset-0 flex items-center justify-center type-meta"
                         style={{ background: 'var(--ah-band)' }}>
                      Harita yükleniyor
                    </div>
                  }>
                    <MapView
                      position={[Number(business.latitude), Number(business.longitude)]}
                      markerLabel={business.name}
                      zoom={15}
                    />
                  </Suspense>
                </div>
              </section>
            )}
          </div>

          {/* İletişim + sosyal medya */}
          <aside className="space-y-4 min-w-0">
            <section className="card !p-5" aria-labelledby="bp-contact">
              <h2 id="bp-contact" className="type-card mb-3">İletişim</h2>
              {hasContact ? (
                <dl className="space-y-3">
                  {business.address && (
                    <div>
                      <dt className="type-label">Adres</dt>
                      <dd className="type-body mt-0.5 break-words" style={{ color: 'var(--ah-ink-2)' }}>{business.address}</dd>
                    </div>
                  )}
                  {business.phone && (
                    <div>
                      <dt className="type-label">Telefon</dt>
                      <dd className="mt-0.5">
                        <a href={`tel:${business.phone}`} className="type-body type-num font-medium hover:underline"
                           style={{ color: 'var(--ah-ink)' }}>{business.phone}</a>
                      </dd>
                    </div>
                  )}
                  {business.website && (
                    <div>
                      <dt className="type-label">Web sitesi</dt>
                      <dd className="mt-0.5 min-w-0">
                        {websiteHref ? (
                          <a href={websiteHref} target="_blank" rel="noopener noreferrer"
                             className="type-body font-medium hover:underline block truncate"
                             style={{ color: 'var(--ah-ink)' }}>{business.website}</a>
                        ) : (
                          <span className="type-body font-medium block truncate" style={{ color: 'var(--ah-ink)' }}>
                            {business.website}
                          </span>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="type-body" style={{ color: 'var(--ah-ink-3)' }}>İletişim bilgisi eklenmemiş.</p>
              )}

              {(instagramHref || facebookHref) && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--ah-line)' }}>
                  <h3 className="type-label mb-2">Sosyal medya</h3>
                  <div className="flex gap-2 flex-wrap">
                    {instagramHref && (
                      <a href={instagramHref} target="_blank" rel="noopener noreferrer" className="chip">Instagram</a>
                    )}
                    {facebookHref && (
                      <a href={facebookHref} target="_blank" rel="noopener noreferrer" className="chip">Facebook</a>
                    )}
                  </div>
                </div>
              )}
            </section>

            <button type="button" onClick={handleShare} className="btn-secondary w-full">
              <ShareIcon /> Profili paylaş
            </button>
          </aside>
        </div>

        <footer className="text-center py-6">
          <Link to="/" className="type-caption hover:underline">
            Kadrom · İstanbul'da otel, restoran ve kafe işleri
          </Link>
        </footer>
      </main>

      {/* Dalga I1 — Isletmeyi bildir: hedef ISLETME (ReportType.BUSINESS, isletme id'si) */}
      {reportOpen && business?.id && (
        <ReportModal
          targetType="BUSINESS"
          targetId={business.id}
          targetLabel={business.name}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  )
}
