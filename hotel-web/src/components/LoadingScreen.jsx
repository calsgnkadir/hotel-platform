/**
 * FAZ 3 — Tutarli full-page loading screen.
 *
 * ProtectedRoute, Suspense fallback, ilk auth check gibi yerlerde
 * "Yukleniyor..." text yerine markali spinner gosterir.
 */
export default function LoadingScreen({ label = 'Yükleniyor...' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-cream-100">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-cream-300" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent animate-spin"
             style={{ borderTopColor: '#234a82' }} />
      </div>
      <p className="text-xs uppercase tracking-widest font-semibold text-ink-500">{label}</p>
    </div>
  )
}
