import { useTranslation } from 'react-i18next'

/**
 * FAZ G.1 — Mobil bottom tab bar (md:hidden).
 *
 * LinkedIn / Instagram pattern: alt sticky 5 öğe, başparmak menzilinde.
 * BIZ için ortada Conditional FAB ("+ Yeni İlan" — mylistings'e gider,
 * orada onun "Yeni İlan" butonu modali açacak).
 *
 * Üst nav (header) lg+ ekranlarda kalır; bu bar sadece mobil/tablet'te
 * görünür ve drawer ile alternatif değil, eş zamanlı çalışır (drawer
 * hâlâ 6+ tab'a erişim için, bottom bar sık kullanılanlara hızlı geçiş).
 */
export default function BottomTabBar({ navItems, activeTab, onTabChange, role, unreadCount = 0 }) {
  const { t } = useTranslation()

  // Mobilde 5 ana tab — fazlasını drawer'a bırak
  const visibleItems = navItems.slice(0, 5)
  const isBusiness = role === 'BUSINESS_OWNER'

  // BIZ için 2. ve 3. tab arasına FAB
  function renderItem(item) {
    const active = activeTab === item.id
    const isMessages = item.id === 'messages'
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onTabChange?.(item.id)}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-colors"
        style={{
          color: active ? 'var(--accent-action)' : '#94a3b8',
          minWidth: 0,
          position: 'relative',
        }}
        aria-current={active ? 'page' : undefined}>
        <TabIcon id={item.id} active={active} />
        <span style={{
          fontSize: 10,
          fontWeight: active ? 600 : 500,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          maxWidth: 60,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.tKey ? t(item.tKey) : item.label}
        </span>
        {isMessages && unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: '32%',
            background: 'var(--signal-coral)',
            color: '#fff',
            fontSize: 9,
            fontWeight: 700,
            borderRadius: 999,
            padding: '0 5px',
            minWidth: 16,
            height: 16,
            lineHeight: '16px',
            textAlign: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    )
  }

  return (
    <nav
      className="md:hidden no-print"
      aria-label="Alt navigasyon"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        background: 'rgba(12, 23, 38, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(205, 183, 143, 0.10)',
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        display: 'flex',
        alignItems: 'stretch',
      }}>
      {/* İlk 2 tab */}
      {visibleItems.slice(0, 2).map(renderItem)}

      {/* Conditional FAB — sadece BIZ */}
      {isBusiness && (
        <div className="flex-1 flex items-center justify-center" style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => onTabChange?.('mylistings')}
            aria-label="Yeni İlan"
            title="Yeni İlan"
            style={{
              position: 'relative',
              top: -14,
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #d4a853, #cdb78f)',
              color: '#13110f',
              border: 'none',
              boxShadow: '0 6px 20px rgba(205, 183, 143, 0.35), 0 0 0 4px rgba(12, 23, 38, 0.85)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* Geri kalan tab'lar (BIZ için 2. konumdan sonra 3 tab, aday/admin için 3 tab) */}
      {visibleItems.slice(2, isBusiness ? 5 : 5).map(renderItem)}
    </nav>
  )
}

/** Tab id → SVG ikon eşlemesi (Heroicons stroke). */
function TabIcon({ id, active }) {
  const stroke = 'currentColor'
  const sw = active ? 2.2 : 1.8
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (id) {
    case 'overview':
      return <svg {...common}><path d="m2.25 12 8.954-8.955a1.5 1.5 0 0 1 2.121 0L22.28 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h4.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
    case 'listings':
    case 'mylistings':
      return <svg {...common}><path d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" /></svg>
    case 'applications':
      return <svg {...common}><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
    case 'documents':
      return <svg {...common}><path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
    case 'workers':
      return <svg {...common}><path d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>
    case 'messages':
      return <svg {...common}><path d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
    case 'analytics':
      return <svg {...common}><path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
    case 'profile':
      return <svg {...common}><path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
    case 'users':
      return <svg {...common}><path d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
    case 'reports':
      return <svg {...common}><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
    case 'audit':
      return <svg {...common}><path d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" /></svg>
    case 'outbox':
      return <svg {...common}><path d="m2.25 13.5 1.5-7.5h16.5l1.5 7.5M2.25 13.5h6l1.5 3h4.5l1.5-3h6M2.25 13.5v6.75A1.5 1.5 0 0 0 3.75 21.75h16.5a1.5 1.5 0 0 0 1.5-1.5v-6.75" /></svg>
    case 'favorites':
      return <svg {...common}><path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
    default:
      return <svg {...common}><circle cx="12" cy="12" r="3" /></svg>
  }
}
