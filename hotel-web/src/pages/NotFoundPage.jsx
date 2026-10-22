/**
 * FAZ 3 — 404 Not Found sayfasi.
 *
 * Bilinmeyen URL'lerde gosterilir (App.jsx Routes catch-all).
 */
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative z-10">
      <div className="text-center max-w-md">
        <div className="tabular-nums inline-flex items-center justify-center w-28 h-28 rounded-full mb-7 text-5xl font-semibold"
             aria-hidden="true"
             style={{
               background: 'var(--ah-brand-soft)',
               border: '1px solid var(--ah-line-2)',
               color: 'var(--ah-ink)',
               letterSpacing: '-0.03em',
             }}>
          404
        </div>
        <h1 className="text-2xl font-semibold mb-2" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.02em' }}>Sayfa bulunamadı</h1>
        <p className="type-body mb-7" style={{ color: 'var(--ah-ink-3)' }}>
          Aradığın sayfa silinmiş, taşınmış olabilir veya hiç var olmadı.
        </p>
        <Link to="/" className="btn-primary !w-auto">
          Ana sayfaya dön
        </Link>
      </div>
    </div>
  )
}
