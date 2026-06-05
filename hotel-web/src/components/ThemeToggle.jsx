import { useTheme } from '../context/ThemeContext'

/**
 * Tema değiştirici — kontrast (yarısı dolu daire) ikonu.
 * Klasik güneş/ay yerine daha özgün: bir tarafı dolu, bir tarafı boş yarım çember.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      title={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
      aria-label={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
        bg-slate-100 hover:bg-slate-200 text-slate-700
        dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-200
        hover:scale-105 active:scale-95
        ${className}`}>
      {/* Kontrast (yarı dolu daire) — özgün SVG */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 3 A 9 9 0 0 1 12 21 Z" fill="currentColor" />
      </svg>
    </button>
  )
}
