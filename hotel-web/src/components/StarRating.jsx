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
  const sizes = {
    xs: { star: 'text-xs',  text: 'text-[10px]' },
    sm: { star: 'text-sm',  text: 'text-xs' },
    md: { star: 'text-base', text: 'text-xs' },
    lg: { star: 'text-2xl', text: 'text-sm' },
  }
  const s = sizes[size] || sizes.md

  function renderStar(i) {
    // i = 1..5
    let fill
    if (interactive) {
      fill = i <= v ? 'text-amber-400' : 'text-ink-300'
    } else {
      // Yarım yıldız desteği — yuvarlama
      if (v >= i)         fill = 'text-amber-400'
      else if (v >= i - 0.5) fill = 'text-amber-400 opacity-60'
      else                fill = 'text-ink-300'
    }
    const star = (
      <span className={`${s.star} ${fill} ${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''} leading-none`}>
        ★
      </span>
    )
    return interactive ? (
      <button key={i} type="button" onClick={() => onChange(i)} aria-label={`${i} yıldız`}
        className="px-0.5">
        {star}
      </button>
    ) : <span key={i} className="px-0.5">{star}</span>
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
