/**
 * Guvenilirlik skoru (0-100) icin renkli pill.
 * FAZ B.2: acik+teal palete cevrildi.
 *
 * Renk esikleri:
 *   >= 80: ok (yesil)
 *   60-79: warn (amber)
 *   40-59: warn (turuncu)
 *   <  40: danger (kirmizi)
 *
 * Kullanim: <ReliabilityBadge score={app.candidate.reliabilityScore} />
 */
export default function ReliabilityBadge({ score, size = 'sm', showLabel = false }) {
  if (score == null) return null

  let bg, color, border
  if (score >= 80) {
    bg = 'var(--ah-ok-soft)';     color = 'var(--ah-ok)';      border = 'rgba(10, 124, 66, 0.32)'
  } else if (score >= 60) {
    bg = 'var(--ah-warn-soft)';   color = 'var(--ah-warn)';    border = 'rgba(183, 121, 31, 0.32)'
  } else if (score >= 40) {
    bg = 'var(--ah-warn-soft)';   color = '#a35b0f';           border = 'rgba(183, 121, 31, 0.32)'
  } else {
    bg = 'var(--ah-danger-soft)'; color = 'var(--ah-danger)';  border = 'rgba(192, 57, 43, 0.32)'
  }

  const isSm = size === 'sm'
  const padding = isSm ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
  const text    = isSm ? 'text-[10.5px]' : 'text-xs'
  const icon    = isSm ? 'w-2.5 h-2.5'   : 'w-3.5 h-3.5'

  return (
    <span
      title={`Güvenilirlik skoru: ${score} / 100`}
      className={`inline-flex items-center gap-1 rounded-full font-bold ${padding} ${text}`}
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={icon}>
        <path fillRule="evenodd"
              d="M12.516 2.17a.75.75 0 0 0-1.032 0 11.209 11.209 0 0 1-7.877 3.08.75.75 0 0 0-.722.515A12.74 12.74 0 0 0 2.25 9.75c0 5.942 4.064 10.933 9.563 12.348a.75.75 0 0 0 .374 0c5.499-1.415 9.563-6.406 9.563-12.348 0-1.39-.223-2.73-.635-3.985a.75.75 0 0 0-.722-.516l-.143.001c-2.996 0-5.717-1.17-7.734-3.08Z"
              clipRule="evenodd" />
      </svg>
      {score}{showLabel && <span className="opacity-80 font-normal ml-0.5">güven</span>}
    </span>
  )
}
