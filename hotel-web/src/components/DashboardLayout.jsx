import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as hotelApi from '../api/hotel'
import WsConnectionBadge from './WsConnectionBadge'
import LanguageSwitcher from './LanguageSwitcher'
import EmailVerifyBanner from './EmailVerifyBanner'
import NotificationBell from './NotificationBell'
import SettingsMenu from './SettingsMenu'

/* ───────── Lucide-style inline SVG ikonlar (active state: fill + stroke) ───────── */
const Icons = {
  overview:     <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>,
  listings:     <><path d="M20 7h-9M20 12h-9M20 17h-9"/><circle cx="5" cy="7" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="5" cy="17" r="1"/></>,
  briefcase:    <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
  send:         <><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></>,
  messages:     <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>,
  user:         <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  users:        <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  building:     <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/></>,
  inbox:        <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  trending:     <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  alert:        <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  lifebuoy:     <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></>,
  activity:     <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
  logout:       <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
  menu:         <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>,
  close:        <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  external:     <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  heart:        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  eye:          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
}

function Icon({ name, size = 16, active = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill={active ? 'currentColor' : 'none'}
         fillOpacity={active ? 0.14 : 0}
         stroke="currentColor" strokeWidth={active ? 1.8 : 1.6}
         strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" className="flex-shrink-0">
      {Icons[name] || Icons.overview}
    </svg>
  )
}

/* Nav definitions — id, label, icon name */
const candidateNav = [
  { id: 'overview',      tKey: 'nav.overview',     icon: 'overview' },
  { id: 'listings',      tKey: 'nav.listings',     icon: 'briefcase' },
  { id: 'saved',         label: 'Kaydettiklerim',  icon: 'heart' },
  { id: 'applications',  tKey: 'nav.applications', icon: 'send' },
  { id: 'messages',      tKey: 'nav.messages',     icon: 'messages' },
  // Profilim sidebar'dan cikarildi — sag ust ⚙️ ayarlar menusunden erisilir
]

const businessNav = [
  { id: 'overview',      tKey: 'nav.overview',             icon: 'overview' },
  { id: 'mylistings',    tKey: 'nav.myListings',           icon: 'briefcase' },
  { id: 'applications',  tKey: 'nav.incomingApplications', icon: 'inbox' },
  { id: 'analytics',     label: 'Analitik',                icon: 'trending' },
  { id: 'messages',      tKey: 'nav.messages',             icon: 'messages' },
  { id: 'profile',       label: 'Profilim',                icon: 'building' },
]

const adminNav = [
  { id: 'overview',   tKey: 'nav.overview',   icon: 'overview' },
  { id: 'users',      tKey: 'nav.users',      icon: 'users' },
  { id: 'businesses', label: 'İşletmeler',    icon: 'building' },
  { id: 'listings',   label: 'İlanlar',       icon: 'briefcase' },
  { id: 'reports',    tKey: 'nav.reports',    icon: 'alert' },
  { id: 'support',    label: 'Destek',        icon: 'lifebuoy' },
  { id: 'audit',      tKey: 'nav.audit',      icon: 'activity' },
  { id: 'outbox',     label: 'Outbox',        icon: 'inbox' },
]

