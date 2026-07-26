import { useCallback, useEffect, useState } from 'react'
import { getCurrentPosition, isGeolocationSupported } from './geolocation'

/**
 * FAZ B.3 — Aday konumunu hook'la yonet.
 * - localStorage'da cache'lenir (30 dk TTL) — spam istek olmasin.
 * - Sadece kullanici acikca isterse (`request()`) konum sorulur.
 * - Sunucuya gonderilmez, tamamen client-side.
 */
const STORAGE_KEY = 'ajanshotel:my-location'
const TTL_MS = 30 * 60_000 // 30 dk

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (!obj?.lat || !obj?.lng || !obj?.ts) return null
    if (Date.now() - obj.ts > TTL_MS) return null
    return { lat: obj.lat, lng: obj.lng }
  } catch { return null }
}

function writeCache(pos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: pos.lat, lng: pos.lng, ts: Date.now() }))
  } catch {}
}

function clearCache() {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}

export function useMyLocation() {
  const [location, setLocation] = useState(() => readCache())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const supported = isGeolocationSupported()

  // Sekme acikken TTL dolarsa null'a dus
  useEffect(() => {
    if (!location) return
    const cached = readCache()
    if (!cached) setLocation(null)
  }, [])

  const request = useCallback(async () => {
    if (!supported) {
      setError('Tarayicin konum bilgisini desteklemiyor.')
      return null
    }
    setLoading(true); setError(null)
    try {
      const pos = await getCurrentPosition()
      const p = { lat: pos.lat, lng: pos.lng }
      writeCache(p)
      setLocation(p)
      return p
    } catch (e) {
      setError(e.message || 'Konum alinamadi.')
      return null
    } finally {
      setLoading(false)
    }
  }, [supported])

  const clear = useCallback(() => {
    clearCache()
    setLocation(null)
    setError(null)
  }, [])

  return { location, loading, error, supported, request, clear }
}
