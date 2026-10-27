import { useAuth } from '../context/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import { ROLE, topNavFor, mobileBarFor, tabLabel, panelPathFor } from '../lib/navigation'
import EmailVerifyBanner from './EmailVerifyBanner'
import NotificationBell from './NotificationBell'
import MessagesButton from './MessagesButton'
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
  menu:         <><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></>,
  external:     <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  heart:        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  eye:          <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  card:         <><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></>,
  bookmark:     <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>,
  clock:        <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
}

export function NavIcon(props) { return <Icon {...props} /> }

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

export default function DashboardLayout({ children, activeTab, onTabChange }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const role        = user?.role
  const navItems    = topNavFor(role)
  const barItems    = mobileBarFor(role)
  const hasMessages = role === ROLE.CANDIDATE || role === ROLE.BUSINESS

  function handleTabClick(id) { onTabChange?.(id) }

  /* Bildirim linki iki biçimde gelir: tam adres ("/listings/42") ya da panel
     sekme id'si ("applications"). Tam adres router ile açılır; sekme id'si
     panelin sekme değiştiricisine gider (geçersiz id'yi panel reddeder). */
  function handleNotificationLink(link) {
    if (!link || typeof link !== 'string') return
    if (link.startsWith('/')) { navigate(link); return }
    onTabChange?.(link)
  }

  // Başlık tek kaynaktan (lib/navigation.js): üst nav, menü ve mesaj sekmeleri dahil
  const currentTitle = tabLabel(role, activeTab) || 'Panel'

  return (
    <div className="min-h-screen relative ah-surface" style={{ background: 'var(--ah-page)' }}>
      {/* === ÜST BAŞLIK ===
          z-40: <main> z-index'li değil; içerikteki z-30'a kadar katmanlar üst
          menünün altında kalır, z-50+ pencereler (modal z-1000, ConfirmDialog z-50,
          CommandPalette z-100) üstüne çıkar. */}
      {/* Beyaz zemin + alt çizgi tam genişlikte; içerik .ah-container (1440px)
          ile sayfa başlığı ve gövdeyle aynı sütuna hizalanır. */}
      <header className="sticky top-0 z-40 border-b"
              style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="ah-container">
          <div className="min-h-14 flex flex-wrap items-center gap-x-4">
            <Link to={panelPathFor(role)} className="flex items-baseline gap-2 flex-shrink-0">
              <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.02em', color: 'var(--ah-ink)' }}>Kadrom</span>
              <span className="hidden sm:inline" style={{ fontSize: 12, fontWeight: 500, color: 'var(--ah-ink-3)' }}>İstanbul</span>
            </Link>

            {/* Tablette sekmeler ayrı satırda sarılır; geniş ekranda başlığa katılır. */}
            <nav className="hidden md:flex order-last w-full flex-wrap items-center gap-1 py-2 xl:order-none xl:w-auto xl:flex-1 xl:py-0" aria-label="Ana navigasyon">
              {navItems.map(item => (
                <TopNavItem key={item.id}
                            item={item}
                            active={activeTab === item.id}
                            onClick={() => handleTabClick(item.id)} />
              ))}
            </nav>
            <div className="flex-1 xl:hidden" />

            {/* Sağ eylemler — her biri 44px vuruş alanı + aria-label */}
            <div className="flex min-h-14 items-center gap-1 flex-shrink-0">
              {hasMessages && (
                <MessagesButton active={activeTab === 'messages'}
                                onClick={() => handleTabClick('messages')} />
              )}
              <NotificationBell onNavigate={handleNotificationLink} />
              <SettingsMenu onTabChange={onTabChange} activeTab={activeTab} />
            </div>
          </div>
        </div>
      </header>

      {/* === İÇERİK ===
          Bilerek z-index / position yok (modal karartması sticky başlığın altına
          hapsolmasın). Mobilde alt sekme çubuğu kadar alt boşluk bırakılır. */}
      <main className="fade-in" style={{ color: 'var(--ah-ink-2)' }}>
        {/* Bant kendi mx-4/lg:mx-8 boşluğunu taşır; 1440px kaba ortalanır ki
            geniş ekranda başlık ve içerikle aynı sol hizada dursun. */}
        <div className="max-w-[1440px] mx-auto">
          <EmailVerifyBanner />
        </div>

        {/* Sayfa başlığı — mobilde görsel olarak gizli (alt çubuk hangi sayfada
            olunduğunu gösterir); ekran okuyucu için her zaman var. */}
        <div className="ah-container pt-3 md:pt-6 lg:pt-8 md:pb-5">
          <h1 className="sr-only md:not-sr-only type-page" style={{ color: 'var(--ah-ink)' }}>
            {currentTitle}
          </h1>
        </div>

        <div className={`ah-container ${barItems.length ? 'pb-28 md:pb-16' : 'pb-16'}`}>
          {children}
        </div>
      </main>

      {/* === MOBİL ALT SEKME ÇUBUĞU === (md altı; her öğe en az 44px) */}
      {barItems.length > 0 && (
        <nav className="ah-tabbar md:hidden" aria-label="Ana navigasyon (mobil)">
          {barItems.map(item => {
            const active = activeTab === item.id
            return (
              <button key={item.id} type="button"
                      onClick={() => handleTabClick(item.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`ah-tabbar__item${active ? ' is-active' : ''}`}>
                <Icon name={item.icon} size={20} active={active} />
                <span className="ah-tabbar__label">{item.label}</span>
              </button>
            )
          })}
        </nav>
      )}
    </div>
  )
}

/* ───────── TopNavItem — yatay pill (aktif = teal soft bg) ───────── */
function TopNavItem({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="relative flex flex-shrink-0 min-h-11 items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors"
      style={{
        background: active ? 'var(--ah-brand-soft)' : 'transparent',
        color: active ? 'var(--ah-brand)' : 'var(--ah-ink-2)',
        fontWeight: active ? 600 : 500,
        fontSize: 14,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--ah-band)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}>
      <span style={{ color: active ? 'var(--ah-brand)' : 'var(--ah-ink-4)', display: 'inline-flex' }}>
        <Icon name={item.icon} size={16} active={active} />
      </span>
      {item.label}
    </button>
  )
}
