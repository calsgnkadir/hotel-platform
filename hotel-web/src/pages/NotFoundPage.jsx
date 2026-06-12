/**
 * FAZ 3 — 404 Not Found sayfasi.
 *
 * Bilinmeyen URL'lerde gosterilir (App.jsx Routes catch-all).
 */
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream-100 p-6">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 text-5xl font-black"
             style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', color: '#7e22ce' }}>
          404
        </div>
        <h1 className="text-2xl font-bold text-ink-900 mb-2">Sayfa bulunamadı</h1>
        <p className="text-sm text-ink-500 mb-6">
          Aradığın sayfa silinmiş, taşınmış olabilir veya hiç var olmadı.
        </p>
        <Link to="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
          ← Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
