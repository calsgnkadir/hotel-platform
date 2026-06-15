import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'light', toggle: () => {}, toggleTheme: () => {} })

const STORAGE_KEY = 'ajanshotel-theme'

// FAZ 5.4 — Bir kerelik migration: eski "light" kayitlari dark'a cevir.
// Surum bayragi sayesinde sonraki yenilemelerde kullanicinin secimi kalir.
const MIGRATION_KEY = 'ajanshotel-theme-v54-migrated'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const migrated = localStorage.getItem(MIGRATION_KEY) === '1'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!migrated) {
    // ilk yukleme — eski tema bilgisi varsa atla, dark default
    localStorage.setItem(MIGRATION_KEY, '1')
    localStorage.setItem(STORAGE_KEY, 'dark')
    return 'dark'
  }
  if (saved === 'light' || saved === 'dark') return saved
  return 'dark'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  // <html class="dark"> uygula + persist
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function toggle() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle, toggleTheme: toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
