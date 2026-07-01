/**
 * StarRating — hem görüntüleme hem giriş için.
 *
 * Görüntü modu: <StarRating value={4.3} />
 * Etkileşimli:  <StarRating value={n} onChange={setN} size="lg" />
 * Aggregate:    <StarRating value={4.3} count={12} />
 */
export default function StarRating({ value = 0, onChange, count, size = 'md' }) {
  const interactive = typeof onChange === 'function'
  const v = Math.max(0, Math.min(5, value || 0))
  // SVG yıldız boyutları (eski text-{size} class'ları yerine px)
  const sizes = {
    xs: { px: 12, text: 'text-[10px]' },
    sm: { px: 14, text: 'text-xs' },
    md: { px: 16, text: 'text-xs' },
    lg: { px: 22, text: 'text-sm' },
  }
  const s = sizes[size] || sizes.md

  function renderStar(i) {
    // i = 1..5 — SVG (fill = ne kadar dolu)
    let fillRatio   // 0 boş / 0.5 yarım / 1 dolu
    if (interactive) {
      fillRatio = i <= v ? 1 : 0
    } else {
      if (v >= i)         fillRatio = 1
      else if (v >= i - 0.5) fillRatio = 0.5
      else                fillRatio = 0
    }
    const gold = '#c8923a'
    const empty = '#475569'
    const gradientId = `star-grad-${i}-${fillRatio}`
    const star = (
      <svg width={s.px} height={s.px} viewBox="0 0 24 24" aria-hidden="true"
           style={{ display: 'inline-block', verticalAlign: 'middle' }}
           className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}>
        {fillRatio === 0.5 && (
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="50%" stopColor={gold} />
              <stop offset="50%" stopColor={empty} />
            </linearGradient>
          </defs>
        )}
        <path d="M12 2l2.92 6.41 7.08.62-5.36 4.66 1.6 6.94L12 17.27 5.76 20.63l1.6-6.94L2 9.03l7.08-.62L12 2z"
              fill={fillRatio === 1 ? gold : fillRatio === 0.5 ? `url(#${gradientId})` : empty}
              stroke={gold} strokeWidth="0.8" strokeLinejoin="round" />
      </svg>
    )
    return interactive ? (
      <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} yıldız`}
        className="px-0.5 leading-none">
        {star}
      </button>
    ) : <span key={i} className="px-0.5 leading-none">{star}</span>
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(renderStar)}
      {!interactive && count !== undefined && (
        <span className={`${s.text} text-ink-500 ml-1`}>
          {v > 0 ? v.toFixed(1) : '—'}
          {count > 0 && <span className="text-ink-400"> ({count})</span>}
        </span>
      )}
    </span>
  )
}
