import { useEffect, useState } from 'react'

/**
 * Google ile giriş açık mı? Backend gerçek bir Google OAuth istemcisi
 * ayarlanmışsa { google: true } döner (GET /api/auth/providers).
 *
 * Varsayılan false: cevap gelene kadar ve hata olursa buton hiç görünmez —
 * kullanıcı kırık bir butona tıklayıp Google hata sayfasına düşmez.
 *
 * Düz fetch (axios client değil): bu açık uçta oturum token'ı gerekmez; client
 * süresi dolmuş token'ı yenilemeye çalışıp ana sayfadaki ziyaretçiyi /login'e
 * atabilirdi.
 */
let googlePromise = null

export function fetchGoogleEnabled() {
  if (!googlePromise) {
    googlePromise = fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/providers')
      .then(r => (r.ok ? r.json() : {}))
      .then(d => d?.google === true)
      .catch(() => {
        googlePromise = null  // sonraki açılışta tekrar dene
        return false
      })
  }
  return googlePromise
}

export function useGoogleSignIn() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let alive = true
    fetchGoogleEnabled().then(v => { if (alive) setEnabled(v) })
    return () => { alive = false }
  }, [])
  return enabled
}
