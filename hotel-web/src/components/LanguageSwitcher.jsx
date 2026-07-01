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
        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-cream-200 transition-colors"
        title="Dil seç" style={{ color: '#13110f' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
        </svg>
        <span className="uppercase">{current.code}</span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             strokeWidth={2} stroke="currentColor" className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 min-w-[140px] rounded-xl overflow-hidden shadow-lg z-50"
             style={{ background: '#fff', border: '1px solid rgba(205, 183, 143, 0.22)' }}>
          {SUPPORTED_LANGS.map(l => (
            <button key={l.code} onClick={() => selectLang(l.code)}
              className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors hover:bg-purple-50
                ${l.code === current.code ? 'font-bold' : ''}`}
              style={{ color: '#13110f' }}>
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                    style={{ background: '#ede4d3', color: '#1b1815' }}>{l.code}</span>
              <span>{l.label}</span>
              {l.code === current.code && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="ml-auto w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
