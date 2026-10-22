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
    // btn-ghost: açık zeminde okunur (eski hover:text-white kayboluyordu),
    // min 44px dokunma hedefi; -ml-3 metni sayfa kenarıyla hizalar.
    <button type="button" onClick={handleClick}
      className="btn-ghost !min-h-[44px] -ml-3 !gap-1.5">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
           strokeWidth={2.2} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
      {label}
    </button>
  )
}
