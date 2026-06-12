import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import SettingsMenu from './SettingsMenu'
import LanguageSwitcher from './LanguageSwitcher'

// FAZ 1/#36 — Nav item id'leri i18n key'lerine map'lenir.
const candidateNav = [
  { id: 'overview',      tKey: 'nav.overview' },
  { id: 'listings',      tKey: 'nav.listings' },
  { id: 'applications',  tKey: 'nav.applications' },
  { id: 'documents',     tKey: 'nav.documents' },  // FAZ 2/#33 - Belgelerim
  { id: 'messages',      tKey: 'nav.messages' },
]

const businessNav = [
  { id: 'overview',      tKey: 'nav.overview' },
  { id: 'mylistings',    tKey: 'nav.myListings' },
  { id: 'applications',  tKey: 'nav.incomingApplications' },
  { id: 'workers',       tKey: 'nav.workers' },
  // FAZ 2/#32 — Favori Adaylar sekmesi sidebar'dan kaldirildi (kullanici istegi).
  //            Backend endpoint'leri ve modal'daki ⭐ toggle butonu calismaya devam ediyor.
  //            Sonradan baska bir tetikleyici (DirectInvite v2 vs.) ile geri eklenebilir.
  { id: 'messages',      tKey: 'nav.messages' },
]

const adminNav = [
  { id: 'overview', tKey: 'nav.overview' },
  { id: 'users',    tKey: 'nav.users' },
  { id: 'reports',  tKey: 'nav.reports' },
  { id: 'audit',    tKey: 'nav.audit' },
]

export default function DashboardLayout({ children, activeTab, onTabChange }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { t } = useTranslation()

  const isCandidate = user?.role === 'CANDIDATE'
  const isAdmin = user?.role === 'ADMIN'
  const navItems = isAdmin ? adminNav : (isCandidate ? candidateNav : businessNav)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-cream-100">
      {/* Neon üst hat (ince) */}
      <div className="fixed top-0 left-0 right-0 z-50 neon-strip pointer-events-none" />

      {/* ── Sidebar — FAZ 1/#40: 224 → 240px (w-56 → w-60) ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-60 flex flex-col transform transition-transform duration-300
        bg-cream-100 border-r border-cream-300
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand — logo'suz, sadece text */}
        <Link to="/" className="px-5 pt-5 pb-4 flex items-baseline gap-2">
          <span className="font-display text-[16px] font-bold tracking-tight text-ink-900">AjansHotel</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-ink-500">istanbul</span>
        </Link>

        {/* User Info — küçük + logosuz */}
        <div className="px-3 pb-3 border-b border-cream-300">
          <div className="rounded-xl px-3 py-2 bg-white border border-cream-300">
            <div className="text-[12px] font-semibold truncate text-ink-800">{user?.fullName}</div>
            <div className="text-[10px] truncate text-ink-500 mt-0.5">{user?.email}</div>
          </div>
        </div>

        {/* Nav — #42: nefes alma artirildi */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onTabChange?.(item.id); setSidebarOpen(false) }}
              className={`nav-link w-full text-left text-[13px] ${activeTab === item.id ? 'active' : ''}`}
              style={{ padding: '0.625rem 1rem' }}
            >
              <span className="flex-1 truncate">{item.tKey ? t(item.tKey) : item.label}</span>
              {activeTab === item.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-glow-pulse flex-shrink-0" />
              )}
            </button>
          ))}
        </nav>

        {/* Logout — belirgin, ikonlu */}
        <div className="px-2.5 py-3 border-t border-cream-300">
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-[13px] font-semibold rounded-lg px-3 py-2.5 text-white transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
             onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar — #42: padding artirildi */}
        <header className="px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0.5 z-20
                           bg-cream-100/85 backdrop-blur-lg border-b border-cream-300">
          <div className="flex items-center gap-2.5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-full hover:bg-cream-200 transition-colors">
              <svg className="w-4 h-4 text-ink-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div>
              <h1 className="font-display text-[15px] font-bold tracking-tight text-ink-900 leading-tight">
                {(() => {
                  const item = navItems.find(n => n.id === activeTab)
                  return item ? (item.tKey ? t(item.tKey) : item.label) : 'Panel'
                })()}
              </h1>
            </div>
          </div>

          {/* Sağ blok: dil + zil + ayarlar */}
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <NotificationBell onNavigate={(link) => onTabChange?.(link)} />
            <SettingsMenu onTabChange={onTabChange} />
          </div>
        </header>

        {/* Page Content — #42: padding ve text size artirildi (3→4 / 5→6 / 13→14)
            #41: pb-20 lg:pb-6 → mobilde bottom tab bar icin alt padding */}
        <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 fade-in text-ink-800 text-[14px]">
          {children}
        </main>
      </div>

      {/* FAZ 1/#41 — Bottom tab bar (sadece mobile, lg-) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-cream-100/95 backdrop-blur-lg border-t border-cream-300 px-1 pt-1.5 pb-2 safe-bottom">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {navItems.slice(0, 5).map(item => {
            const isActive = activeTab === item.id
            const icon = TAB_ICONS[item.id] || TAB_ICONS.default
            return (
              <button key={item.id}
                onClick={() => onTabChange?.(item.id)}
                className="flex flex-col items-center justify-center flex-1 py-1.5 rounded-xl transition-all"
                style={isActive ? {
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.18), rgba(168,85,247,0.10))',
                } : {}}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={isActive ? 2.2 : 1.8}
                     stroke={isActive ? '#6b21a8' : '#78716c'}
                     className="w-5 h-5 transition-all">
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                </svg>
                <span className={`text-[10px] font-semibold mt-0.5 transition-colors ${isActive ? 'text-brand-700' : 'text-ink-500'}`}>
                  {item.tKey ? t(item.tKey) : item.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

/* Tab bar icons (Heroicons outline) */
const TAB_ICONS = {
  overview:     'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  listings:     'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  mylistings:   'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  applications: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  documents:    'M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z',  // FAZ 2/#33 - belge ikonu
  workers:      'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  favorites:    'M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z',  // FAZ 2/#32 - star icon
  messages:     'M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
  users:        'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  reports:      'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  audit:        'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z',
  default:      'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
}
