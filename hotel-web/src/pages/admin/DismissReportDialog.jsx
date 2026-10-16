import { useEffect, useId, useRef, useState } from 'react'
import useFocusTrap from '../../lib/useFocusTrap'

/**
 * Şikâyeti reddetme penceresi — tarayıcı prompt() yerine.
 *
 * ConfirmDialog ile aynı görünüm (beyaz kart, .type-card başlık, .btn-*), ek olarak
 * isteğe bağlı "Admin notu" alanı. Esc / karartmaya tıklama / Vazgeç → onCancel.
 * Onay → onConfirm(note) (boş not null olarak gider).
 */
export default function DismissReportDialog({ open, report, busy = false, onCancel, onConfirm }) {
  const panelRef = useRef(null)
  const uid = useId()
  const [note, setNote] = useState('')

  useEffect(() => { if (open) setNote('') }, [open])
  useFocusTrap(panelRef, open, busy ? undefined : onCancel)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  const titleId = `dismiss-title-${uid}`
  const descId = `dismiss-desc-${uid}`
  const noteId = `dismiss-note-${uid}`

  function submit(e) {
    e.preventDefault()
    if (busy) return
    const trimmed = note.trim()
    onConfirm?.(trimmed ? trimmed : null)
  }

  return (
    <div
      className="fixed inset-0 grid place-items-center p-4"
      style={{ background: 'rgba(17, 24, 39, 0.5)', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)', zIndex: 1000 }}
      onClick={() => !busy && onCancel?.()}
    >
      <form
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md p-5 sm:p-6 space-y-4"
        style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line)', borderRadius: 12, boxShadow: 'var(--elev-3)' }}
      >
        <div>
          <h2 id={titleId} className="type-card">Şikâyeti reddet</h2>
          <p id={descId} className="type-body mt-1.5" style={{ color: 'var(--ah-ink-2)' }}>
            {report?.targetLabel
              ? `${report.targetLabel} hakkındaki şikâyet geçersiz sayılacak.`
              : 'Bu şikâyet geçersiz sayılacak.'}
          </p>
        </div>

        <div>
          <label htmlFor={noteId} className="label">Admin notu (isteğe bağlı)</label>
          <textarea
            id={noteId}
            className="input"
            rows={3}
            maxLength={500}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Örn. İlan kurallara uygun, şikâyet asılsız."
          />
          <p className="type-caption mt-1">Not şikâyet kaydında saklanır ve listede görünür.</p>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" className="btn-secondary w-full sm:w-auto" disabled={busy} onClick={() => onCancel?.()}>
            Vazgeç
          </button>
          <button type="submit" className="btn-primary sm:!w-auto" disabled={busy}>
            {busy ? 'İşleniyor…' : 'Şikâyeti reddet'}
          </button>
        </div>
      </form>
    </div>
  )
}
