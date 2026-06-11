/**
 * FAZ 1/#60 — Online Presence client.
 *
 * Global online users Set + listener pattern.
 *  - presenceInit(): GET /api/presence/online ile başlangıç
 *  - wsSubscribe('/topic/presence'): değişiklik event'leri
 *  - usePresence(userId): React hook, true/false online state
 */
import { useEffect, useState } from 'react'
import api from '../api/client'
import { wsSubscribe } from './websocket'

const onlineUsers = new Set()
const listeners = new Set()

function notify() {
  listeners.forEach(fn => fn())
}

export async function presenceInit() {
  try {
    const { data } = await api.get('/api/presence/online')
    onlineUsers.clear()
    if (Array.isArray(data)) data.forEach(id => onlineUsers.add(Number(id)))
    notify()
  } catch (e) {
    console.warn('[Presence] init failed:', e?.message)
  }
}

let presenceSub = null
export function presenceSubscribe() {
  if (presenceSub) return
  presenceSub = wsSubscribe('/topic/presence', (payload) => {
    if (!payload || payload.userId == null) return
    const uid = Number(payload.userId)
    if (payload.online) onlineUsers.add(uid)
    else                onlineUsers.delete(uid)
    notify()
  })
}

export function presenceUnsubscribe() {
  if (presenceSub) {
    presenceSub.unsubscribe()
    presenceSub = null
  }
  onlineUsers.clear()
  notify()
}

export function isOnline(userId) {
  return onlineUsers.has(Number(userId))
}

/** Component bir userId'nin online olup olmadığını gözlemler. */
export function useOnline(userId) {
  const [online, setOnline] = useState(() => isOnline(userId))
  useEffect(() => {
    const fn = () => setOnline(isOnline(userId))
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [userId])
  return online
}
