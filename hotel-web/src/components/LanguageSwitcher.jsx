/**
 * FAZ 1/#36 — Dil seçici dropdown.
 *
 * SettingsMenu içinde veya header'da kullanılabilir.
 */
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGS } from '../i18n'

export default function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = SUPPORTED_LANGS.find(l => l.code === i18n.language?.split('-')[0]) || SUPPORTED_LANGS[0]

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function selectLang(code) {
    i18n.changeLanguage(code)
    localStorage.setItem('lang', code)
    setOpen(false)
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-cream-200 transition-colors"
        title="Dil seç">
        <span className="text-base leading-none">{current.flag}</span>
        <span className="uppercase">{current.code}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 min-w-[140px] rounded-xl overflow-hidden shadow-lg z-50"
             style={{ background: '#fff', border: '1px solid rgba(168,85,247,0.30)' }}>
          {SUPPORTED_LANGS.map(l => (
            <button key={l.code} onClick={() => selectLang(l.code)}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors hover:bg-purple-50
                ${l.code === current.code ? 'font-bold' : ''}`}
              style={{ color: '#3b0764' }}>
              <span className="text-base">{l.flag}</span>
              <span>{l.label}</span>
              {l.code === current.code && <span className="ml-auto text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
