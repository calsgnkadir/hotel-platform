/**
 * FAZ 1/#12+#22 — WebSocket client (STOMP over SockJS).
 *
 * Singleton STOMP client + subscription registry.
 * - Connect: JWT header ile
 * - FAZ D.10: Exponential backoff reconnect (1s -> 2s -> ... -> 30s max)
 * - Tab visibilitychange: arka plandan ön plana gelince agresif reconnect dene
 * - State machine: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
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

// FAZ D.10 — connection state machine
const STATE = { IDLE: 'idle', CONNECTING: 'connecting', CONNECTED: 'connected', RECONNECTING: 'reconnecting', FAILED: 'failed' }
let connectionState = STATE.IDLE
let reconnectAttempts = 0
const MAX_RECONNECT_DELAY_MS = 30_000
const BASE_RECONNECT_DELAY_MS = 1_000

function computeBackoffDelay() {
  // 1, 2, 4, 8, 16, 30, 30, ... + 0-1000ms jitter
  const exp = Math.min(MAX_RECONNECT_DELAY_MS, BASE_RECONNECT_DELAY_MS * 2 ** Math.min(reconnectAttempts, 5))
  return exp + Math.floor(Math.random() * 1000)
}

// FAZ 4.8 + D.10 — Bağlantı durumu listener registry (artik state string'i de yayar)
const statusListeners = new Set()
function notifyStatus() {
  statusListeners.forEach(cb => { try { cb(connected, connectionState) } catch {} })
}

/**
 * cb(connected, state): boolean + 'idle'/'connecting'/'connected'/'reconnecting'/'failed'
 */
export function wsOnStatusChange(cb) {
  statusListeners.add(cb)
  try { cb(connected, connectionState) } catch {}
  return () => statusListeners.delete(cb)
}

export function wsGetState() { return connectionState }

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

  connectionState = STATE.CONNECTING
  notifyStatus()
  const initialDelay = computeBackoffDelay()

  client = new Client({
    webSocketFactory: () => new SockJS(WS_URL),
    connectHeaders: {
      Authorization: `Bearer ${token}`,
    },
    // FAZ D.10 — Stomp's own reconnectDelay (her fail'de bu degeri yeniden hesaplariz)
    reconnectDelay: initialDelay,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {},            // log spam kapalı (DEV'de istersen aç)

    onConnect: () => {
      connected = true
      connectionState = STATE.CONNECTED
      reconnectAttempts = 0     // Basarili — backoff sifirla
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
      notifyStatus()
    },

    onStompError: (frame) => {
      console.warn('[WS] STOMP error:', frame.headers?.message || frame)
    },

    onWebSocketError: (e) => {
      console.warn('[WS] Socket error:', e?.message || e)
    },

    onDisconnect: () => {
      connected = false
      // Asagidaki onWebSocketClose backoff arttirir
      notifyStatus()
    },

    onWebSocketClose: () => {
      // SockJS transport kapanışı — Stomp.js bunu auto-reconnect ile dener.
      // FAZ F.5: zaten RECONNECTING state'indeysek bu yeni close olayi sadece
      // Stomp'un kendi retry doneminin "artigi". attempt sayacini iki kez
      // arttirma; backoff zaten bir onceki close'ta ayarlandi.
      if (connectionState === STATE.RECONNECTING) {
        connected = false
        return
      }
      if (connected || connectionState === STATE.CONNECTING) {
        connected = false
        reconnectAttempts++
        connectionState = STATE.RECONNECTING
        if (client) {
          // Stomp.js'ye sonraki retry delay'i ver — exponential backoff
          client.reconnectDelay = computeBackoffDelay()
        }
        console.log(`[WS] Reconnect attempt #${reconnectAttempts} after ${client?.reconnectDelay}ms`)
        notifyStatus()
      }
    },
  })

  client.activate()
}

/**
 * FAZ D.10 + F.5 — Manuel reconnect (kullanici "yeniden dene" tiklarsa).
 * Backoff sifirlanir, hemen yeniden baglanir.
 *
 * F.5 fix: client.deactivate() bir Promise doner; eskiden hemen null + wsConnect()
 * geciyordu, eski SockJS transport hala canliyken yeni baglanti aciliyordu
 * (double subscription / message duplikasyonu riski). Artik deactivate
 * tamamlanmasini bekleyip wsConnect() cagiriyoruz.
 */
export function wsForceReconnect() {
  reconnectAttempts = 0
  connected = false
  pendingSubs = []
  connectionState = STATE.IDLE

  if (client) {
    const old = client
    client = null
    // Deactivate Promise döner; sonucu ne olursa olsun yeni baglantiya gec
    Promise.resolve(old.deactivate())
      .catch(() => {})    // hata olsa bile yeni baglanti acilmali
      .finally(() => wsConnect())
    return
  }
  wsConnect()
}

// FAZ D.10 — Tab visibility change: arka plandan donunce, baglanti yoksa retry
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !connected
        && (connectionState === STATE.RECONNECTING || connectionState === STATE.FAILED)) {
      console.log('[WS] Tab visible — force reconnect')
      wsForceReconnect()
    }
  })
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
