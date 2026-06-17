import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { keys } from '../../lib/queryClient'
import cldImg, { ImgSize } from '../../lib/cldImg'

const MapView = lazy(() => import('../../components/MapView'))

/**
 * FAZ 5.9 — Isletme public profil sayfasi (paylasilabilir).
 *
 * Route: /p/business/:id
 * - Login gerektirmez
 * - SEO meta tags: document.title + og:title + og:image + description
 * - Logo + gallery + ortalama puan + ilanlar + harita + iletisim
 */

const TYPE_LABELS = {
  HOTEL: 'Otel',
  RESTAURANT: 'Restoran',
  CAFE: 'Kafe',
  BAR: 'Bar',
  CATERING: 'Catering',
  RESORT: 'Resort',
  HOSTEL: 'Hostel',
  EVENT_VENUE: 'Etkinlik Mekanı',
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

function StarRow({ avg, count }) {
  if (!avg || !count) {
    return (
      <span className="text-[11px] uppercase tracking-widest" style={{ color: 'rgba(229, 231, 235, 0.45)' }}>
        Henüz puan yok
      </span>
    )
  }
  const full = Math.floor(avg)
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <svg key={i} viewBox="0 0 20 20" className="w-4 h-4"
               fill={i <= full ? '#fbbf24' : 'rgba(212, 168, 83, 0.18)'}>
            <path d="M9.05 2.93a1 1 0 011.9 0l1.5 4.3a1 1 0 00.95.67h4.5a1 1 0 01.6 1.8l-3.7 2.7a1 1 0 00-.35 1.1l1.4 4.3a1 1 0 01-1.55 1.1l-3.7-2.7a1 1 0 00-1.2 0l-3.7 2.7a1 1 0 01-1.55-1.1l1.4-4.3a1 1 0 00-.35-1.1l-3.7-2.7a1 1 0 01.6-1.8h4.5a1 1 0 00.95-.67l1.5-4.3z" />
          </svg>
        ))}
      </div>
      <span className="font-bebas text-lg tracking-wider" style={{ color: '#fbbf24' }}>
        {avg.toFixed(1)}
      </span>
      <span className="text-[11px]" style={{ color: '#fde9a5' }}>
        ({count} değerlendirme)
      </span>
    </div>
  )
}

