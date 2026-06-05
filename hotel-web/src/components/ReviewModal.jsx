import { useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'
import StarRating from './StarRating'

/**
 * Bir kabul edilmiş başvuru için yorum modal'ı.
 * @param {number} applicationId
 * @param {string} title - başlıkta gösterilecek (örn. "Test Otel" veya "Ali Veli")
 * @param {function} onClose
 * @param {function} onSuccess - yorum oluşunca çağrılır (parent listeyi yenilesin)
 */
export default function ReviewModal({ applicationId, title, onClose, onSuccess }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (rating < 1 || rating > 5) return toast.error('1-5 arasında puan ver')
    setLoading(true)
    try {
      await hotelApi.createReview(applicationId, rating, comment.trim() || null)
      toast.success('Yorumun kaydedildi, teşekkürler!')
      onSuccess?.()
      onClose()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setLoading(false) }
  }

  const labels = ['', 'Çok kötü', 'Kötü', 'Orta', 'İyi', 'Mükemmel']

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">⭐ Puanla</h2>
          {title && <p className="text-sm text-slate-500 mt-0.5 truncate">{title}</p>}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center py-2">
            <StarRating value={rating} onChange={setRating} size="lg" />
            <p className="text-sm text-slate-500 mt-2 h-5">{labels[rating] || 'Yıldıza tıkla'}</p>
          </div>

          <div>
            <label className="label">Yorum <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              className="input resize-none h-24 text-sm"
              placeholder="Deneyimini birkaç cümleyle anlat..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">İptal</button>
            <button type="submit" disabled={loading || rating < 1}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60"
              style={{ background: '#047857', boxShadow: '0 3px 12px rgba(4,120,87,0.3)' }}>
              {loading ? 'Gönderiliyor...' : 'Yorumu Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
