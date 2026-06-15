/**
 * FAZ 1/#12+#22 — WebSocket client (STOMP over SockJS).
 *
 * Singleton STOMP client + subscription registry.
 * - Connect: JWT header ile
 * - Auto-reconnect (5sn interval)
 * - Subscribe registry (component unmount'ta clean)
 *
 * Kullanım:
 *   import { wsConnect, wsSubscribe, wsPublish, wsDisconnect } from './websocket'
 *   wsConnect()
 *   const sub = wsSubscribe('/user/queue/messages', (payload) => { ... })
 *   sub.unsubscribe()
 */
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

let client = null
let connected = false
let pendingSubs = []  // bağlanmadan önce sub ister isen, buraya kuyruğa al

// FAZ 4.8 — Bağlantı durumu için listener registry.
// React tarafında useWsConnected() bunu izler; WS aktif olunca polling kapanır.
const statusListeners = new Set()
function notifyStatus() {
  statusListeners.forEach(cb => { try { cb(connected) } catch {} })
}
export function wsOnStatusChange(cb) {
  statusListeners.add(cb)
  // İlk subscribe'da mevcut durumu hemen ver (state init için)
  try { cb(connected) } catch {}
  return () => statusListeners.delete(cb)
}

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '')
const WS_URL = `${BASE_URL}/ws`

function getToken() {
  return localStorage.getItem('token')
}

export function wsConnect() {
  if (client && (client.connected || client.active)) return  // zaten bağlı/bağlanıyor

  const token = getToken()
  if (!token) {
    console.warn('[WS] Token yok, bağlanma atlandı')
    return
  }

  client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    reconnectDelay: 5000,      // 5sn sonra otomatik yeniden bağlan
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},            // log spam kapalı (DEV'de istersen aç)

    onConnect: () => {
      connected = true
      console.log('[WS] Bağlandı')
      // Bekleyen sub'ları gerçekle
      pendingSubs.forEach(({ destination, callback, ref }) => {
        ref.sub = client.subscribe(destination, (msg) => {
          try {
            const data = JSON.parse(msg.body)
            callback(data)
          } catch {
            callback(msg.body)
          }
        })
      })
      pendingSubs = []
      notifyStatus()  // React hooks'ları haberdar et → polling kapanır
    },

    onStompError: (frame) => {
      console.warn('[WS] STOMP error:', frame.headers?.message || frame)
    },

    onWebSocketError: (e) => {
      console.warn('[WS] Socket error:', e?.message || e)
    },

    onDisconnect: () => {
      connected = false
      console.log('[WS] Bağlantı kesildi')
      notifyStatus()  // React hooks'ları haberdar et → polling devreye girer
    },

    onWebSocketClose: () => {
      // SockJS transport kapanışı — onDisconnect her zaman tetiklenmez
      if (connected) {
        connected = false
        notifyStatus()
      }
    },
  })

  client.activate()
}

export function wsDisconnect() {
  if (client) {
    try { client.deactivate() } catch {}
    client = null
    connected = false
    pendingSubs = []
  }
}

/**
 * Subscribe — bağlı değilse kuyruğa alır, bağlanınca otomatik abone olur.
 * Return: { unsubscribe() } — daima çağrılabilir, idempotent.
 */
export function wsSubscribe(destination, callback) {
  const ref = { sub: null, cancelled: false }

  if (client && connected) {
    ref.sub = client.subscribe(destination, (msg) => {
      try {
        const data = JSON.parse(msg.body)
        callback(data)
      } catch {
        callback(msg.body)
      }
    })
  } else {
    // Bekleyen kuyruğa
    pendingSubs.push({ destination, callback, ref })
  }

  return {
    unsubscribe() {
      ref.cancelled = true
      if (ref.sub) {
        try { ref.sub.unsubscribe() } catch {}
        ref.sub = null
      }
      // Pending'den de çıkar
      pendingSubs = pendingSubs.filter(p => p.ref !== ref)
    },
  }
}

/**
 * Client → server publish (örn: typing sinyali).
 */
export function wsPublish(destination, body = {}) {
  if (!client || !connected) {
    console.warn('[WS] Publish atlandi - baglanti yok:', destination)
    return
  }
  try {
    client.publish({
      destination,
      body: JSON.stringify(body),
    })
    console.log('[WS] Publish:', destination)
  } catch (e) {
    console.warn('[WS] Publish failed:', e?.message)
  }
}

export function wsIsConnected() {
  return connected
}
