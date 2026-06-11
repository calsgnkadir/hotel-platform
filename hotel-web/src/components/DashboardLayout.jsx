import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import SettingsMenu from './SettingsMenu'

// Ayarlar + Yardım + Profilim + Geçmiş İşlerim sidebar'dan kaldırıldı
// → hepsi header'daki ⚙ SettingsMenu dropdown'una taşındı.
const candidateNav = [
  { id: 'overview',      label: 'Genel Bakış' },
  { id: 'listings',      label: 'İlanlar' },
  { id: 'applications',  label: 'Başvurularım' },
  { id: 'messages',      label: 'Mesajlar' },
  // Belgelerim sekmesi kaldırıldı (chat-v2) — belgeler mesajlaşmada paylaşılır
]

const businessNav = [
  { id: 'overview',      label: 'Genel Bakış' },
  { id: 'mylistings',    label: 'İlanlarım' },
  { id: 'applications',  label: 'Gelen Başvurular' },
  { id: 'workers',       label: 'Bizde Çalışanlar' },
  { id: 'messages',      label: 'Mesajlar' },
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
    <div className="min-h-screen flex bg-cream-100">
      {/* Neon üst hat (ince) */}
      <div className="fixed top-0 left-0 right-0 z-50 neon-strip pointer-events-none" />

      {/* ── Sidebar ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-56 flex flex-col transform transition-transform duration-300
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

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { onTabChange?.(item.id); setSidebarOpen(false) }}
              className={`nav-link w-full text-left text-[12.5px] ${activeTab === item.id ? 'active' : ''}`}
              style={{ padding: '0.5rem 0.85rem' }}
            >
              <span className="flex-1 truncate">{item.label}</span>
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
        {/* Top Bar — sıkı + küçük */}
        <header className="px-4 lg:px-6 py-2.5 flex items-center justify-between sticky top-0.5 z-20
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
                {navItems.find(n => n.id === activeTab)?.label || 'Panel'}
              </h1>
            </div>
          </div>

          {/* Sağ blok: zil + ayarlar */}
          <div className="flex items-center gap-1.5">
            <NotificationBell onNavigate={(link) => onTabChange?.(link)} />
            <SettingsMenu onTabChange={onTabChange} />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 lg:p-5 fade-in text-ink-800 text-[13px]">
          {children}
        </main>
      </div>
    </div>
  )
}
