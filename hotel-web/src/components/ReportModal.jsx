import { useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'

const REASONS = [
  { value: 'FAKE',          label: 'Sahte / gerçek değil' },
  { value: 'SPAM',          label: 'Spam / tekrarlayan' },
  { value: 'SCAM',          label: 'Dolandırıcılık' },
  { value: 'INAPPROPRIATE', label: 'Uygunsuz içerik' },
  { value: 'HARASSMENT',    label: 'Taciz / kötü davranış' },
  { value: 'OTHER',         label: 'Diğer' },
]

/**
 * Genel şikayet modal'ı.
 * @param {string} targetType - 'LISTING' | 'BUSINESS' | 'USER'
 * @param {number} targetId
 * @param {string} targetLabel - başlıkta gösterilecek isim (örn. ilan başlığı)
 * @param {function} onClose
 */
export default function ReportModal({ targetType, targetId, targetLabel, onClose }) {
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
      toast.success('Şikayetiniz alındı. İnceleyeceğiz, teşekkürler.')
      onClose()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">⚠ Bildir</h2>
          {targetLabel && (
            <p className="text-sm text-slate-500 mt-0.5 truncate">{targetLabel}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Neden *</label>
            <div className="space-y-2">
              {REASONS.map(r => (
                <label key={r.value}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all
                    ${reason === r.value ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-red-300'}`}>
                  <input type="radio" name="reason" value={r.value}
                    checked={reason === r.value}
                    onChange={() => setReason(r.value)}
                    className="w-4 h-4 accent-red-600" />
                  <span className="text-sm text-slate-700">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="label">
              Açıklama
              {reason === 'OTHER'
                ? <span className="text-red-500"> *</span>
                : <span className="text-slate-400 font-normal"> (opsiyonel)</span>}
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="input resize-none h-24 text-sm"
              placeholder="Detay verirsen incelememiz kolaylaşır..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">İptal</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 bg-red-600 hover:bg-red-700">
              {loading ? 'Gönderiliyor...' : 'Şikayeti Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
