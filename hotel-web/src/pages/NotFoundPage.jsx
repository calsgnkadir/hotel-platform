/**
 * FAZ 3 — 404 Not Found sayfasi.
 *
 * Bilinmeyen URL'lerde gosterilir (App.jsx Routes catch-all).
 */
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white relative z-10">
      <div className="text-center max-w-md">
        <div className="font-syne tabular-nums inline-flex items-center justify-center w-28 h-28 rounded-full mb-7 text-5xl font-semibold"
             style={{
               background: 'rgba(205, 183, 143, 0.08)',
               border: '1px solid rgba(205, 183, 143, 0.22)',
               color: '#cdb78f',
               letterSpacing: '-0.03em',
               filter: 'drop-shadow(0 0 18px rgba(205, 183, 143, 0.25))',
             }}>
          404
        </div>
        <h1 className="font-syne text-2xl font-semibold mb-2" style={{ color: '#f5efe2', letterSpacing: '-0.02em' }}>Sayfa bulunamadı</h1>
        <p className="text-[13px] mb-7" style={{ color: '#928678' }}>
          Aradığın sayfa silinmiş, taşınmış olabilir veya hiç var olmadı.
        </p>
        <Link to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-[13px] font-semibold uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
            color: '#1a1208',
            boxShadow: '0 12px 28px rgba(205, 183, 143, 0.25), inset 0 1px 0 rgba(255,255,255,0.22)',
          }}>
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
