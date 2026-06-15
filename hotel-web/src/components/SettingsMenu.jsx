import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import toast from 'react-hot-toast'

/**
 * Header'daki dişli (⚙) ikonu — tıklayınca dropdown açılır.
 * İçerik: Tema seçimi + Bildirim kapama + Yardım/SSS + Çıkış
 *
 * Sidebar'da Ayarlar/Yardım sekmeleri kaldırıldı; her şey buraya toplandı.
 */
export default function SettingsMenu({ onTabChange }) {
  const [open, setOpen]   = useState(false)
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const ref = useRef(null)

  // Profilim hem aday hem işletme'de var, label farklı
  const isCandidate = user?.role === 'CANDIDATE'
  const isBusiness  = user?.role === 'BUSINESS_OWNER'

  function goTab(tabId) {
    setOpen(false)
    onTabChange?.(tabId)
  }

  // Bildirim sustur (localStorage)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('ajanshotel.notifications.muted') === '1' }
    catch { return false }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ajanshotel.notifications.muted', muted ? '1' : '0')
      window.dispatchEvent(new Event('ajanshotel:notifications-muted-changed'))
    } catch {}
  }, [muted])

  // Dış tıklama
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
    toast.success('Çıkış yapıldı.')
  }

  return (
    <div className="relative" ref={ref}>
      {/* Dişli butonu */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Ayarlar"
        className="w-9 h-9 grid place-items-center rounded-full bg-white border border-cream-300
                   text-ink-600 hover:text-brand-700 hover:border-brand-500 transition-colors shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             strokeWidth={1.8} stroke="currentColor" className="w-4.5 h-4.5"
             style={{ width: 18, height: 18 }}>
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 z-50 rounded-2xl border border-cream-300
                        bg-white backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Tema */}
          <div className="px-4 py-3 border-b border-cream-300">
            <div className="text-[10px] uppercase tracking-widest text-ink-500 mb-2">Görünüm</div>
            <div className="flex items-center gap-1.5">
              <ThemePill active={theme === 'light'} label="Açık"
                onClick={() => { if (theme !== 'light') toggleTheme() }} />
              <ThemePill active={theme === 'dark'}  label="Koyu"
                onClick={() => { if (theme !== 'dark')  toggleTheme() }} />
            </div>
          </div>

          {/* Bildirim */}
          <div className="px-4 py-3 border-b border-cream-300 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-ink-500 mb-0.5">Bildirimler</div>
              <div className="text-[12px] text-ink-800">{muted ? 'Kapalı' : 'Açık'}</div>
            </div>
            <ToggleSwitch checked={!muted} onChange={(v) => setMuted(!v)} />
          </div>

          {/* Profilim — aday + işletme */}
          {(isCandidate || isBusiness) && (
            <button
              type="button"
              onClick={() => goTab('profile')}
              className="w-full px-4 py-3 flex items-center gap-3 text-[13px] text-ink-800
                         hover:bg-cream-200 transition-colors border-b border-cream-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-ink-400">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span>{isBusiness ? 'İşletme Profili' : 'Profilim'}</span>
            </button>
          )}

          {/* Geçmiş İşlerim — sadece aday */}
          {isCandidate && (
            <button
              type="button"
              onClick={() => goTab('history')}
              className="w-full px-4 py-3 flex items-center gap-3 text-[13px] text-ink-800
                         hover:bg-cream-200 transition-colors border-b border-cream-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-ink-400">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span>Geçmiş İşlerim</span>
            </button>
          )}

          {/* Yardım */}
          <Link
            to="/yardim"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-3 flex items-center gap-3 text-[13px] text-ink-800
                       hover:bg-cream-200 transition-colors border-b border-cream-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-ink-400">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
            </svg>
            <span>Yardım & Destek</span>
          </Link>

          {/* KVKK */}
          <Link
            to="/kvkk"
            onClick={() => setOpen(false)}
            className="w-full px-4 py-3 flex items-center gap-3 text-[13px] text-ink-800
                       hover:bg-cream-200 transition-colors border-b border-cream-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="currentColor" className="w-4 h-4 text-ink-400">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <span>KVKK Aydınlatma Metni</span>
          </Link>

          {/* Çıkış */}
          <button
            type="button"
            onClick={handleLogout}
            className="w-full px-4 py-3 flex items-center gap-3 text-[13px] text-red-300
                       hover:bg-red-950/40 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            <span className="font-semibold">Çıkış Yap</span>
          </button>
        </div>
      )}

    </div>
  )
}

function ThemePill({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors
        ${active
          ? 'bg-brand-500 text-white border-brand-500'
          : 'bg-cream-200 text-ink-300 border-slate-700 hover:bg-slate-700/60'}`}
    >
      {label}
    </button>
  )
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors shrink-0
        ${checked ? 'bg-brand-500 border-brand-500' : 'bg-slate-700 border-slate-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