export default function BusinessPublicPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [galleryIndex, setGalleryIndex] = useState(0)

  const { data: business, isLoading, error } = useQuery({
    queryKey: keys.businesses?.detail?.(id) ?? ['public-business', id],
    queryFn: () => hotelApi.getPublicBusiness(id),
    enabled: !!id,
  })

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
    title: business ? `${business.name} · ${TYPE_LABELS[business.type] || ''} · AjansHotel` : 'AjansHotel',
    description: business?.description?.slice(0, 160) ||
      (business ? `${business.name} hakkında bilgi, fotoğraflar ve aktif ilanlar.` : ''),
    image: seoImage,
    url: typeof window !== 'undefined' ? window.location.href : '',
  })

  function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({
        title: business?.name || 'AjansHotel',
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0c1726' }}>
        <div className="font-bebas text-2xl tracking-widest" style={{ color: '#fde9a5' }}>YÜKLENİYOR...</div>
      </div>
    )
  }

  if (error || !business) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: '#0c1726' }}>
        <div className="font-bebas text-3xl tracking-widest mb-2 text-white">404</div>
        <div className="text-sm mb-6" style={{ color: '#fde9a5' }}>İşletme bulunamadı.</div>
        <Link to="/" className="text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #b8902d)', color: '#fff' }}>
          Ana Sayfaya Dön
        </Link>
      </div>
    )
  }

  const typeLabel = TYPE_LABELS[business.type] || business.type
  const fullLocation = [business.district, business.neighborhood].filter(Boolean).join(' · ')
  const initial = (business.name?.charAt(0) || '?').toUpperCase()
  const activePhoto = photos[galleryIndex]

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
    aggregateRating: business.averageRating && business.reviewCount ? {
      '@type': 'AggregateRating',
      ratingValue: business.averageRating,
      reviewCount: business.reviewCount,
    } : undefined,
  }

  return (
    <div className="min-h-screen relative" style={{ background: '#0c1726' }}>
      {/* Schema.org JSON-LD — XSS guard: isletme adi gibi user-data icinde
          '</script>' geçerse script tag'den kacis olabilirdi. JSON.stringify
          '<' karakterini escape etmiyor; '<' ile escape edilir. */}
      <script type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />

      {/* Calm radial halo */}
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none"
           style={{
             background:
               'radial-gradient(ellipse 800px 600px at 10% 0%, rgba(30, 58, 95, 0.20) 0%, transparent 60%),' +
               'radial-gradient(ellipse 600px 500px at 90% 100%, rgba(212, 168, 83, 0.12) 0%, transparent 60%)',
           }} />

      <div className="relative z-10">
        {/* Top bar */}
        <header className="border-b backdrop-blur-xl"
                style={{ background: 'rgba(15, 23, 38, 0.75)', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="font-bebas text-xl tracking-wider text-white">AJANSHOTEL</span>
              <span className="text-[9px] uppercase tracking-[0.2em]" style={{ color: '#fde9a5' }}>istanbul</span>
            </Link>
            <div className="flex items-center gap-2">
              <button onClick={handleShare}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(212, 168, 83, 0.18)', color: '#fde9a5', border: '1px solid rgba(212, 168, 83, 0.30)' }}>
                Paylaş
              </button>
              <button onClick={() => navigate('/login')}
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                style={{ background: 'linear-gradient(135deg, #1e3a5f, #b8902d)', color: '#fff' }}>
                Giriş Yap
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-8 space-y-6" style={{ color: '#dde7f3' }}>
          {/* HERO — logo + name + location + rating */}
          <section className="rounded-2xl p-6 lg:p-8 relative overflow-hidden"
                   style={{
                     background: 'linear-gradient(135deg, rgba(21, 36, 61, 0.85), rgba(15, 23, 38, 0.85))',
                     border: '1px solid rgba(212, 168, 83, 0.20)',
                   }}>
            <div aria-hidden className="absolute pointer-events-none"
                 style={{
                   top: '-60px', right: '-60px', width: '260px', height: '260px',
                   background: 'radial-gradient(circle, rgba(212, 168, 83, 0.18) 0%, transparent 70%)',
                 }} />
            <div className="relative flex flex-col sm:flex-row items-start gap-5">
              {/* Logo */}
              {business.logoUrl ? (
                <img src={cldImg(business.logoUrl, { w: ImgSize.avatarMd })}
                     alt={business.name}
                     className="w-24 h-24 rounded-2xl object-cover flex-shrink-0"
                     style={{ border: '2px solid rgba(212, 168, 83, 0.40)', boxShadow: '0 0 24px rgba(212, 168, 83, 0.30)' }} />
              ) : (
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center font-bebas text-4xl text-white flex-shrink-0"
                     style={{ background: 'linear-gradient(135deg, #1e3a5f, #b8902d)', boxShadow: '0 0 24px rgba(212, 168, 83, 0.40)' }}>
                  {initial}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[0.25em] font-bold mb-1" style={{ color: '#fde9a5' }}>
                  {typeLabel}
                  {business.category && <span> · {business.category}</span>}
                </div>
                <h1 className="font-bebas text-2xl sm:text-3xl lg:text-4xl tracking-wider uppercase text-white leading-tight"
                    style={{ textShadow: '0 0 18px rgba(212, 168, 83, 0.40)' }}>
                  {business.name}
                </h1>
                <div className="text-sm mt-1.5" style={{ color: '#8ba9d2' }}>
                  {fullLocation || business.city || '—'}
                </div>
                <div className="mt-3">
                  <StarRow avg={business.averageRating} count={business.reviewCount} />
                </div>
              </div>
            </div>
          </section>

          {/* Gallery */}
          {photos.length > 0 && (
            <section className="rounded-2xl overflow-hidden"
                     style={{
                       background: 'rgba(21, 36, 61, 0.55)',
                       border: '1px solid rgba(212, 168, 83, 0.18)',
                     }}>
              <div className="aspect-[16/9] relative bg-black">
                <img src={cldImg(activePhoto.url, { w: 1200 })} alt=""
                     className="w-full h-full object-cover" />
                {photos.length > 1 && (
                  <>
                    <button onClick={() => setGalleryIndex(i => (i - 1 + photos.length) % photos.length)}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-lg"
                            style={{ background: 'rgba(15, 23, 38, 0.65)', border: '1px solid rgba(212, 168, 83, 0.30)' }}
                            aria-label="Önceki foto"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg></button>
                    <button onClick={() => setGalleryIndex(i => (i + 1) % photos.length)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-white text-lg"
                            style={{ background: 'rgba(15, 23, 38, 0.65)', border: '1px solid rgba(212, 168, 83, 0.30)' }}
                            aria-label="Sonraki foto"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg></button>
                  </>
                )}
                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold"
                     style={{ background: 'rgba(15, 23, 38, 0.75)', color: '#fff' }}>
                  {galleryIndex + 1} / {photos.length}
                </div>
              </div>
            </section>
          )}

          {/* Harita */}
          {business.latitude != null && business.longitude != null && (
            <section className="rounded-2xl overflow-hidden"
                     style={{ background: 'rgba(21, 36, 61, 0.55)', border: '1px solid rgba(212, 168, 83, 0.18)' }}>
              <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
                <h2 className="font-bebas text-lg tracking-[0.2em] uppercase" style={{ color: '#fde9a5' }}>
                  Konum
                </h2>
                {business.address && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${business.latitude},${business.longitude}`}
                     target="_blank" rel="noopener noreferrer"
                     className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                     style={{ background: 'rgba(212, 168, 83, 0.18)', color: '#fde9a5', border: '1px solid rgba(212, 168, 83, 0.30)' }}>
                    Google Maps
                  </a>
                )}
              </div>
              <div className="h-[280px] lg:h-[320px] relative">
                <Suspense fallback={
                  <div className="absolute inset-0 flex items-center justify-center text-xs uppercase tracking-widest"
                       style={{ color: '#8ba9d2' }}>
                    Harita yükleniyor...
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

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Description + Working hours (2 col) */}
            <div className="lg:col-span-2 space-y-6">
              {business.description && (
                <section className="rounded-2xl p-5"
                         style={{ background: 'rgba(21, 36, 61, 0.55)', border: '1px solid rgba(212, 168, 83, 0.14)' }}>
                  <h2 className="font-bebas text-lg tracking-[0.2em] uppercase mb-3" style={{ color: '#fde9a5' }}>
                    Hakkında
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#dde7f3' }}>
                    {business.description}
                  </p>
                </section>
              )}

              {business.workingHours && (() => {
                const parsed = parseWorkingHours(business.workingHours)
                return (
                  <section className="rounded-2xl p-5"
                           style={{ background: 'rgba(21, 36, 61, 0.55)', border: '1px solid rgba(212, 168, 83, 0.14)' }}>
                    <h2 className="font-bebas text-lg tracking-[0.2em] uppercase mb-3" style={{ color: '#fde9a5' }}>
                      Çalışma Saatleri
                    </h2>
                    {parsed ? (
                      <ul className="space-y-1.5">
                        {DAY_ORDER.map(day => {
                          const d = parsed[day]
                          if (!d) return null
                          return (
                            <li key={day} className="flex items-center justify-between text-sm py-1 border-b last:border-0"
                                style={{ borderColor: 'rgba(212, 168, 83, 0.08)' }}>
                              <span className="font-bebas text-base tracking-wider uppercase" style={{ color: '#fde9a5' }}>
                                {DAY_LABELS_TR[day]}
                              </span>
                              {d.closed ? (
                                <span className="text-[11px] font-bold uppercase tracking-widest"
                                      style={{ color: '#fca5a5' }}>
                                  Kapalı
                                </span>
                              ) : (
                                <span className="font-mono text-[13px] font-bold" style={{ color: '#dde7f3' }}>
                                  {d.open} – {d.close}
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#dde7f3' }}>
                        {business.workingHours}
                      </p>
                    )}
                  </section>
                )
              })()}
            </div>

            {/* Contact + Social (1 col sidebar) */}
            <aside className="space-y-4">
              <section className="rounded-2xl p-5"
                       style={{ background: 'rgba(21, 36, 61, 0.55)', border: '1px solid rgba(212, 168, 83, 0.14)' }}>
                <h2 className="font-bebas text-lg tracking-[0.2em] uppercase mb-3" style={{ color: '#fde9a5' }}>
                  İletişim
                </h2>
                <ul className="space-y-2 text-sm">
                  {business.address && (
                    <li>
                      <div className="text-[10px] uppercase tracking-widest" style={{ color: '#8ba9d2' }}>Adres</div>
                      <div className="font-medium mt-0.5" style={{ color: '#dde7f3' }}>{business.address}</div>
                    </li>
                  )}
                  {business.phone && (
                    <li>
                      <div className="text-[10px] uppercase tracking-widest" style={{ color: '#8ba9d2' }}>Telefon</div>
                      <a href={`tel:${business.phone}`} className="font-medium block mt-0.5 hover:underline"
                         style={{ color: '#f7c43c' }}>{business.phone}</a>
                    </li>
                  )}
                  {business.website && (
                    <li>
                      <div className="text-[10px] uppercase tracking-widest" style={{ color: '#8ba9d2' }}>Web</div>
                      <a href={business.website} target="_blank" rel="noopener noreferrer"
                         className="font-medium block mt-0.5 hover:underline truncate"
                         style={{ color: '#f7c43c' }}>{business.website}</a>
                    </li>
                  )}
                </ul>

                {(business.instagram || business.facebook) && (
                  <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(212, 168, 83, 0.14)' }}>
                    <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#8ba9d2' }}>Sosyal Medya</div>
                    <div className="flex gap-2 flex-wrap">
                      {business.instagram && (
                        <a href={business.instagram.startsWith('http') ? business.instagram : `https://instagram.com/${business.instagram}`}
                           target="_blank" rel="noopener noreferrer"
                           className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                           style={{ background: 'rgba(212, 168, 83, 0.18)', color: '#fde9a5', border: '1px solid rgba(212, 168, 83, 0.30)' }}>
                          Instagram
                        </a>
                      )}
                      {business.facebook && (
                        <a href={business.facebook.startsWith('http') ? business.facebook : `https://facebook.com/${business.facebook}`}
                           target="_blank" rel="noopener noreferrer"
                           className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                           style={{ background: 'rgba(59, 130, 246, 0.18)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.30)' }}>
                          Facebook
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <button onClick={handleShare}
                className="w-full text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-full transition-all hover:-translate-y-0.5"
                style={{
                  background: 'linear-gradient(135deg, #1e3a5f, #b8902d)',
                  color: '#fff',
                  boxShadow: '0 0 18px rgba(212, 168, 83, 0.40)',
                }}>
                Profili Paylaş
              </button>
            </aside>
          </div>

          {/* Footer */}
          <footer className="text-center py-6">
            <Link to="/" className="text-[10px] uppercase tracking-[0.3em]" style={{ color: '#234a82' }}>
              AjansHotel · İstanbul Hospitality Network
            </Link>
          </footer>
        </main>
      </div>
    </div>
  )
}
