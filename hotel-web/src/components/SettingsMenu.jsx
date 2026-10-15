import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { menuNavFor } from '../lib/navigation'

/**
 * Başlıktaki dişli (Ayarlar) düğmesi — tıklayınca menü açılır.
 * İçerik: bildirim aç/kapat + rolün menü sekmeleri (lib/navigation.js) + yardım + çıkış.
 * Erişilebilirlik: aria-expanded, Escape ile kapanır ve odak düğmeye döner.
 */
const MENU_ICONS = {
  user: UserIcon, building: BuildingIcon, clock: ClockIcon, users: UsersIcon,
}

export default function SettingsMenu({ onTabChange, activeTab }) {
  const [open, setOpen]   = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const ref = useRef(null)
  const buttonRef = useRef(null)

  // Menü öğeleri tek kaynaktan (lib/navigation.js)
  const menuItems = menuNavFor(user?.role)

  function goTab(tabId) {
    setOpen(false)
    onTabChange?.(tabId)
  }

  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('kadrom.notifications.muted') === '1' }
    catch { return false }
  })

  useEffect(() => {
    try {
      localStorage.setItem('kadrom.notifications.muted', muted ? '1' : '0')
      window.dispatchEvent(new Event('kadrom:notifications-muted-changed'))
    } catch {}
  }, [muted])

  // Dışarı tıklama + Escape ile kapanma (Escape odağı düğmeye geri verir)
  useEffect(() => {
    if (!open) return undefined
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleLogout() {
    setOpen(false)
    logout()
    navigate('/login', { replace: true })
    toast.success('Çıkış yapıldı.')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Ayarlar"
        aria-label="Ayarlar menüsü"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="settings-menu"
        className="ah-icon-btn"
      >
        <span className="ah-icon-btn__face">
          <GearIcon />
        </span>
      </button>

      {open && (
        <div id="settings-menu"
             className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] z-50 overflow-hidden rounded-xl"
             style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line)', boxShadow: 'var(--elev-3)' }}>
          {/* Bildirim */}
          <div className="px-4 py-3 flex items-center justify-between gap-3"
               style={{ borderBottom: '1px solid var(--ah-line)' }}>
            <div>
              <div className="type-label mb-0.5">Bildirimler</div>
              <div className="type-body" style={{ color: 'var(--ah-ink)' }}>{muted ? 'Kapalı' : 'Açık'}</div>
            </div>
            <ToggleSwitch checked={!muted} onChange={(v) => setMuted(!v)} label="Bildirimler" />
          </div>

          {/* Rol menü öğeleri — lib/navigation.js */}
          {menuItems.map(item => {
            const IconCmp = MENU_ICONS[item.icon] || UserIcon
            return (
              <MenuItem key={item.id} icon={<IconCmp />} label={item.label}
                        current={activeTab === item.id}
                        className={item.mobileOnly ? 'md:hidden' : ''}
                        onClick={() => goTab(item.id)} />
            )
          })}

          <MenuItem icon={<HelpIcon />} label="Yardım ve destek"
                    href="/yardim" onNavigate={() => setOpen(false)} />
          <MenuItem icon={<DocIcon />} label="KVKK aydınlatma metni"
                    href="/kvkk" onNavigate={() => setOpen(false)} />

          <button
            type="button"
            onClick={handleLogout}
            className="w-full px-4 min-h-[44px] flex items-center gap-3 type-body transition-colors hover:bg-[var(--ah-band)]"
            style={{ color: 'var(--ah-ink)' }}
          >
            <LogoutIcon />
            <span className="font-semibold">Çıkış yap</span>
          </button>
        </div>
      )}

    </div>
  )
}

function MenuItem({ icon, label, onClick, href, onNavigate, current = false, className = '' }) {
  const cls = `w-full px-4 min-h-[44px] flex items-center gap-3 type-body transition-colors hover:bg-[var(--ah-band)] ${className}`
  const style = {
    color: 'var(--ah-ink)',
    borderBottom: '1px solid var(--ah-line)',
    fontWeight: current ? 600 : undefined,
  }
  const iconEl = <span style={{ color: 'var(--ah-ink-3)' }}>{icon}</span>
  if (href) {
    return (
      <Link to={href} onClick={onNavigate} className={cls} style={style}>
        {iconEl}<span>{label}</span>
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}
            aria-current={current ? 'page' : undefined}>
      {iconEl}<span>{label}</span>
    </button>
  )
}

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         strokeWidth={1.8} stroke="currentColor" aria-hidden="true"
         style={{ width: 18, height: 18 }}>
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 items-center rounded-full border transition-colors shrink-0"
      style={{
        background: checked ? 'var(--ah-brand)' : 'var(--ah-line)',
        borderColor: checked ? 'var(--ah-brand)' : 'var(--ah-line-2)',
      }}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full transition-transform"
        style={{
          background: '#fff',
          boxShadow: '0 1px 2px rgba(18,32,31,0.2)',
          transform: `translateX(${checked ? '24px' : '4px'})`,
        }}
      />
    </button>
  )
}

/* Icons */
function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  )
}
function BuildingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}
function HelpIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
  )
}
function DocIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}
function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round"
            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
    </svg>
  )
}
