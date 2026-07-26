import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as hotelApi from '../api/hotel'
import { keys } from '../lib/queryClient'
import { wsSubscribe } from '../lib/websocket'
import useWsConnected from '../lib/useWsConnected'

/**
 * FAZ 26 — Header'da mesajlar ikonu (bildirim zili ile yan yana).
 * Sol sidebar kaldirildi; Mesajlar artık sag ust ikon + okunmamıs rozeti.
 */
export default function MessagesButton({ active, onClick }) {
  const queryClient = useQueryClient()
  const wsOk = useWsConnected()

  const { data: unread = 0 } = useQuery({
    queryKey: keys.conversations.unreadCount(),
    queryFn: hotelApi.getMessagesUnreadCount,
    refetchInterval: wsOk ? false : 60_000,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  })

  // WS: yeni mesaj gelince rozeti tazele
  useEffect(() => {
    const sub = wsSubscribe('/user/queue/messages', () => {
      queryClient.invalidateQueries({ queryKey: keys.conversations.unreadCount() })
    })
    return () => sub.unsubscribe()
  }, [queryClient])

  return (
    <button
      onClick={onClick}
      className="relative w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      style={{
        background: active ? 'var(--ah-brand-soft)' : 'var(--ah-page)',
        color: active ? 'var(--ah-brand)' : 'var(--ah-ink-2)',
      }}
      title="Mesajlar"
      aria-label={unread > 0 ? `Mesajlar — ${unread} okunmamış` : 'Mesajlar'}
      aria-current={active ? 'page' : undefined}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4"
           fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-white text-[9px] font-black flex items-center justify-center"
              style={{ background: 'var(--ah-danger)', boxShadow: '0 0 0 2px var(--ah-card)' }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
