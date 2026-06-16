import { useEffect, useRef, useState } from 'react'
import cldImg, { ImgSize } from '../lib/cldImg'

/**
 * FAZ D3 — Hover'da otomatik fotoğraf carousel.
 *
 * Boş ise (photos.length === 0): null döner — parent fallback render eder.
 * Tek fotoğraf varsa: hover yok, sadece sabit görüntü.
 * 2+ fotoğraf: hover state'inde 1.2sn aralıkla otomatik döner; mouse leave'de
 *              ilk fotoğrafa döner.
 *
 * prefers-reduced-motion: otomatik döngü kapanır, hover'da sadece 2. fotoyu
 * gösterip durur (peek).
 */
export default function HoverPhotoCarousel({ photos, alt = '' }) {
  const [idx, setIdx] = useState(0)
  const [hovering, setHovering] = useState(false)
  const intervalRef = useRef(null)
  const reducedMotion = useRef(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }
  }, [])

  useEffect(() => {
    if (!hovering || !photos || photos.length < 2) return
    if (reducedMotion.current) {
      setIdx(1)  // peek, ikinci fotoyu göster, dönmesin
      return
    }
    intervalRef.current = setInterval(() => {
      setIdx(i => (i + 1) % photos.length)
    }, 1200)
    return () => clearInterval(intervalRef.current)
  }, [hovering, photos])

  useEffect(() => {
    if (!hovering) setIdx(0)
  }, [hovering])

  if (!photos || photos.length === 0) return null

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      role="img" aria-label={alt}
    >
      {photos.map((url, i) => (
        <img
          key={url + i}
          src={cldImg(url, { w: ImgSize.card })}
          alt={i === 0 ? alt : ''}
          loading={i === 0 ? 'eager' : 'lazy'}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: i === idx ? 1 : 0 }}
        />
      ))}
      {/* alt karartma — yazıların okunabilirliği için */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.45) 100%)' }} />

      {/* Mini dot indicators (2+ foto varsa) */}
      {photos.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
          {photos.map((_, i) => (
            <span key={i}
              className="rounded-full transition-all"
              style={{
                width: i === idx ? 12 : 4,
                height: 4,
                background: i === idx ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
              }} />
          ))}
        </div>
      )}
    </div>
  )
}
