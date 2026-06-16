/**
 * FAZ 1/#56 — Bottom Sheet Modal (mobile-first).
 *
 * Mobilde modal yerine alttan kayan sheet. Modern UX (iOS native, Material 3).
 * Desktop'ta (sm:+) merkez modal'a düşer (geleneksel).
 *
 * Kullanım:
 *   <BottomSheet open={open} onClose={() => setOpen(false)} title="Başlık">
 *     <p>İçerik</p>
 *   </BottomSheet>
 *
 * Özellikler:
 *  - Backdrop tıkla → kapat
 *  - Üstte drag handle (görsel ipucu)
 *  - Slide-up animasyon (300ms)
 *  - Body scroll lock (open iken)
 *  - ESC ile kapat
 */
import { useEffect } from 'react'

export default function BottomSheet({ open, onClose, title, children, maxHeight = '85vh' }) {
  // ESC ile kapat
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Body scroll lock
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex sm:items-center items-end justify-center"
      style={{ background: 'rgba(15, 8, 35, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="card w-full sm:max-w-lg !p-0 overflow-hidden"
        style={{
          maxHeight,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          animation: 'sheet-up 0.32s cubic-bezier(0.2, 0.85, 0.3, 1)',
        }}>
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <span className="block w-10 h-1 rounded-full" style={{ background: 'rgba(212, 168, 83, 0.30)' }} />
        </div>

        {/* Header */}
        {title && (
          <div className="px-5 py-3 flex items-center justify-between"
               style={{ borderBottom: '1px solid rgba(212, 168, 83, 0.20)' }}>
            <h3 className="font-bold text-base" style={{ color: '#0c1726' }}>{title}</h3>
            <button onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-full hover:bg-purple-100 transition-colors"
              style={{ color: '#1e3a5f' }}
              aria-label="Kapat">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto p-5" style={{ maxHeight: `calc(${maxHeight} - 60px)` }}>
          {children}
        </div>
      </div>
    </div>
  )
}
