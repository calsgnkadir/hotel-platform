/**
 * FAZ 1/#43 — Empty State Illustrations
 *
 * Boş liste durumlarında gösterilecek özenli görsel + CTA.
 * Kullanım:
 *   <EmptyState type="applications" title="..." description="..." ctaLabel="..." onCta={...} />
 *
 * Type seçenekleri: applications, listings, messages, workers, history, generic
 */

const ILLUSTRATIONS = {
  // 📋 Başvurular — kâğıt + uçak (uçan başvuru fikri)
  applications: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-app-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      {/* Arka plan daireler */}
      <circle cx="35" cy="35" r="6" fill="#d8b4fe" opacity="0.3" />
      <circle cx="170" cy="50" r="4" fill="#a855f7" opacity="0.4" />
      <circle cx="160" cy="130" r="5" fill="#d8b4fe" opacity="0.3" />
      {/* Kağıt */}
      <rect x="40" y="40" width="80" height="100" rx="6" fill="#fff" stroke="url(#emp-app-grad)" strokeWidth="3" />
      <line x1="55" y1="60" x2="105" y2="60" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
      <line x1="55" y1="75" x2="100" y2="75" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
      <line x1="55" y1="90" x2="105" y2="90" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
      <line x1="55" y1="105" x2="90" y2="105" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
      {/* Uçak */}
      <path d="M 130 70 L 170 50 L 165 65 L 145 75 Z M 165 65 L 175 80 L 160 80 Z"
            fill="url(#emp-app-grad)" stroke="#7e22ce" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 145 78 L 130 95 L 138 88" stroke="#d8b4fe" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" fill="none" />
    </svg>
  ),

  // 🔍 İlanlar — mercek + işletme
  listings: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-list-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      <circle cx="35" cy="30" r="5" fill="#d8b4fe" opacity="0.4" />
      <circle cx="175" cy="40" r="4" fill="#a855f7" opacity="0.3" />
      {/* Mercek */}
      <circle cx="90" cy="75" r="40" fill="#fff" stroke="url(#emp-list-grad)" strokeWidth="4" />
      <circle cx="90" cy="75" r="32" fill="none" stroke="#d8b4fe" strokeWidth="1" />
      <line x1="120" y1="105" x2="150" y2="135" stroke="url(#emp-list-grad)" strokeWidth="6" strokeLinecap="round" />
      {/* İçinde bina */}
      <rect x="75" y="65" width="30" height="25" fill="url(#emp-list-grad)" opacity="0.8" rx="2" />
      <rect x="80" y="72" width="4" height="4" fill="#fff" />
      <rect x="89" y="72" width="4" height="4" fill="#fff" />
      <rect x="98" y="72" width="4" height="4" fill="#fff" />
      <rect x="86" y="82" width="8" height="8" fill="#fff" />
    </svg>
  ),

  // 💬 Mesajlar — konuşma balonları
  messages: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-msg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="40" r="5" fill="#d8b4fe" opacity="0.3" />
      <circle cx="175" cy="120" r="6" fill="#a855f7" opacity="0.3" />
      {/* Sol balon */}
      <path d="M 30 40 Q 30 25 45 25 L 95 25 Q 110 25 110 40 L 110 65 Q 110 80 95 80 L 60 80 L 45 95 L 50 80 Q 30 80 30 65 Z"
            fill="#fff" stroke="url(#emp-msg-grad)" strokeWidth="3" />
      <circle cx="55" cy="52" r="3" fill="#a855f7" />
      <circle cx="70" cy="52" r="3" fill="#a855f7" />
      <circle cx="85" cy="52" r="3" fill="#a855f7" />
      {/* Sağ balon */}
      <path d="M 100 90 Q 100 75 115 75 L 165 75 Q 180 75 180 90 L 180 115 Q 180 130 165 130 L 155 130 L 145 145 L 150 130 Q 100 130 100 115 Z"
            fill="url(#emp-msg-grad)" />
      <circle cx="125" cy="102" r="3" fill="#fff" />
      <circle cx="140" cy="102" r="3" fill="#fff" />
      <circle cx="155" cy="102" r="3" fill="#fff" />
    </svg>
  ),

  // 👥 Çalışanlar — adam silueti grubu
  workers: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-work-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="5" fill="#d8b4fe" opacity="0.3" />
      <circle cx="170" cy="30" r="4" fill="#a855f7" opacity="0.4" />
      {/* Sol adam */}
      <circle cx="65" cy="60" r="18" fill="url(#emp-work-grad)" opacity="0.7" />
      <path d="M 35 130 Q 35 95 65 95 Q 95 95 95 130 Z" fill="url(#emp-work-grad)" opacity="0.7" />
      {/* Sağ adam */}
      <circle cx="135" cy="60" r="18" fill="url(#emp-work-grad)" />
      <path d="M 105 130 Q 105 95 135 95 Q 165 95 165 130 Z" fill="url(#emp-work-grad)" />
      {/* Orta + işareti */}
      <circle cx="100" cy="75" r="14" fill="#fff" stroke="#a855f7" strokeWidth="2" />
      <line x1="100" y1="68" x2="100" y2="82" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
      <line x1="93" y1="75" x2="107" y2="75" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),

  // ⏳ Geçmiş — saat
  history: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-hist-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="5" fill="#d8b4fe" opacity="0.3" />
      <circle cx="170" cy="120" r="6" fill="#a855f7" opacity="0.3" />
      {/* Saat */}
      <circle cx="100" cy="80" r="50" fill="#fff" stroke="url(#emp-hist-grad)" strokeWidth="4" />
      <circle cx="100" cy="80" r="3" fill="#7e22ce" />
      {/* Saat tikleri */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
        const rad = (angle - 90) * Math.PI / 180
        const x1 = 100 + 42 * Math.cos(rad)
        const y1 = 80 + 42 * Math.sin(rad)
        const x2 = 100 + 46 * Math.cos(rad)
        const y2 = 80 + 46 * Math.sin(rad)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c4b5fd" strokeWidth={i % 3 === 0 ? 3 : 1.5} strokeLinecap="round" />
      })}
      {/* Akrep + yelkovan */}
      <line x1="100" y1="80" x2="100" y2="50" stroke="#7e22ce" strokeWidth="3" strokeLinecap="round" />
      <line x1="100" y1="80" x2="125" y2="80" stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),

  // 📦 Generic — boş kutu
  generic: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-gen-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
      </defs>
      <circle cx="35" cy="50" r="5" fill="#d8b4fe" opacity="0.3" />
      <circle cx="170" cy="120" r="6" fill="#a855f7" opacity="0.3" />
      {/* Kutu (3D) */}
      <path d="M 70 60 L 130 60 L 145 75 L 145 130 L 70 130 Z" fill="#fff" stroke="url(#emp-gen-grad)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 130 60 L 130 75 L 145 75" fill="none" stroke="url(#emp-gen-grad)" strokeWidth="3" strokeLinejoin="round" />
      <line x1="70" y1="75" x2="130" y2="75" stroke="url(#emp-gen-grad)" strokeWidth="2" />
      {/* İç boş efekti */}
      <text x="107" y="105" textAnchor="middle" fontSize="32" fill="#c4b5fd" fontWeight="bold" opacity="0.5">?</text>
    </svg>
  ),
}

export default function EmptyState({
  type = 'generic',
  title,
  description,
  ctaLabel,
  onCta,
  ctaSecondaryLabel,
  onCtaSecondary,
  compact = false,
}) {
  const illustration = ILLUSTRATIONS[type] || ILLUSTRATIONS.generic

  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-8' : 'py-12'}`}>
      <div className="mb-4">{illustration}</div>
      {title && (
        <h3 className="font-bold text-lg mb-1" style={{ color: '#faf5ff' }}>
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm max-w-md mb-5" style={{ color: '#d8b4fe' }}>
          {description}
        </p>
      )}
      {(ctaLabel || ctaSecondaryLabel) && (
        <div className="flex flex-wrap gap-2 justify-center">
          {ctaLabel && (
            <button onClick={onCta}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)', boxShadow: '0 4px 16px rgba(168,85,247,0.40)' }}>
              {ctaLabel}
            </button>
          )}
          {ctaSecondaryLabel && (
            <button onClick={onCtaSecondary}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(216,180,254,0.30)' }}>
              {ctaSecondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
