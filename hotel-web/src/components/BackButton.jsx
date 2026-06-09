import { useNavigate } from 'react-router-dom'

/**
 * Sol üst köşe geri butonu — auth/public sayfalarda kullanılır.
 *
 * Props:
 *   - to:    '/login' (default önceki sayfaya döner: -1)
 *   - label: 'Geri'   (gösterilen yazı)
 */
export default function BackButton({ to, label = 'Geri' }) {
  const navigate = useNavigate()

  function handleClick() {
    if (to) navigate(to)
    else navigate(-1)
  }

  return (
    <button onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold
                 text-ink-400 hover:text-white
                 px-3 py-1.5 rounded-full
                 hover:bg-cream-200 transition-colors
                 active:scale-95">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
           strokeWidth={2.2} stroke="currentColor" className="w-3.5 h-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
      {label}
    </button>
  )
}
