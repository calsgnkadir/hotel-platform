import { useState, useEffect, useRef, useCallback } from 'react'
import * as hotelApi from '../api/hotel'

const TYPE_ICON = {
  APPLICATION_ACCEPTED:  '✅',
  APPLICATION_REJECTED:  '❌',
  DOCUMENT_REQUEST:      '📄',
  NO_SHOW_MARKED:        '⛔',
  AUTO_BANNED:           '🚫',
  NEW_APPLICATION:       '📋',
  APPLICATION_WITHDRAWN: '↩️',
  DOCUMENT_GRANTED:      '🔓',
  DOCUMENT_DENIED:       '🔒',
  GENERIC:               '🔔',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'şimdi'
  if (min < 60) return `${min} dk önce`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} saat önce`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} gün önce`
  return new Date(dateStr).toLocaleDateString('tr-TR')
}

/**
 * Header'da zil ikonu + okunmamış sayacı + dropdown.
 * @param {function} onNavigate - bildirime tıklanınca sekme değiştirir (link string)
 */
export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  const fetchUnread = useCallback(async () => {
    try {
      const count = await hotelApi.getUnreadNotificationCount()
      setUnread(count)
    } catch { /* sessiz */ }
  }, [])

  // İlk yükleme + 30sn polling
  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [fetchUnread])

  // Dışına tıklayınca kapat
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next) {
      setLoading(true)
      try {
        const data = await hotelApi.getNotifications(20)
        setItems(data)
        // Sayacı da tazele (30sn poll'u bekleme)
        fetchUnread()
      } catch { /* sessiz */ }
      finally { setLoading(false) }
    }
  }

  async function handleItemClick(n) {
    if (!n.isRead) {
      try {
        await hotelApi.markNotificationRead(n.id)
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
        setUnread(u => Math.max(0, u - 1))
      } catch { /* sessiz */ }
    }
    if (n.link && onNavigate) {
      onNavigate(n.link)
      setOpen(false)
    }
  }

  async function handleMarkAll() {
    try {
      await hotelApi.markAllNotificationsRead()
      setItems(prev => prev.map(x => ({ ...x, isRead: true })))
      setUnread(0)
    } catch { /* sessiz */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggleOpen}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
        title="Bildirimler">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-semibold text-slate-800 text-sm">Bildirimler</span>
            {unread > 0 && (
              <button onClick={handleMarkAll}
                className="text-xs font-medium text-violet-600 hover:text-violet-800">
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-10 flex justify-center"><div className="spinner" /></div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                <div className="text-3xl mb-2">📭</div>
                Henüz bildirim yok
              </div>
            ) : (
              items.map(n => (
                <button key={n.id} onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors flex gap-3
                    ${!n.isRead ? 'bg-violet-50/40' : ''}`}>
                  <span className="text-lg flex-shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${!n.isRead ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      {n.title}
                    </div>
                    {n.message && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-violet-500 flex-shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
