import { useEffect, useState } from 'react'

/**
 * FAZ 5.11 — Sayfa scroll yuzdesi (en ust ince bar, mor gradient).
 * Sayfanin scroll yuksekligine gore 0-100 arasi width animasyon eder.
 */
export default function ScrollProgressBar() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    function handle() {
      const doc = document.documentElement
      const max = (doc.scrollHeight - doc.clientHeight) || 1
      const pct = Math.max(0, Math.min(100, (window.scrollY / max) * 100))
      setProgress(pct)
    }
    handle()
    window.addEventListener('scroll', handle, { passive: true })
    window.addEventListener('resize', handle)
    return () => {
      window.removeEventListener('scroll', handle)
      window.removeEventListener('resize', handle)
    }
  }, [])

  if (progress <= 0) return null

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 h-[2px] z-[60] pointer-events-none"
    >
      <div
        className="h-full transition-all duration-150 ease-out"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #a855f7 0%, #d946ef 50%, #fbbf24 100%)',
          boxShadow: '0 0 8px rgba(168, 85, 247, 0.65)',
        }}
      />
    </div>
  )
}
