import { useState, useRef, useId } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'
import useFocusTrap from '../lib/useFocusTrap'

const REASONS = [
  { value: 'FAKE',          label: 'Sahte / gerçek değil' },
  { value: 'SPAM',          label: 'Spam / tekrarlayan' },
  { value: 'SCAM',          label: 'Dolandırıcılık' },
  { value: 'INAPPROPRIATE', label: 'Uygunsuz içerik' },
  { value: 'HARASSMENT',    label: 'Taciz / kötü davranış' },
  { value: 'OTHER',         label: 'Diğer' },
]

/**
 * Genel şikâyet modal'ı.
 * @param {string} targetType - 'LISTING' | 'BUSINESS' | 'USER'
 * @param {number} targetId
 * @param {string} targetLabel - başlıkta gösterilecek isim (örn. ilan başlığı)
 * @param {function} onClose
 */
export default function ReportModal({ targetType, targetId, targetLabel, onClose }) {
  const uid = useId()
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason) return toast.error('Lütfen bir neden seçin')
    if (reason === 'OTHER' && !description.trim()) {
      return toast.error("'Diğer' seçtiğinizde açıklama zorunlu")
    }

    setLoading(true)
    try {
      await hotelApi.createReport({
        targetType,
        targetId,
        reason,
        description: description.trim() || null,
      })
      toast.success('Şikâyetiniz alındı. İnceleyeceğiz, teşekkürler.')
      onClose()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, true, onClose)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef}
           role="dialog"
           aria-modal="true"
           aria-labelledby="report-modal-title"
           className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="p-6 border-b border-cream-200">
          <h2 id="report-modal-title" className="type-card">Bildir</h2>
          {targetLabel && (
            <p className="text-sm text-ink-500 mt-0.5 truncate">{targetLabel}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <fieldset>
            <legend id={`${uid}-reason`} className="label">Neden *</legend>
            <div className="space-y-2" role="radiogroup" aria-labelledby={`${uid}-reason`}>
              {REASONS.map(r => (
                <label key={r.value}
                  className={`flex items-center gap-2.5 px-3 min-h-[44px] rounded-lg border cursor-pointer transition-all
                    ${reason === r.value ? 'border-red-400 bg-red-50' : 'border-cream-300 hover:border-red-300'}`}>
                  <input type="radio" name="reason" value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="w-4 h-4 accent-red-600" />
                  <span className="text-sm text-ink-700">{r.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor={`${uid}-desc`} className="label">
              Açıklama
              {reason === 'OTHER'
                ? <span className="text-red-500"> *</span>
                : <span className="text-ink-400 font-normal"> (isteğe bağlı)</span>}
            </label>
            <textarea id={`${uid}-desc`} value={description} onChange={e => setDescription(e.target.value)}
              className="input resize-none h-24 text-sm"
              placeholder="Detay verirsen incelememiz kolaylaşır..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Vazgeç</button>
            <button type="submit" disabled={loading}
              className="btn-destructive flex-1">
              {loading ? 'Gönderiliyor…' : 'Bildirimi gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