export default function DashboardLayout({ children, activeTab, onTabChange }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { t } = useTranslation()

  const isCandidate = user?.role === 'CANDIDATE'
  const isAdmin     = user?.role === 'ADMIN'
  const isBusiness  = user?.role === 'BUSINESS_OWNER'
  const navItems    = isAdmin ? adminNav : (isCandidate ? candidateNav : businessNav)

  const { data: bizProfile } = useQuery({
    queryKey: ['business-profile-for-public-link'],
    queryFn: hotelApi.getBusinessProfile,
    enabled: isBusiness,
    staleTime: 5 * 60 * 1000,
  })

  function handleLogout() { logout(); navigate('/login', { replace: true }) }
  function handleTabClick(id) { onTabChange?.(id); setMobileOpen(false) }

  // Nav'da olmayan (ayarlar menusunden acilan) sekmeler icin baslik fallback'i
  const EXTRA_TITLES = { profile: 'Profilim', relations: 'Takip Ettiklerim', history: 'Geçmiş İşlerim', workers: 'Bizde Çalışanlar' }
  const currentTitle = (() => {
    const item = navItems.find(n => n.id === activeTab)
    if (item) return item.tKey ? t(item.tKey) : item.label
    return EXTRA_TITLES[activeTab] || 'Panel'
  })()

  return (
    <div className="min-h-screen relative ah-surface" style={{ background: 'var(--ah-page)' }}>
      {/* === Mobile backdrop === */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/30"
             onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      {/* === SIDEBAR === */}
      <aside
        className={`fixed top-0 left-0 bottom-0 w-[240px] z-40 flex flex-col border-r
                    transform transition-transform duration-300
                    ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}
        aria-label="Ana navigasyon">
        {/* Logo */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b"
             style={{ borderColor: 'var(--ah-line)' }}>
          <Link to={dashboardHomeFor(user?.role)} className="flex items-baseline gap-2">
            <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.02em', color: 'var(--ah-ink)' }}>AjansHotel</span>
            <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ah-ink-4)' }}>istanbul</span>
          </Link>
          <button onClick={() => setMobileOpen(false)}
                  className="lg:hidden p-1 rounded" style={{ color: 'var(--ah-ink-3)' }}
                  aria-label="Menüyü kapat">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map(item => (
            <NavItem key={item.id}
                     item={item}
                     active={activeTab === item.id}
                     onClick={() => handleTabClick(item.id)}
                     label={item.tKey ? t(item.tKey) : item.label} />
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t flex-shrink-0 p-3 space-y-2" style={{ borderColor: 'var(--ah-line)' }}>
          <div className="flex items-center justify-between gap-2 px-1">
            <LanguageSwitcher />
            <WsConnectionBadge />
          </div>
          {isBusiness && bizProfile?.id && (
            <a href={`/p/business/${bizProfile.id}`} target="_blank" rel="noopener noreferrer"
               title="Public profilini yeni sekmede ac"
               className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg"
               style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                        color: 'var(--ah-ink-3)', border: '1px solid var(--ah-line-2)', background: 'var(--ah-card)' }}>
              <Icon name="external" size={11} /> Public Profilim
            </a>
          )}
          <button onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg transition-colors"
                  style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                           background: 'var(--ah-card)', color: 'var(--ah-danger)', border: '1px solid var(--ah-line-2)' }}>
            <Icon name="logout" size={12} /> Çıkış
          </button>
        </div>
      </aside>

      {/* === MAIN CONTENT === */}
      <div className="lg:pl-[240px] min-h-screen relative z-10">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b"
                style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
          <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
            {/* Mobile: hamburger + brand */}
            <div className="flex items-center gap-2 lg:hidden">
              <button onClick={() => setMobileOpen(true)}
                      className="p-2 rounded-lg"
                      style={{ color: 'var(--ah-brand)', border: '1px solid var(--ah-line-2)', background: 'var(--ah-card)' }}
                      aria-label="Menü">
                <Icon name="menu" size={18} />
              </button>
              <Link to={dashboardHomeFor(user?.role)} className="flex items-baseline gap-1.5">
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--ah-ink)' }}>AjansHotel</span>
              </Link>
            </div>
            {/* Desktop: aktif sayfa basligi */}
            <h2 className="hidden lg:block" style={{ fontSize: 14, fontWeight: 600, color: 'var(--ah-ink-2)' }}>
              {currentTitle}
            </h2>
            {/* Sag: actions */}
            <div className="flex items-center gap-2">
              <NotificationBell onNavigate={(link) => onTabChange?.(link)} />
              <SettingsMenu onTabChange={onTabChange} />
            </div>
          </div>
        </header>

        <main className="fade-in" style={{ color: 'var(--ah-ink-2)' }}>
          <EmailVerifyBanner />

          {/* Page heading — sade, koyu ink, gradyan/underline yok */}
          <div className="px-4 lg:px-8 pt-6 lg:pt-8 pb-5">
            <h1 style={{ fontSize: 'clamp(22px, 3vw, 28px)', lineHeight: 1.15, fontWeight: 700,
                         letterSpacing: '-0.01em', color: 'var(--ah-ink)' }}>
              {currentTitle}
            </h1>
          </div>

          <div className="px-4 lg:px-8 pb-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

/* ───────── NavItem — açık/teal (aktif = teal soft bg, rail yok) ───────── */
function NavItem({ item, active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
      style={{
        background: active ? 'var(--ah-brand-soft)' : 'transparent',
        color: active ? 'var(--ah-brand)' : 'var(--ah-ink-2)',
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#f2f5f5' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ color: active ? 'var(--ah-brand)' : 'var(--ah-ink-4)', display: 'inline-flex' }}>
        <Icon name={item.icon} size={16} active={active} />
      </span>
      <span className="flex-1 text-left" style={{ fontSize: active ? 14 : 13.5 }}>
        {label}
      </span>
    </button>
  )
}

/* Role'e gore dashboard kok path'i */
function dashboardHomeFor(role) {
  switch (role) {
    case 'ADMIN':          return '/admin'
    case 'BUSINESS_OWNER': return '/business'
    case 'CANDIDATE':      return '/candidate'
    default:               return '/'
  }
}
