/**
 * shadcn/ui AlertDialog proje uyarlamasi
 * - Radix UI yerine: native HTML <dialog> uzerine compose + Escape/backdrop kapatma
 * - TypeScript yerine JS
 * - Esc, backdrop click ile kapatma
 * - Confirm/Cancel butonlari ile destructive akış (hesap sil vs.)
 *
 * Kullanim:
 *   const [open, setOpen] = useState(false)
 *   <ConfirmDialog open={open} onClose={() => setOpen(false)}
 *     title="Hesabini sil"
 *     description="Bu islem geri alinamaz. Tum verileriniz anonimlestirilecek."
 *     confirmLabel="Evet, sil"
 *     destructive
 *     onConfirm={() => deleteAccount()} />
 */
import { useEffect, useRef } from 'react'

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgec',
  destructive = false,
  loading = false,
  onConfirm,
}) {
  const ref = useRef(null)

  // Escape ile kapat
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && open && !loading) onClose?.()
    }
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, loading, onClose])

  // Body scroll lock
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  // Initial focus -> cancel butonu (destructive icin guvenli default)
  useEffect(() => {
    if (open && ref.current) {
      setTimeout(() => ref.current?.focus(), 50)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(4px)' }}
      onClick={() => !loading && onClose?.()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border p-6 space-y-4"
        style={{
          background: 'linear-gradient(145deg, rgba(21, 36, 61, 0.98) 0%, rgba(15, 23, 38, 1) 100%)',
          borderColor: destructive ? 'rgba(239, 68, 68, 0.35)' : 'rgba(212, 168, 83, 0.30)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{
                   background: 'rgba(239, 68, 68, 0.12)',
                   border: '1px solid rgba(239, 68, 68, 0.35)',
                 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fca5a5"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title"
                className="font-bebas text-xl tracking-wider uppercase"
                style={{ color: destructive ? '#fca5a5' : '#fde9a5' }}>
              {title}
            </h2>
            {description && (
              <p className="text-[13px] mt-1.5 leading-relaxed"
                 style={{ color: 'rgba(229, 231, 235, 0.75)' }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            ref={ref}
            type="button"
            disabled={loading}
            onClick={() => onClose?.()}
            className="px-4 py-2 text-[13px] font-semibold rounded-lg transition-all disabled:opacity-50 hover:-translate-y-0.5"
            style={{
              background: 'rgba(21, 36, 61, 0.55)',
              color: 'rgba(229, 231, 235, 0.85)',
              border: '1px solid rgba(212, 168, 83, 0.20)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm?.()}
            className="px-4 py-2 text-[13px] font-bold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
            style={{
              background: destructive
                ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                : 'linear-gradient(135deg, #1e3a5f 0%, #234a82 100%)',
              boxShadow: destructive
                ? '0 4px 16px rgba(220, 38, 38, 0.40)'
                : '0 4px 16px rgba(35, 74, 130, 0.40)',
            }}
          >
            {loading ? 'İşleniyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
