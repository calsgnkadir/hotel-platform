import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'

const candidateNav = [
  { id: 'overview',      label: 'Genel Bakış' },
  { id: 'listings',      label: 'İlanlar' },
  { id: 'applications',  label: 'Başvurularım' },
  { id: 'history',       label: 'Geçmiş İşlerim' },
  { id: 'messages',      label: 'Mesajlar' },
  { id: 'documents',     label: 'Belgelerim' },
  { id: 'profile',       label: 'Profilim' },
]

const businessNav = [
  { id: 'overview',      label: 'Genel Bakış' },
  { id: 'mylistings',    label: 'İlanlarım' },
  { id: 'applications',  label: 'Gelen Başvurular' },
  { id: 'workers',       label: 'Bizde Çalışanlar' },
  { id: 'messages',      label: 'Mesajlar' },
  { id: 'profile',       label: 'İşletme Profili' },
]

const adminNav = [
  { id: 'overview', label: 'Genel Bakış' },
  { id: 'users',    label: 'Kullanıcılar' },
  { id: 'reports',  label: 'Şikayetler' },
  { id: 'audit',    label: 'İşlem Geçmişi' },
]

export default function DashboardLayout({ children, activeTab, onTabChange }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isCandidate = user?.role === 'CANDIDATE'
  const isAdmin = user?.role === 'ADMIN'
  const navItems = isAdmin ? adminNav : (isCandidate ? candidateNav : businessNav)

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex bg-ink-900 dark:bg-ink-900">
      {/* Neon üst hat */}
      <div className="fixed top-0 left-0 right-0 z-50 neon-strip pointer-events-none" />

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-300
        bg-ink-900 border-r border-slate-800
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <Link to="/" className="px-5 py-4 border-b border-slate-800 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center flex-shrink-0 shadow-glow-sm">
            <span className="text-white text-sm font-black">A</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-white">AjansHotel</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">İş Platformu</div>
          </div>
        </Link>

        {/* User Info */}
        <div className="px-3 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 rounded-2xl p-2.5 bg-slate-900/60 border border-slate-800">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 bg-gradient-to-br from-brand-500 to-brand-700">
              {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate text-white">{user?.fullName}</div>
              <div className="text-[10px] truncate text-slate-500">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onTabChange?.(item.id); setSidebarOpen(false) }}
              className={`nav-link w-full text-left text-[13px] ${activeTab === item.id ? 'active' : ''}`}
            >
              <span className="flex-1 truncate">{item.label}</span>
              {activeTab === item.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-glow-pulse flex-shrink-0" />
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-slate-800">
          <button onClick={handleLogout}
            className="nav-link w-full text-left text-[13px] text-red-400 hover:bg-red-950/40 hover:text-red-300">
            <span>Çıkış Yap</span>
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
        {/* Top Bar */}
        <header className="px-4 lg:px-8 py-3.5 flex items-center justify-between sticky top-0.5 z-20
                           bg-ink-900/85 backdrop-blur-lg border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-full hover:bg-slate-800 transition-colors">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-white">
                {navItems.find(n => n.id === activeTab)?.label || 'Panel'}
              </h1>
              <p className="text-[11px] hidden sm:block text-slate-500 uppercase tracking-wider">
                {isAdmin ? 'Admin Paneli' : isCandidate ? 'Aday Paneli' : 'İşletme Paneli'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell onNavigate={(link) => onTabChange?.(link)} />

            {/* Role badge */}
            <div className={`hidden sm:flex items-center px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border
              ${isAdmin
                ? 'bg-amber-950/40 text-amber-300 border-amber-900/60'
                : isCandidate
                  ? 'bg-brand-900/40 text-brand-300 border-brand-900/60'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60'}`}>
              {isAdmin ? 'Admin' : isCandidate ? 'Aday' : 'İşletme'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-8 fade-in text-slate-300">
          {children}
        </main>
      </div>
    </div>
  )
}
