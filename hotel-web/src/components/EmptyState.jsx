/**
 * FAZ 1/#43 — Empty State Illustrations
 *
 * Boş liste durumlarında gösterilecek özenli görsel + CTA.
 * Kullanım:
 *   <EmptyState type="applications" title="..." description="..." ctaLabel="..." onCta={...} />
 *
 * Type seçenekleri: applications, listings, messages, workers, history,
 *                   favorites, search, notifications, generic
 *
 * FAZ 3/Empty-state — yeni tipler (favorites, search, notifications) +
 * light/dark tema uyumlu typography (eski hardcoded acik renk light'ta gorunmuyordu).
 */

const ILLUSTRATIONS = {
  // Başvurular — kâğıt + uçak (uçan başvuru fikri)
  applications: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-app-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      {/* Arka plan daireler */}
      <circle cx="35" cy="35" r="6" fill="#cdb78f" opacity="0.3" />
      <circle cx="170" cy="50" r="4" fill="#d4a853" opacity="0.4" />
      <circle cx="160" cy="130" r="5" fill="#cdb78f" opacity="0.3" />
      {/* Kağıt */}
      <rect x="40" y="40" width="80" height="100" rx="6" fill="#fff" stroke="url(#emp-app-grad)" strokeWidth="3" />
      <line x1="55" y1="60" x2="105" y2="60" stroke="#cdb78f" strokeWidth="2" strokeLinecap="round" />
      <line x1="55" y1="75" x2="100" y2="75" stroke="#cdb78f" strokeWidth="2" strokeLinecap="round" />
      <line x1="55" y1="90" x2="105" y2="90" stroke="#cdb78f" strokeWidth="2" strokeLinecap="round" />
      <line x1="55" y1="105" x2="90" y2="105" stroke="#cdb78f" strokeWidth="2" strokeLinecap="round" />
      {/* Uçak */}
      <path d="M 130 70 L 170 50 L 165 65 L 145 75 Z M 165 65 L 175 80 L 160 80 Z"
            fill="url(#emp-app-grad)" stroke="#8a7349" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M 145 78 L 130 95 L 138 88" stroke="#cdb78f" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" fill="none" />
    </svg>
  ),

  // İlanlar — mercek + işletme
  listings: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-list-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="35" cy="30" r="5" fill="#cdb78f" opacity="0.4" />
      <circle cx="175" cy="40" r="4" fill="#d4a853" opacity="0.3" />
      {/* Mercek */}
      <circle cx="90" cy="75" r="40" fill="#fff" stroke="url(#emp-list-grad)" strokeWidth="4" />
      <circle cx="90" cy="75" r="32" fill="none" stroke="#cdb78f" strokeWidth="1" />
      <line x1="120" y1="105" x2="150" y2="135" stroke="url(#emp-list-grad)" strokeWidth="6" strokeLinecap="round" />
      {/* İçinde bina */}
      <rect x="75" y="65" width="30" height="25" fill="url(#emp-list-grad)" opacity="0.8" rx="2" />
      <rect x="80" y="72" width="4" height="4" fill="#fff" />
      <rect x="89" y="72" width="4" height="4" fill="#fff" />
      <rect x="98" y="72" width="4" height="4" fill="#fff" />
      <rect x="86" y="82" width="8" height="8" fill="#fff" />
    </svg>
  ),

  // Mesajlar — konuşma balonları
  messages: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-msg-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="40" r="5" fill="#cdb78f" opacity="0.3" />
      <circle cx="175" cy="120" r="6" fill="#d4a853" opacity="0.3" />
      {/* Sol balon */}
      <path d="M 30 40 Q 30 25 45 25 L 95 25 Q 110 25 110 40 L 110 65 Q 110 80 95 80 L 60 80 L 45 95 L 50 80 Q 30 80 30 65 Z"
            fill="#fff" stroke="url(#emp-msg-grad)" strokeWidth="3" />
      <circle cx="55" cy="52" r="3" fill="#d4a853" />
      <circle cx="70" cy="52" r="3" fill="#d4a853" />
      <circle cx="85" cy="52" r="3" fill="#d4a853" />
      {/* Sağ balon */}
      <path d="M 100 90 Q 100 75 115 75 L 165 75 Q 180 75 180 90 L 180 115 Q 180 130 165 130 L 155 130 L 145 145 L 150 130 Q 100 130 100 115 Z"
            fill="url(#emp-msg-grad)" />
      <circle cx="125" cy="102" r="3" fill="#fff" />
      <circle cx="140" cy="102" r="3" fill="#fff" />
      <circle cx="155" cy="102" r="3" fill="#fff" />
    </svg>
  ),

  // Çalışanlar — adam silueti grubu
  workers: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-work-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="5" fill="#cdb78f" opacity="0.3" />
      <circle cx="170" cy="30" r="4" fill="#d4a853" opacity="0.4" />
      {/* Sol adam */}
      <circle cx="65" cy="60" r="18" fill="url(#emp-work-grad)" opacity="0.7" />
      <path d="M 35 130 Q 35 95 65 95 Q 95 95 95 130 Z" fill="url(#emp-work-grad)" opacity="0.7" />
      {/* Sağ adam */}
      <circle cx="135" cy="60" r="18" fill="url(#emp-work-grad)" />
      <path d="M 105 130 Q 105 95 135 95 Q 165 95 165 130 Z" fill="url(#emp-work-grad)" />
      {/* Orta + işareti */}
      <circle cx="100" cy="75" r="14" fill="#fff" stroke="#d4a853" strokeWidth="2" />
      <line x1="100" y1="68" x2="100" y2="82" stroke="#d4a853" strokeWidth="3" strokeLinecap="round" />
      <line x1="93" y1="75" x2="107" y2="75" stroke="#d4a853" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),

  // Geçmiş — saat
  history: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-hist-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="30" cy="30" r="5" fill="#cdb78f" opacity="0.3" />
      <circle cx="170" cy="120" r="6" fill="#d4a853" opacity="0.3" />
      {/* Saat */}
      <circle cx="100" cy="80" r="50" fill="#fff" stroke="url(#emp-hist-grad)" strokeWidth="4" />
      <circle cx="100" cy="80" r="3" fill="#8a7349" />
      {/* Saat tikleri */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
        const rad = (angle - 90) * Math.PI / 180
        const x1 = 100 + 42 * Math.cos(rad)
        const y1 = 80 + 42 * Math.sin(rad)
        const x2 = 100 + 46 * Math.cos(rad)
        const y2 = 80 + 46 * Math.sin(rad)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cdb78f" strokeWidth={i % 3 === 0 ? 3 : 1.5} strokeLinecap="round" />
      })}
      {/* Akrep + yelkovan */}
      <line x1="100" y1="80" x2="100" y2="50" stroke="#8a7349" strokeWidth="3" strokeLinecap="round" />
      <line x1="100" y1="80" x2="125" y2="80" stroke="#d4a853" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),

  // Favoriler — kalp + yıldız parıltıları
  favorites: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-fav-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="35" cy="40" r="5" fill="#cdb78f" opacity="0.3" />
      <circle cx="170" cy="120" r="6" fill="#d4a853" opacity="0.3" />
      {/* Kalp */}
      <path d="M 100 130 C 60 100 50 75 60 60 C 70 45 90 50 100 70 C 110 50 130 45 140 60 C 150 75 140 100 100 130 Z"
            fill="url(#emp-fav-grad)" stroke="#8a7349" strokeWidth="2" strokeLinejoin="round" />
      {/* Yıldız parıltıları */}
      <path d="M 50 30 L 53 38 L 61 38 L 55 43 L 57 51 L 50 46 L 43 51 L 45 43 L 39 38 L 47 38 Z"
            fill="#c8923a" />
      <path d="M 160 45 L 162 51 L 168 51 L 163 55 L 165 61 L 160 57 L 155 61 L 157 55 L 152 51 L 158 51 Z"
            fill="#c8923a" opacity="0.8" />
      <circle cx="155" cy="90" r="3" fill="#c8923a" opacity="0.7" />
      <circle cx="40" cy="105" r="3" fill="#c8923a" opacity="0.7" />
    </svg>
  ),

  // Search — filtre sonucu yok
  search: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-srch-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="35" cy="30" r="5" fill="#cdb78f" opacity="0.4" />
      <circle cx="175" cy="40" r="4" fill="#d4a853" opacity="0.3" />
      {/* Mercek */}
      <circle cx="85" cy="70" r="35" fill="#fff" stroke="url(#emp-srch-grad)" strokeWidth="4" />
      <line x1="110" y1="95" x2="140" y2="125" stroke="url(#emp-srch-grad)" strokeWidth="6" strokeLinecap="round" />
      {/* X işareti — sonuç yok */}
      <line x1="73" y1="58" x2="97" y2="82" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      <line x1="97" y1="58" x2="73" y2="82" stroke="#dc2626" strokeWidth="3.5" strokeLinecap="round" opacity="0.7" />
      {/* Tozlar */}
      <circle cx="50" cy="120" r="2" fill="#cdb78f" opacity="0.6" />
      <circle cx="155" cy="110" r="2" fill="#cdb78f" opacity="0.6" />
      <circle cx="130" cy="50" r="2" fill="#cdb78f" opacity="0.6" />
    </svg>
  ),

  // Notifications — zil + sessiz
  notifications: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-notif-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="35" cy="40" r="5" fill="#cdb78f" opacity="0.3" />
      <circle cx="170" cy="120" r="6" fill="#d4a853" opacity="0.3" />
      {/* Zil */}
      <path d="M 100 35 C 95 35 90 38 90 45 C 75 50 70 65 70 85 L 70 105 L 60 115 L 60 120 L 140 120 L 140 115 L 130 105 L 130 85 C 130 65 125 50 110 45 C 110 38 105 35 100 35 Z"
            fill="#fff" stroke="url(#emp-notif-grad)" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="130" r="6" fill="url(#emp-notif-grad)" />
      {/* Sessizlik Z'leri */}
      <text x="145" y="60" fontSize="14" fill="#d4a853" fontWeight="bold" opacity="0.6">z</text>
      <text x="155" y="48" fontSize="18" fill="#d4a853" fontWeight="bold" opacity="0.8">z</text>
      <text x="168" y="32" fontSize="22" fill="#d4a853" fontWeight="bold">Z</text>
    </svg>
  ),

  // Generic — boş kutu
  generic: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" className="w-32 h-32" fill="none">
      <defs>
        <linearGradient id="emp-gen-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d4a853" />
          <stop offset="100%" stopColor="#8a7349" />
        </linearGradient>
      </defs>
      <circle cx="35" cy="50" r="5" fill="#cdb78f" opacity="0.3" />
      <circle cx="170" cy="120" r="6" fill="#d4a853" opacity="0.3" />
      {/* Kutu (3D) */}
      <path d="M 70 60 L 130 60 L 145 75 L 145 130 L 70 130 Z" fill="#fff" stroke="url(#emp-gen-grad)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M 130 60 L 130 75 L 145 75" fill="none" stroke="url(#emp-gen-grad)" strokeWidth="3" strokeLinejoin="round" />
      <line x1="70" y1="75" x2="130" y2="75" stroke="url(#emp-gen-grad)" strokeWidth="2" />
      {/* İç boş efekti */}
      <text x="107" y="105" textAnchor="middle" fontSize="32" fill="#cdb78f" fontWeight="bold" opacity="0.5">?</text>
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
  steps,  // FAZ 5.7 — egitsel "ne yapmali" 3-adim listesi (string[] veya {label, hint?}[])
}) {
  const illustration = ILLUSTRATIONS[type] || ILLUSTRATIONS.generic
  const normalizedSteps = Array.isArray(steps)
    ? steps.map(s => typeof s === 'string' ? { label: s } : s)
    : null

  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'py-8' : 'py-12'} px-4`}>
      <div className="mb-4">{illustration}</div>
      {title && (
        <h3 className="font-syne text-2xl font-semibold mb-2"
            style={{ color: '#f5efe2', letterSpacing: '-0.02em' }}>
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm max-w-md mb-6 leading-relaxed" style={{ color: '#928678' }}>
          {description}
        </p>
      )}

      {/* FAZ 5.7 — numarali egitsel adimlar */}
      {normalizedSteps && normalizedSteps.length > 0 && (
        <ol className="w-full max-w-md text-left mb-6 space-y-2">
          {normalizedSteps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 rounded-2xl px-3.5 py-3"
                style={{
                  background: 'rgba(205, 183, 143, 0.04)',
                  border: '1px solid rgba(205, 183, 143, 0.10)',
                }}>
              <span className="font-syne text-[14px] font-semibold tabular-nums flex-shrink-0 w-7 text-center"
                    style={{ color: '#cdb78f', letterSpacing: '-0.005em' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: '#ede4d3' }}>
                  {s.label}
                </div>
                {s.hint && (
                  <div className="text-[11px] mt-0.5" style={{ color: '#928678' }}>
                    {s.hint}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {(ctaLabel || ctaSecondaryLabel) && (
        <div className="flex flex-wrap gap-2 justify-center">
          {ctaLabel && (
            <button onClick={onCta}
              className="px-6 py-3 rounded-2xl text-[13px] font-semibold uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                color: '#1a1208',
                boxShadow: '0 10px 24px rgba(205, 183, 143, 0.22), inset 0 1px 0 rgba(255,255,255,0.22)',
              }}>
              {ctaLabel}
            </button>
          )}
          {ctaSecondaryLabel && (
            <button onClick={onCtaSecondary}
              className="px-6 py-3 rounded-2xl text-[13px] font-semibold uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5"
              style={{
                background: 'rgba(205, 183, 143, 0.06)',
                color: '#ede4d3',
                border: '1px solid rgba(205, 183, 143, 0.22)',
              }}>
              {ctaSecondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
