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
          background: 'linear-gradient(145deg, rgba(19, 17, 15, 0.94) 0%, rgba(13, 11, 9, 1) 100%)',
          borderColor: destructive ? 'rgba(180, 106, 85, 0.30)' : 'rgba(205, 183, 143, 0.22)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{
                   background: 'rgba(180, 106, 85, 0.12)',
                   border: '1px solid rgba(180, 106, 85, 0.30)',
                 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d39481"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title"
                className="text-xl tracking-wider uppercase"
                style={{ color: destructive ? '#d39481' : '#cdb78f' }}>
              {title}
            </h2>
            {description && (
              <p className="text-[13px] mt-1.5 leading-relaxed"
                 style={{ color: '#c9bdaa' }}>
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
            className="px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] rounded-full transition-all disabled:opacity-50 hover:-translate-y-0.5"
            style={{
              background: 'transparent',
              color: '#c9bdaa',
              border: '1px solid rgba(205, 183, 143, 0.14)',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm?.()}
            className="px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] rounded-full transition-all disabled:opacity-60 hover:-translate-y-0.5"
            style={
              destructive
                ? {
                    background: 'linear-gradient(135deg, #b46a55 0%, #8f4e3d 100%)',
                    color: '#ffffff',
                    border: '1px solid rgba(180, 106, 85, 0.55)',
                    boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
                  }
                : {
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    color: '#1a1208',
                    border: '1px solid rgba(212, 168, 83, 0.55)',
                    boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
                  }
            }
          >
            {loading ? 'İşleniyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
