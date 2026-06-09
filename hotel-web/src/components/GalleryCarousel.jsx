import { useState, useEffect } from 'react'
import * as hotelApi from '../api/hotel'

/**
 * Aday tarafı — bir işletmenin galerisini carousel olarak gösterir.
 * Tıklanınca lightbox açılır.
 *
 * Props:
 *   businessId: bağımsız fetch için
 *   photos: önceden çekilmiş PhotoDto[] (varsa fetch yapılmaz)
 *   height: yükseklik class'ı (default: 'h-56')
 */
export default function GalleryCarousel({ businessId, photos: externalPhotos, height = 'h-56' }) {
  const [photos, setPhotos] = useState(externalPhotos || [])
  const [loading, setLoading] = useState(!externalPhotos && !!businessId)
  const [index, setIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  useEffect(() => {
    if (externalPhotos) {
      setPhotos(externalPhotos)
      setIndex(0)
      return
    }
    if (!businessId) return
    setLoading(true)
    hotelApi.getBusinessGallery(businessId)
      .then(data => setPhotos(Array.isArray(data) ? data : []))
      .catch(() => setPhotos([]))
      .finally(() => setLoading(false))
  }, [businessId, externalPhotos])

  if (loading) {
    return <div className={`${height} rounded-lg bg-cream-100 animate-pulse`} />
  }

  if (!photos.length) {
    return null  // foto yoksa hiçbir şey göstermeyelim
  }

  const current = photos[index] || photos[0]
  const hasMultiple = photos.length > 1

  function prev() { setIndex(i => (i - 1 + photos.length) % photos.length) }
  function next() { setIndex(i => (i + 1) % photos.length) }

  return (
    <>
      {/* Ana carousel */}
      <div className={`relative ${height} rounded-lg overflow-hidden bg-cream-100 group`}>
        <img src={current.url} alt=""
          onClick={() => setLightbox(true)}
          className="w-full h-full object-cover cursor-zoom-in" loading="lazy" />

        {/* Sol/sağ oklar */}
        {hasMultiple && (
          <>
            <button onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-ink-800 shadow flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/85 hover:bg-white text-ink-800 shadow flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {/* Alt: nokta göstergeleri + sayım */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {photos.map((_, i) => (
                <button key={i} onClick={() => setIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all
                    ${i === index ? 'bg-white w-4' : 'bg-white/60'}`} />
              ))}
            </div>
            <div className="absolute top-2 right-2 text-[10px] text-white font-medium bg-black/40 rounded-full px-2 py-0.5">
              {index + 1} / {photos.length}
            </div>
          </>
        )}
      </div>

      {/* Lightbox (büyük görüntü) */}
      {lightbox && (
        <div onClick={() => setLightbox(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out">
          <img src={current.url} alt=""
            className="max-h-full max-w-full object-contain"
            onClick={e => e.stopPropagation()} />
          {hasMultiple && (
            <>
              <button onClick={e => { e.stopPropagation(); prev() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white">
                ‹
              </button>
              <button onClick={e => { e.stopPropagation(); next() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white">
                ›
              </button>
            </>
          )}
          <button onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white text-xl">
            ×
          </button>
        </div>
      )}
    </>
  )
}
