/**
 * Onay penceresi (shadcn AlertDialog uyarlaması, JS).
 *
 * UI Paket 3 — açık tema: beyaz kart (--ah-card + 1px --ah-line + --elev-3, radius 12),
 * başlık .type-card (büyük harf YOK), metin .type-body; butonlar ortak .btn-* sınıfları:
 * vazgeç .btn-secondary, onay .btn-destructive (destructive) / .btn-primary.
 * Karartma .modal-overlay ile aynı (rgba(17,24,39,.5) + 2px blur, z-index 1000).
 *
 * Erişilebilirlik: role="dialog" + aria-modal + aria-labelledby/-describedby;
 * açılışta odak güvenli butona (Vazgeç), Tab pencere içinde döner, Esc kapatır,
 * kapanınca odak açan öğeye geri döner.
 *
 * Kullanim (props API değişmedi):
 *   <ConfirmDialog open={open} onClose={() => setOpen(false)}
 *     title="Hesabını sil"
 *     description="Bu işlem geri alınamaz."
 *     confirmLabel="Evet, sil"
 *     destructive
 *     onConfirm={() => deleteAccount()} />
 */
import { useEffect, useId, useRef } from 'react'

export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  destructive = false,
  loading = false,
  onConfirm,
}) {
  const cancelRef = useRef(null)
  const panelRef = useRef(null)
  const uid = useId()
  const titleId = `confirm-title-${uid}`
  const descId = `confirm-desc-${uid}`

  // Escape ile kapat + Tab odağı pencere içinde tut
  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape' && !loading) { onClose?.(); return }
      if (e.key === 'Tab' && panelRef.current) {
        const items = [...panelRef.current.querySelectorAll('button:not([disabled])')]
        if (!items.length) return
        const first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
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

  // Açılışta odak -> Vazgeç (yıkıcı aksiyonda güvenli varsayılan); kapanınca geri ver
  useEffect(() => {
    if (!open) return
    const opener = document.activeElement
    const t = setTimeout(() => cancelRef.current?.focus(), 50)
    return () => {
      clearTimeout(t)
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="confirm-overlay fixed inset-0 grid place-items-center p-4"
      style={{
        background: 'rgba(17, 24, 39, 0.5)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        zIndex: 1000,
      }}
      onClick={() => !loading && onClose?.()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md p-5 sm:p-6 space-y-5"
        style={{
          background: 'var(--ah-card)',
          border: '1px solid var(--ah-line)',
          borderRadius: 12,
          boxShadow: 'var(--elev-3)',
        }}
      >
        <div className="flex items-start gap-3">
          {destructive && (
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                 data-testid="confirm-danger-icon"
                 style={{ background: 'var(--ah-danger-soft)', color: 'var(--ah-danger)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="type-card" style={{ color: 'var(--ah-ink)' }}>
              {title}
            </h2>
            {description && (
              <p id={descId} className="type-body mt-1.5" style={{ color: 'var(--ah-ink-2)' }}>
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={loading}
            onClick={() => onClose?.()}
            className="btn-secondary w-full sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm?.()}
            className={`${destructive ? 'btn-destructive' : 'btn-primary'} w-full sm:!w-auto`}
          >
            {loading ? 'İşleniyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
