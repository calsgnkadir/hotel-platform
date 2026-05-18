import { useState, useEffect, useMemo } from 'react'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'

/* ── Apply Modal ── */
function ApplyModal({ hotel, onClose, onSuccess }) {
  const [coverLetter, setCoverLetter] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!coverLetter.trim()) return toast.error('Ön yazı zorunlu')
    setLoading(true)
    try {
      await hotelApi.applyToHotel({ hotelId: hotel.id, coverLetter, availabilities: [] })
      toast.success('Başvurunuz gönderildi! 🎉')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              🏨
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Başvuru Yap</h2>
              <p className="text-sm text-slate-500">{hotel.hotelName}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Ön Yazı</label>
            <textarea
              value={coverLetter}
              onChange={e => setCoverLetter(e.target.value)}
              className="input resize-none h-36 text-sm leading-relaxed"
              placeholder="Kendinizi kısaca tanıtın, neden bu otelde çalışmak istediğinizi anlatın..."
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-1">{coverLetter.length} karakter</p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 text-sm">
              İptal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.35)' }}>
              {loading ? 'Gönderiliyor...' : 'Gönder →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Hotel Card ── */
function HotelCard({ hotel, onApply }) {
  return (
    <div className="card hover:border-violet-200 hover:-translate-y-1 transition-all duration-200 group">
      <div className="p-5 flex flex-col h-full">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl mb-4 shadow-sm transition-transform duration-200 group-hover:scale-105"
             style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
          🏨
        </div>

        {/* Info */}
        <h3 className="font-bold text-slate-800 text-base leading-snug">{hotel.hotelName}</h3>

        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-slate-500">
          <span>📍</span>
          <span className="truncate">{hotel.location || 'Konum belirtilmemiş'}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
          <span>✉️</span>
          <span className="truncate">{hotel.email}</span>
        </div>

        {/* Spacer so button always sits at bottom */}
        <div className="flex-1" />

        <button
          onClick={() => onApply(hotel)}
          className="mt-4 w-full py-2 px-4 text-sm font-semibold text-white rounded-lg
                     transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.3)' }}>
          Başvur
        </button>
      </div>
    </div>
  )
}

/* ── Hotels Page ── */
export default function HotelsPage({ onApplicationSubmitted }) {
  const [hotels, setHotels] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [applyTarget, setApplyTarget] = useState(null)

  useEffect(() => {
    hotelApi.getHotelList()
      .then(setHotels)
      .catch(() => toast.error('Otel listesi yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() =>
    hotels.filter(h => {
      const q = search.toLowerCase()
      return (
        h.hotelName.toLowerCase().includes(q) ||
        (h.location || '').toLowerCase().includes(q)
      )
    }),
    [hotels, search]
  )

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="spinner" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Oteller</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {hotels.length} otel kayıtlı
            {search && filtered.length !== hotels.length && ` · ${filtered.length} sonuç`}
          </p>
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Otel adı veya konum ara..."
            className="input pl-9 text-sm"
          />
        </div>
      </div>

      {/* Empty — no hotels at all */}
      {hotels.length === 0 && (
        <div className="card">
          <div className="empty-state py-16">
            <span className="text-5xl mb-4">🏨</span>
            <p className="font-medium text-slate-700">Henüz kayıtlı otel yok</p>
            <p className="text-sm text-slate-500 mt-1">Daha sonra tekrar kontrol edin</p>
          </div>
        </div>
      )}

      {/* Empty — search returned nothing */}
      {hotels.length > 0 && filtered.length === 0 && (
        <div className="card">
          <div className="empty-state py-16">
            <span className="text-5xl mb-4">🔎</span>
            <p className="font-medium text-slate-700">Sonuç bulunamadı</p>
            <p className="text-sm text-slate-500 mt-1">Farklı bir arama deneyin</p>
            <button
              onClick={() => setSearch('')}
              className="mt-4 text-sm font-medium text-violet-600 hover:text-violet-700">
              Aramayı temizle
            </button>
          </div>
        </div>
      )}

      {/* Hotel Grid */}
      {filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(hotel => (
            <HotelCard key={hotel.id} hotel={hotel} onApply={setApplyTarget} />
          ))}
        </div>
      )}

      {/* Apply Modal */}
      {applyTarget && (
        <ApplyModal
          hotel={applyTarget}
          onClose={() => setApplyTarget(null)}
          onSuccess={() => onApplicationSubmitted?.()}
        />
      )}
    </div>
  )
}
