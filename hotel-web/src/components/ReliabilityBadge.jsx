/**
 * Aday güvenilirlik skoru (0-100) için renkli pill.
 *
 * Renk eşikleri:
 *   >= 80: yeşil       (güvenilir)
 *   60-79: amber       (ortalama)
 *   40-59: turuncu     (dikkat)
 *   <  40: kırmızı     (riskli)
 *
 * Kullanım: <ReliabilityBadge score={app.candidate.reliabilityScore} />
 */
export default function ReliabilityBadge({ score, size = 'sm', showLabel = false }) {
  if (score == null) return null

  let color, bg, border
  if (score >= 80) {
    color = '#86efac'; bg = 'rgba(34, 197, 94, 0.18)';  border = 'rgba(34, 197, 94, 0.40)'
  } else if (score >= 60) {
    color = '#fcd34d'; bg = 'rgba(245, 158, 11, 0.18)'; border = 'rgba(245, 158, 11, 0.40)'
  } else if (score >= 40) {
    color = '#fdba74'; bg = 'rgba(251, 146, 60, 0.18)'; border = 'rgba(251, 146, 60, 0.40)'
  } else {
    color = '#fca5a5'; bg = 'rgba(239, 68, 68, 0.20)';  border = 'rgba(239, 68, 68, 0.45)'
  }

  const isSm = size === 'sm'
  const padding = isSm ? 'px-1.5 py-0.5' : 'px-2.5 py-1'
  const text    = isSm ? 'text-[10px]'   : 'text-xs'
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
