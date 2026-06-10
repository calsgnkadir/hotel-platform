import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as hotelApi from '../api/hotel'
import { keys } from '../lib/queryClient'

// Her bildirim tipi için sol kenarda küçük renkli "dot" — emoji yerine sade gösterim
const TYPE_COLOR = {
  APPLICATION_ACCEPTED:  'bg-brand-500',
  APPLICATION_REJECTED:  'bg-red-500',
  DOCUMENT_REQUEST:      'bg-blue-500',
  NO_SHOW_MARKED:        'bg-orange-500',
  AUTO_BANNED:           'bg-red-600',
  NEW_APPLICATION:       'bg-brand-600',
  APPLICATION_WITHDRAWN: 'bg-slate-400',
  DOCUMENT_GRANTED:      'bg-brand-500',
  DOCUMENT_DENIED:       'bg-red-500',
  MATCHING_LISTING:      'bg-brand-600',
  NEW_MESSAGE:           'bg-blue-500',
  GENERIC:               'bg-cream-500',
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
// Ayarlar sekmesinden gelen "mute" flag'ı
function isMuted() {
  try { return localStorage.getItem('ajanshotel.notifications.muted') === '1' }
  catch { return false }
}

export default function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [muted, setMuted] = useState(isMuted())
  const ref = useRef(null)
  const queryClient = useQueryClient()

  // F0.10 — react-query ile unread count: tab focus'ta otomatik refetch,
  // 30sn polling, mute durumunda enabled=false (request yok)
  const { data: unread = 0 } = useQuery({
    queryKey: keys.notifications.unreadCount(),
    queryFn: () => hotelApi.getUnreadNotificationCount(),
    enabled: !muted,
    refetchInterval: muted ? false : 30_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  })

  // Ayarlar'dan mute değişince anında uygula
  useEffect(() => {
    const handler = () => {
      const m = isMuted()
      setMuted(m)
      if (m) {
        // Mute olunca cache'i temizle
        queryClient.setQueryData(keys.notifications.unreadCount(), 0)
      } else {
        // Mute kapanınca anında refetch
        queryClient.invalidateQueries({ queryKey: keys.notifications.unreadCount() })
      }
    }
    window.addEventListener('ajanshotel:notifications-muted-changed', handler)
    return () => window.removeEventListener('ajanshotel:notifications-muted-changed', handler)
  }, [queryClient])

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
        className="relative w-8 h-8 rounded-full flex items-center justify-center transition-all
                   bg-cream-100 hover:bg-cream-200 text-ink-700
                   dark:bg-ink-700/80 dark:hover:bg-slate-700 dark:text-ink-800
                   hover:scale-105 active:scale-95"
        title="Bildirimler">
        {/* Inbox / kutucuk + dalga — özgün notification ikonu */}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4"
             fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 13 L8 13 L9.5 15.5 L14.5 15.5 L16 13 L21 13" />
          <path d="M5 5 L19 5 L21 13 L21 18 A1.5 1.5 0 0 1 19.5 19.5 L4.5 19.5 A1.5 1.5 0 0 1 3 18 L3 13 Z" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-ink-900 dark:ring-ink-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl shadow-xl z-50 overflow-hidden
                        bg-white border border-cream-300
                        dark:bg-ink-800 dark:border-ink-700">
          <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200 dark:border-cream-300">
            <span className="font-semibold text-sm text-ink-800 dark:text-ink-900">Bildirimler</span>
            {unread > 0 && (
              <button onClick={handleMarkAll}
                className="text-xs font-medium text-brand-700 dark:text-brand-700 hover:underline">
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="py-10 flex justify-center"><div className="spinner" /></div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center text-ink-400 dark:text-ink-500 text-sm">
                Henüz bildirim yok
              </div>
            ) : (
              items.map(n => (
                <button key={n.id} onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-4 py-3 border-b transition-colors flex gap-3 items-start
                              border-slate-50 hover:bg-cream-50
                              dark:border-cream-300 dark:hover:bg-slate-800
                              ${!n.isRead ? 'bg-brand-50/40 dark:bg-brand-900/20' : ''}`}>
                  {/* Sol: tip renkli küçük dot */}
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${TYPE_COLOR[n.type] || 'bg-slate-400'}`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${!n.isRead ? 'font-semibold text-ink-800 dark:text-ink-900' : 'text-ink-600 dark:text-ink-300'}`}>
                      {n.title}
                    </div>
                    {n.message && <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-2">{n.message}</div>}
                    <div className="text-[11px] text-ink-400 dark:text-ink-500 mt-1">{timeAgo(n.createdAt)}</div>
                  </div>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-600 dark:bg-brand-400 flex-shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
