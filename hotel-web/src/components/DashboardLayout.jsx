import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import * as hotelApi from '../api/hotel'
import WsConnectionBadge from './WsConnectionBadge'
import BottomTabBar from './BottomTabBar'
import LanguageSwitcher from './LanguageSwitcher'
import EmailVerifyBanner from './EmailVerifyBanner'
import ExpandableTabs, { tabIcons } from './ExpandableTabs'
import DecryptEffect from './DecryptEffect'
import { keys } from '../lib/queryClient'

// FAZ 1/#36 — Nav item id'leri i18n key'lerine map'lenir.
const candidateNav = [
  { id: 'overview',      tKey: 'nav.overview' },
  { id: 'listings',      tKey: 'nav.listings' },
  { id: 'applications',  tKey: 'nav.applications' },
  { id: 'documents',     tKey: 'nav.documents' },
  { id: 'messages',      tKey: 'nav.messages' },
]

const businessNav = [
  { id: 'overview',      tKey: 'nav.overview' },
  { id: 'mylistings',    tKey: 'nav.myListings' },
  { id: 'applications',  tKey: 'nav.incomingApplications' },
  { id: 'workers',       tKey: 'nav.workers' },
  { id: 'analytics',     label: 'Analitik' },        // FAZ C.3
  { id: 'messages',      tKey: 'nav.messages' },
]

const adminNav = [
  { id: 'overview',   tKey: 'nav.overview' },
  { id: 'users',      tKey: 'nav.users' },
  { id: 'businesses', label: 'İşletmeler' }, // FAZ G.3 — KYC doğrulama
  { id: 'listings',   label: 'İlanlar' },     // FAZ 6.3 — moderation
  { id: 'reports',    tKey: 'nav.reports' },
  { id: 'support',    label: 'Destek' },          // FAZ I.5
  { id: 'audit',      tKey: 'nav.audit' },
  { id: 'outbox',     label: 'Outbox' },      // FAZ D.5 — DLQ admin
]

