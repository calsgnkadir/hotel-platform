/**
 * FAZ G.3 — İşletme KYC onay rozeti.
 *
 * Twitter/X verified pattern, AjansHotel paletinde (mavi yerine altın).
 * 3 boyut: sm (14px) — ilan kartı yanı, md (18px) — public profil başlığı,
 * lg (22px) — hero alanlar.
 */
export default function VerifiedBadge({ size = 'sm', title = 'Doğrulanmış işletme' }) {
  const dim = size === 'lg' ? 22 : size === 'md' ? 18 : 14
  return (
    <span
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex',
        verticalAlign: 'middle',
        flexShrink: 0,
        marginLeft: 4,
      }}>
      <svg width={dim} height={dim} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={`vb-grad-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#cdb78f" />
            <stop offset="100%" stopColor="#d4a853" />
          </linearGradient>
        </defs>
        {/* Çentikli yıldız: KYC için klasik X verified silüeti */}
        <path
          d="M12 1.5 L13.8 4.2 L17 3.8 L17.6 7 L20.5 8.5 L19.2 11.5 L20.5 14.5 L17.6 16 L17 19.2 L13.8 18.8 L12 21.5 L10.2 18.8 L7 19.2 L6.4 16 L3.5 14.5 L4.8 11.5 L3.5 8.5 L6.4 7 L7 3.8 L10.2 4.2 Z"
          fill={`url(#vb-grad-${size})`}
        />
        <path
          d="M8.5 12 L11 14.5 L15.5 9.5"
          stroke="#13110f"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  )
}
