import { useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'
import StarRating from './StarRating'

/**
 * FAZ 2/#26 — Multi-attribute rating (4 boyut).
 * Su an sadece aday isletmeyi puanlayabiliyor (R5 cleanup'tan beri).
 * Asagidaki 4 aspect aday tarafindan isletmeye verilir.
 */
const CANDIDATE_ASPECTS = [
  { key: 'aspect1', emoji: '🤝', label: 'Yönetim',          hint: 'İşveren tutumu, adil davranma' },
  { key: 'aspect2', emoji: '💰', label: 'Ödeme',            hint: 'Zamanında, eksiksiz' },
  { key: 'aspect3', emoji: '🌟', label: 'Çalışma Koşulları', hint: 'Mola, ekipman, güvenlik' },
  { key: 'aspect4', emoji: '👥', label: 'Ekip',             hint: 'Diğer çalışanlarla uyum' },
]

export default function ReviewModal({ applicationId, title, onClose, onSuccess }) {
  const [aspects, setAspects] = useState({ aspect1: 0, aspect2: 0, aspect3: 0, aspect4: 0 })
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  // Ortalama (gosterim icin)
  const filled = Object.values(aspects).filter(v => v > 0)
  const avg = filled.length === 4
    ? (filled.reduce((a, b) => a + b, 0) / 4).toFixed(1)
    : null

  async function handleSubmit(e) {
    e.preventDefault()
    const missing = CANDIDATE_ASPECTS.filter(a => aspects[a.key] < 1)
    if (missing.length > 0) {
      return toast.error(`Şu boyutları puanla: ${missing.map(m => m.label).join(', ')}`)
    }
    setLoading(true)
    try {
      // Backend rating'i aspect ortalamasi olarak otomatik hesaplar (4 aspect doluysa)
      await hotelApi.createReview(applicationId, null, comment.trim() || null, aspects)
      toast.success('Yorumun kaydedildi, teşekkürler!')
      onSuccess?.()
      onClose()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="p-5 border-b border-cream-200 dark:border-ink-700 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink-900 dark:text-ink-100">İşletmeyi Puanla</h2>
            {title && <p className="text-sm text-ink-500 mt-0.5 truncate">{title}</p>}
          </div>
          {avg && (
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-black text-brand-700 dark:text-brand-300">{avg}</div>
              <div className="text-[10px] uppercase tracking-widest font-semibold text-ink-500">Ortalama</div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* 4 aspect rating */}
          {CANDIDATE_ASPECTS.map(a => (
            <div key={a.key} className="card !p-3 !bg-cream-50 dark:!bg-ink-800">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink-800 dark:text-ink-200">
                    {a.emoji} {a.label}
                  </div>
                  <div className="text-[11px] text-ink-500 truncate">{a.hint}</div>
                </div>
                <span className="text-xs font-bold text-brand-700 dark:text-brand-300 flex-shrink-0">
                  {aspects[a.key] > 0 ? `${aspects[a.key]}/5` : ''}
                </span>
              </div>
              <StarRating value={aspects[a.key]}
                onChange={v => setAspects(p => ({ ...p, [a.key]: v }))}
                size="md" />
            </div>
          ))}

          <div>
            <label className="label">Yorum <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              className="input resize-none h-20 text-sm"
              placeholder="Deneyimini birkaç cümleyle anlat..." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">İptal</button>
            <button type="submit" disabled={loading || filled.length < 4}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)', boxShadow: '0 4px 16px rgba(126,34,206,0.3)' }}>
              {loading ? 'Gönderiliyor...' : `Yorumu Gönder${avg ? ` (${avg}/5)` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
