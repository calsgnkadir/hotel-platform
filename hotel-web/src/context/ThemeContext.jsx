import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext({ theme: 'light', toggle: () => {}, toggleTheme: () => {} })

const STORAGE_KEY = 'ajanshotel-theme'

// REDESIGN v3 — Acik+teal kimlige gecis: default LIGHT. Eski 'dark' kaydi olan
// kullanicilar da bir kerelik light'a migrate edilir (yeni surum bayragi).
const MIGRATION_KEY = 'ajanshotel-theme-v3light-migrated'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'light'
  const migrated = localStorage.getItem(MIGRATION_KEY) === '1'
  if (!migrated) {
    // ilk yukleme (bu surumde) — eski dark tercihini ez, light'a gec
    localStorage.setItem(MIGRATION_KEY, '1')
    localStorage.setItem(STORAGE_KEY, 'light')
    return 'light'
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return 'light'
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
