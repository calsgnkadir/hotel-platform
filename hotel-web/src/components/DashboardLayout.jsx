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
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform transition-transform duration-300
        bg-white border-r border-slate-200
        dark:bg-slate-900 dark:border-slate-800
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <Link to="/" className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">AjansHotel</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">İş Platformu</div>
          </div>
        </Link>

        {/* User Info */}
        <div className="px-3 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 rounded-lg p-2.5 bg-slate-50 dark:bg-slate-800">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-brand-700">
              {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate text-slate-900 dark:text-slate-100">{user?.fullName}</div>
              <div className="text-[10px] truncate text-slate-500 dark:text-slate-400">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onTabChange?.(item.id); setSidebarOpen(false) }}
              className={`nav-link w-full text-left text-[13px] ${activeTab === item.id ? 'active' : ''}`}
            >
              <span>{item.label}</span>
              {activeTab === item.id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-700 dark:bg-brand-400"></span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-2 py-3 border-t border-slate-100 dark:border-slate-800">
          <button onClick={handleLogout}
            className="nav-link w-full text-left text-[13px] text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden"
             onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-20
                           bg-white border-b border-slate-200
                           dark:bg-slate-900 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <svg className="w-5 h-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {navItems.find(n => n.id === activeTab)?.label || 'Panel'}
              </h1>
              <p className="text-[11px] hidden sm:block text-slate-500 dark:text-slate-400">
                AjansHotel · {isAdmin ? 'Admin Paneli' : isCandidate ? 'Aday Paneli' : 'İşletme Paneli'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell onNavigate={(link) => onTabChange?.(link)} />

            {/* Role badge */}
            <div className={`hidden sm:flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold
              ${isAdmin
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                : isCandidate
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
              {isAdmin ? 'Admin' : isCandidate ? 'Aday' : 'İşletme'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 fade-in text-slate-800 dark:text-slate-200">
          {children}
        </main>
      </div>
    </div>
  )
}