export default function DashboardLayout({ children, activeTab, onTabChange }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { t } = useTranslation()

  const isCandidate = user?.role === 'CANDIDATE'
  const isAdmin = user?.role === 'ADMIN'
  const isBusiness = user?.role === 'BUSINESS_OWNER'
  const navItems = isAdmin ? adminNav : (isCandidate ? candidateNav : businessNav)

  // FAZ 5.9 — Business owner icin public profil linkinde gerekli id
  const { data: bizProfile } = useQuery({
    queryKey: ['business-profile-for-public-link'],
    queryFn: hotelApi.getBusinessProfile,
    enabled: isBusiness,
    staleTime: 5 * 60 * 1000,
  })

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen relative">
      {/* Calm radial halo arka plan */}
      <div
        aria-hidden
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 800px 600px at 10% 20%, rgba(30, 58, 95, 0.18) 0%, transparent 60%),' +
            'radial-gradient(ellipse 600px 500px at 90% 80%, rgba(212, 168, 83, 0.10) 0%, transparent 60%),' +
            'radial-gradient(circle at 50% 50%, transparent 0%, rgba(10, 6, 18, 0.6) 100%)',
        }}
      />

      {/* Neon üst hat (ince) */}
      <div className="fixed top-0 left-0 right-0 z-50 neon-strip pointer-events-none no-print" />

      {/* === HEADER — brand + top nav + right actions === */}
      <header className="relative z-30 sticky top-[2px] backdrop-blur-xl border-b"
              style={{
                background: 'rgba(15, 23, 38, 0.75)',
                borderColor: 'rgba(212, 168, 83, 0.18)',
              }}>
        {/* Üst satır: brand + actions */}
        <div className="px-4 lg:px-8 py-3 flex items-center justify-between gap-4">
          {/* Logo: panelden tiklayinca kendi dashboard'una kalsin, public landing'e atip
              kullaniciyi 'cikis yaptirilmis gibi' hissettirmesin */}
          <Link to={dashboardHomeFor(user?.role)} className="flex items-baseline gap-2 flex-shrink-0">
            <span className="font-bebas text-2xl tracking-wider text-white">AJANSHOTEL</span>
            <span className="hidden sm:inline text-[9px] uppercase tracking-[0.2em]"
                  style={{ color: '#fde9a5' }}>istanbul</span>
          </Link>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2">
              <LanguageSwitcher />
              <WsConnectionBadge />
              {/* Header expandable tabs — Ana Sayfa / Bildirimler / Ayarlar */}
              <HeaderActions onTabChange={onTabChange} role={user?.role} />
            </div>

            {/* FAZ 5.9 — Public profil linki (sadece BUSINESS_OWNER) */}
            {isBusiness && bizProfile?.id && (
              <a
                href={`/p/business/${bizProfile.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Public profilini yeni sekmede ac"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-full transition-all hover:-translate-y-0.5"
                style={{
                  background: 'rgba(212, 168, 83, 0.15)',
                  color: '#fde9a5',
                  border: '1px solid rgba(212, 168, 83, 0.30)',
                }}
              >
                Public Profilim
              </a>
            )}

            {/* Logout — kompakt buton */}
            <button onClick={handleLogout}
              className="hidden sm:inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.20), rgba(185, 28, 28, 0.30))',
                color: '#fca5a5',
                border: '1px solid rgba(220, 38, 38, 0.30)',
              }}>
              Çıkış
            </button>

            {/* FAZ 6.1 — Mobile + tablet menu trigger (lg breakpoint altinda gozukur) */}
            <button onClick={() => setMobileMenuOpen(o => !o)}
              className="lg:hidden p-2 rounded-full"
              style={{ background: 'rgba(212, 168, 83, 0.15)' }}
              aria-label="Menü">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Alt satır: yatay tab strip (desktop) — hover'da decrypt effect */}
        <nav className="hidden lg:flex items-center gap-2 px-8 pb-1 -mt-1" aria-label="Ana navigasyon">
          {navItems.map(item => (
            <NavTabButton
              key={item.id}
              item={item}
              active={activeTab === item.id}
              onClick={() => onTabChange?.(item.id)}
              t={t}
            />
          ))}
        </nav>

        {/* FAZ 6.1 — Mobile + tablet menu drawer (lg breakpoint altinda) */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t" style={{ borderColor: 'rgba(212, 168, 83, 0.15)' }}>
            <nav className="px-4 py-3 space-y-1" aria-label="Mobil navigasyon">
              {navItems.map(item => {
                const active = activeTab === item.id
                return (
                  <button key={item.id}
                    onClick={() => { onTabChange?.(item.id); setMobileMenuOpen(false) }}
                    className="w-full text-left px-3 py-2.5 rounded-lg font-geist text-[15px] transition-all"
                    style={{
                      background: active ? 'rgba(212, 168, 83, 0.18)' : 'transparent',
                      color: active ? '#ffffff' : '#fde9a5',
                      fontWeight: active ? 600 : 500,
                      letterSpacing: '-0.005em',
                    }}>
                    {item.tKey ? t(item.tKey) : item.label}
                  </button>
                )
              })}
              <div className="pt-3 mt-2 border-t flex items-center justify-between gap-2"
                   style={{ borderColor: 'rgba(212, 168, 83, 0.15)' }}>
                <LanguageSwitcher />
                <NotificationBell onNavigate={(link) => onTabChange?.(link)} />
                <SettingsMenu onTabChange={onTabChange} />
                <button onClick={handleLogout}
                  className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(220, 38, 38, 0.20)',
                    color: '#fca5a5',
                    border: '1px solid rgba(220, 38, 38, 0.30)',
                  }}>
                  Çıkış
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* === Page Content === */}
      <main className="relative z-10 fade-in" style={{ color: '#dde7f3' }}>
        <EmailVerifyBanner />

        {/* Page heading strip — Geist semibold, sade premium */}
        <div className="px-4 lg:px-8 pt-5 lg:pt-8 pb-3 flex items-end justify-between gap-3 flex-wrap">
          <h1 className="font-geist text-2xl sm:text-3xl lg:text-[36px] text-white"
              style={{
                fontWeight: 600,
                letterSpacing: '-0.02em',
                textShadow: '0 0 24px rgba(212, 168, 83, 0.20)',
              }}>
            {(() => {
              const item = navItems.find(n => n.id === activeTab)
              return item ? (item.tKey ? t(item.tKey) : item.label) : 'Panel'
            })()}
          </h1>
          {/* Her tab'a unique mini badge (page kimligi) */}
          <PageAccent tab={activeTab} role={user?.role} />
        </div>

        <div className="px-4 lg:px-8 pb-24 md:pb-20 lg:pb-12 text-[14px]">
          {children}
        </div>
      </main>

      {/* FAZ G.1 — Mobil bottom tab bar (md:hidden inside) */}
      <BottomTabBar
        navItems={navItems}
        activeTab={activeTab}
        onTabChange={onTabChange}
        role={user?.role}
      />
    </div>
  )
}

/* Desktop yatay nav tab — hover'da DecryptEffect tetiklenir */
function NavTabButton({ item, active, onClick, t }) {
  const [hover, setHover] = useState(false)
  const label = item.tKey ? t(item.tKey) : item.label
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="relative px-4 py-3 text-[14px] transition-all font-geist"
      style={{
        color: active ? '#ffffff' : '#8ba9d2',
        fontWeight: active ? 600 : 500,
        letterSpacing: '-0.005em',
        textShadow: active ? '0 0 12px rgba(212, 168, 83, 0.45)' : 'none',
      }}
      aria-current={active ? 'page' : undefined}>
      <DecryptEffect text={label} active={hover && !active} />
      {active && (
        <span
          aria-hidden
          className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, #d4a853, transparent)' }}
        />
      )}
    </button>
  )
}

/* Header sağ aksiyon barı — Ana Sayfa / Bildirimler / Ayarlar */
function HeaderActions({ onTabChange, role }) {
  const { data: unread = 0 } = useQuery({
    queryKey: keys.notifications.unreadCount(),
    queryFn: () => hotelApi.getUnreadNotificationCount(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    enabled: !!role,
  })

  // Role'e göre Ana Sayfa tab id'si — hepsi 'overview' aslında
  // Ayarlar tabı: aday + işletme için 'profile'; admin'de profile yok → 'overview'
  const homeId    = 'overview'
  const notifId   = role === 'ADMIN' ? 'audit' : 'messages'
  const settingsId = role === 'ADMIN' ? 'overview' : 'profile'

  const tabs = [
    { title: 'Ana Sayfa',   icon: tabIcons.home },
    { title: 'Bildirimler', icon: tabIcons.bell, badge: unread },
    { title: 'Ayarlar',     icon: tabIcons.settings },
  ]

  function handle(idx) {
    if (idx == null) return
    if (idx === 0) onTabChange?.(homeId)
    else if (idx === 1) onTabChange?.(notifId)
    else if (idx === 2) onTabChange?.(settingsId)
  }

  return <ExpandableTabs tabs={tabs} onChange={handle} />
}

/* Role'e gore dashboard kok path'i — logo click hedefi */
function dashboardHomeFor(role) {
  switch (role) {
    case 'ADMIN':          return '/admin'
    case 'BUSINESS_OWNER': return '/business'
    case 'CANDIDATE':      return '/candidate'
    default:               return '/'
  }
}

/* Her tab icin kucuk farkli kimlik elementi (sayfa kimligi) */
function PageAccent({ tab, role }) {
  const accents = {
    overview:     { label: 'Anlık', color: '#d4a853' },
    listings:     { label: 'Aktif İlanlar', color: '#d4a853' },
    applications: { label: 'Aday Süreci', color: '#f7c43c' },
    documents:    { label: 'Cüzdan', color: '#f7c43c' },
    messages:     { label: 'Sohbetler', color: '#d4a853' },
    mylistings:   { label: 'Yayınlarım', color: '#f7c43c' },
    workers:      { label: 'Ekibim', color: '#f7c43c' },
    profile:      { label: 'Profil', color: '#d4a853' },
    history:      { label: 'Geçmiş', color: '#fde9a5' },
    users:        { label: 'Kullanıcılar', color: '#d4a853' },
    reports:      { label: 'Raporlar', color: '#fbbf24' },
    audit:        { label: 'Audit Log', color: '#22d3ee' },
  }
  const a = accents[tab] || { label: '—', color: '#8ba9d2' }
  return (
    <div className="flex items-center gap-2 px-3 py-1 rounded-full"
         style={{
           background: `${a.color}10`,
           border: `1px solid ${a.color}30`,
         }}>
      <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: a.color }} />
      <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: a.color }}>
        {a.label}
      </span>
    </div>
  )
}
