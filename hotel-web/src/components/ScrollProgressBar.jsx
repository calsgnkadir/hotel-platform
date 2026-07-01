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
          background: 'linear-gradient(90deg, #d4a853 0%, #d4a853 50%, #c8923a 100%)',
          boxShadow: '0 0 8px rgba(205, 183, 143, 0.55)',
        }}
      />
    </div>
  )
}
