import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { wsOnStatusChange, wsIsConnected } from './websocket'

/**
 * FAZ 4.8 — React tarafında WS bağlantı durumunu izleyen hook.
 *
 * Kullanım:
 *   const wsOk = useWsConnected()
 *   useQuery({ ..., refetchInterval: wsOk ? false : 30000 })
 *
 * WS bağlı iken polling KAPALI (network/back-end yük yok).
 * WS koparsa polling otomatik devreye girer (kullanıcı eksik veri görmesin).
 * Hook sadece bir global listener kullanır — render maliyeti yok.
 */
export default function useWsConnected() {
  const [connected, setConnected] = useState(wsIsConnected())

  useEffect(() => {
    const off = wsOnStatusChange(setConnected)
    return off
  }, [])

  return connected
}

/**
 * FAZ 4.8 — Bonus: WS koparıp tekrar bağlanınca tek seferlik invalidate.
 *
 * Senaryosu: kullanıcı offline → mesaj kaçırdı → online olunca pencere
 * focus'tayken WS reconnect olur. STOMP replay yapmaz; biz invalidate ile
 * eksik veriyi REST üzerinden çekeriz.
 *
 * Kullanım:
 *   useWsReconnectInvalidate([
 *     keys.conversations.list(),
 *     keys.notifications.unreadCount(),
 *   ])
 */
export function useWsReconnectInvalidate(queryKeys) {
  const queryClient = useQueryClient()
  const prevConnectedRef = useRef(wsIsConnected())

  useEffect(() => {
    const off = wsOnStatusChange((nowConnected) => {
      // Sadece false → true geçişinde tetikle (initial true atlanır)
      if (nowConnected && !prevConnectedRef.current) {
        queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key })
        })
      }
      prevConnectedRef.current = nowConnected
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

