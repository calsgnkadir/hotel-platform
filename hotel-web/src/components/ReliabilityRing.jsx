/**
 * FAZ G.4 — Apple Watch tarzı dairesel progress ring (güvenilirlik skoru).
 *
 * Avatar etrafında ince renkli halka, doluluk = skor / 100.
 * Mevcut ReliabilityBadge (pill) yerine değil, onun YANINDA kullanılır:
 *  - Avatar büyük olduğunda (public profile, dashboard hero) → ring
 *  - Avatar küçük olduğunda (kanban, satır) → ReliabilityBadge (pill)
 *
 * Renkler (signal palet):
 *   >= 80  signal-green   (güvenilir)
 *   60-79  signal-amber   (ortalama)
 *   40-59  accent gold    (dikkat — paletin sıcak tonu)
 *   <  40  signal-coral   (riskli)
 *
 * Skor null → halka render edilmez, sadece children.
 *
 * Kullanım:
 *   <ReliabilityRing score={87} size={72}>
 *     <img src={avatarUrl} className="..." />
 *   </ReliabilityRing>
 */
export default function ReliabilityRing({ score, size = 64, stroke = 4, children, label = true }) {
  const hasScore = score != null && !Number.isNaN(score)

  if (!hasScore) {
    return <div style={{ width: size, height: size, position: 'relative' }}>{children}</div>
  }

  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const progress = (clamped / 100) * circumference
  const offset = circumference - progress

  let color
  if (clamped >= 80)      color = 'var(--signal-green, #3ddc97)'
  else if (clamped >= 60) color = 'var(--signal-amber, #f59e0b)'
  else if (clamped >= 40) color = 'var(--accent-action, #d4a853)'
  else                    color = 'var(--signal-coral, #ef6461)'

  const center = size / 2

  return (
    <div
      style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}
      title={label ? `Güvenilirlik skoru: ${clamped} / 100` : undefined}>
      <svg
        width={size}
        height={size}
        aria-label={`Güvenilirlik skoru ${clamped}`}
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 700ms ease-out',
            filter: `drop-shadow(0 0 4px ${color}88)`,
          }}
        />
      </svg>
      {/* Avatar / children — ring'in içinde */}
      <div style={{
        position: 'absolute',
        inset: stroke + 2,
        borderRadius: '50%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}
