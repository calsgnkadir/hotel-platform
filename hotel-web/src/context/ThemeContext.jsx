import { createContext, useContext, useEffect } from 'react'

/**
 * FAZ 26 — ITEM 7: KOYU MOD KALDIRILDI (kullanici karari).
 *
 * Gerekce: uygulama acik+teal kimlige gecti; `--ah-*` token'larinin koyu
 * karsiligi yoktu, dolayisiyla "Koyu" secildiginde ekranlar yari-migrate
 * karisik gorunuyordu. Referans (Kariyer.net/LinkedIn) da tek tema sunar.
 *
 * Provider ve useTheme() imza uyumu icin duruyor (tuketiciler kirilmasin):
 * theme hep 'light', toggle no-op. `.dark` sinifi varsa temizlenir — eskiden
 * koyu secmis kullanicilar otomatik acik'a doner.
 *
 * NOT: tailwind.config'de darkMode:'class' BILEREK duruyor. Kaldirilirsa
 * koddaki 108 `dark:` variant OS tercihine gore aktiflesirdi.
 */
const ThemeContext = createContext({ theme: 'light', toggle: () => {}, toggleTheme: () => {} })

const STORAGE_KEY = 'ajanshotel-theme'

export function ThemeProvider({ children }) {
  useEffect(() => {
    // Eski koyu tercihi olan kullanicilari temizle
    document.documentElement.classList.remove('dark')
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  const noop = () => {}
  return (
    <ThemeContext.Provider value={{ theme: 'light', toggle: noop, toggleTheme: noop, setTheme: noop }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
