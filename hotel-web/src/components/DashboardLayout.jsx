import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import NotificationBell from './NotificationBell'

const candidateNav = [
  { id: 'overview',      label: 'Genel Bakış' },
  { id: 'listings',      label: 'İlanlar' },
  { id: 'applications',  label: 'Başvurularım' },
  { id: 'documents',     label: 'Belgelerim' },
  { id: 'profile',       label: 'Profilim' },
]

const businessNav = [
  { id: 'overview',      label: 'Genel Bakış' },
  { id: 'mylistings',    label: 'İlanlarım' },
  { id: 'applications',  label: 'Gelen Başvurular' },
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
    <div className="min-h-screen flex">

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 shadow-sm
        flex flex-col transform transition-transform duration-300
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="px-6 py-5 border-b border-slate-800">
          <div className="text-base font-bold text-white tracking-tight">AjansHotel</div>
          <div className="text-xs text-slate-400">İş Platformu</div>
        </div>

        {/* User Info */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3 bg-slate-800 rounded-xl p-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              {user?.fullName?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user?.fullName}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onTabChange?.(item.id); setSidebarOpen(false) }}
              className={`nav-link w-full text-left ${activeTab === item.id ? 'active' : ''}`}
            >
              <span>{item.label}</span>
              {activeTab === item.id && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-600"></span>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-800">
          <button onClick={handleLogout}
            className="nav-link w-full text-left text-red-400 hover:text-red-300 hover:bg-red-950/40">
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
        <header className="bg-slate-900 border-b border-slate-800 px-4 lg:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors">
              <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
            <div>
              <h1 className="text-base font-semibold text-white">
                {navItems.find(n => n.id === activeTab)?.label || 'Panel'}
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">
                AjansHotel · {isAdmin ? 'Admin Paneli' : isCandidate ? 'Aday Paneli' : 'İşletme Paneli'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Bildirim zili */}
            <NotificationBell onNavigate={(link) => onTabChange?.(link)} />

            {/* Role badge */}
            <div className={`hidden sm:flex items-center px-3 py-1.5 rounded-full text-xs font-semibold
              ${isAdmin ? 'bg-amber-500/20 text-amber-300'
                : isCandidate ? 'bg-violet-500/20 text-violet-300'
                : 'bg-emerald-500/20 text-emerald-300'}`}>
              {isAdmin ? 'Admin' : isCandidate ? 'Aday' : 'İşletme'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6 fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}
