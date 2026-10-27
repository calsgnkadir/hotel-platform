import { createContext, Fragment, useContext, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import * as authApi from '../api/auth'
import { wsConnect, wsDisconnect } from '../lib/websocket'
import { presenceInit, presenceSubscribe, presenceUnsubscribe } from '../lib/presence'
import { syncPushSubscription, getPushEndpoint } from '../lib/webpush'
import { createSessionQueryClient, retireSessionQueryClient } from '../lib/queryClient'
import { advanceSessionRevision, getSessionSnapshot, isSessionCurrent, trackLogout } from '../lib/sessionLifecycle'
import { SESSION_CLEARED_EVENT } from '../api/client'
import EmailVerifyDialog from '../components/EmailVerifyDialog'

const AuthContext = createContext(null)

function storedUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null') } catch { return null }
}

function identity(user) {
  const id = user?.userId ?? user?.id
  return id == null ? null : String(id)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => ({
    user: storedUser(), client: createSessionQueryClient(), revision: getSessionSnapshot().revision,
  }))
  const sessionRef = useRef(session)
  const presenceTimer = useRef(null)
  const { user } = session
  const [loading, setLoading] = useState(true)

  function disconnect() {
    clearTimeout(presenceTimer.current)
    presenceTimer.current = null
    presenceUnsubscribe()
    wsDisconnect()
  }

  function connect(delayedPresence = false) {
    const snapshot = getSessionSnapshot()
    wsConnect()
    const subscribe = () => {
      if (!isSessionCurrent(snapshot)) return
      presenceInit()
      presenceSubscribe()
    }
    if (delayedPresence) presenceTimer.current = setTimeout(subscribe, 800)
    else subscribe()
    syncPushSubscription()
  }

  // Replace cache and account-owned component state together. Old callbacks
  // retain only the retired client, never the new account's cache.
  function replaceSession(nextUser, advance = true) {
    disconnect()
    const revision = advance ? advanceSessionRevision() : getSessionSnapshot().revision
    retireSessionQueryClient(sessionRef.current.client)
    const next = { user: nextUser, client: createSessionQueryClient(), revision }
    sessionRef.current = next
    flushSync(() => setSession(next))
  }

  useEffect(() => {
    if (sessionRef.current.user) connect()
    setLoading(false)
    return () => disconnect()
  }, [])

  // api/client.js oturumu yenileyemeyip temizlediğinde (ör. herkese açık sayfada
  // sessizce) arayüz de çıkış yapmış görünsün: WS/presence kapanır, kullanıcı düşer.
  useEffect(() => {
    function onCleared() {
      // api/client advances the revision before announcing expiration.
      replaceSession(null, false)
    }
    function onStorage(event) {
      if (event.key !== null && event.key !== 'user' && event.key !== 'token') return
      // Queued event.newValue can already be stale: read current storage.
      const nextUser = storedUser()
      const previous = sessionRef.current.user
      if (identity(nextUser) === identity(previous) && nextUser?.role === previous?.role) return
      replaceSession(nextUser)
      if (nextUser) connect()
    }
    window.addEventListener(SESSION_CLEARED_EVENT, onCleared)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, onCleared)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  // FAZ 5.1 — Hibrit tema: BIZ koyu (Dark Concierge), CAND/default acik (Hospitality SaaS).
  // body[data-role] attribute'una gore tokens.css'teki semantic variables override edilir.
  useEffect(() => {
    if (user?.role === 'BUSINESS_OWNER') {
      document.body.setAttribute('data-role', 'business')
    } else {
      document.body.removeAttribute('data-role')
    }
  }, [user?.role])

  async function login(email, password) {
    const data = await authApi.login(email, password)
    persist(data)
    return data
  }

  async function register(payload) {
    const data = await authApi.register(payload)
    persist(data)
    return data
  }

  function logout() {
    // Once bu cihazdaki oturum ANINDA kapanir: eskiden sunucu istegi bitene kadar
    // token localStorage'da kaliyordu; o arada sayfa yenilenir/kapanirsa oturum acik kaliyordu.
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    replaceSession(null)
    const snapshot = getSessionSnapshot()

    // F0.2: Sunucu refresh token'i iptal eder + cookie'yi siler. Push adresi de gider:
    // ortak cihazda bir sonraki kisiye bu kullanicinin bildirimi gitmesin (sunucu
    // kullaniciyi refresh cookie'den bulur — access token gerekmez).
    // keepalive: sayfa kapansa/yenilense de istek tamamlanir.
    const task = (async () => {
      try {
        const pushEndpoint = await getPushEndpoint()
        if (!isSessionCurrent(snapshot)) return
        await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pushEndpoint ? { pushEndpoint } : {}),
        })
      } catch { /* sessiz: yerel oturum zaten kapandi */ }
    })()
    // New authentication waits until logout has finished setting its cookie.
    trackLogout(task)
    return task
  }

  function persist(authResponse) {
    const { token, ...userInfo } = authResponse
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userInfo))
    replaceSession(userInfo)
    connect(true)
  }

  /** #92: Google OAuth callback'inden gelen veriyi persist eder. */
  function loginFromOAuth(authResponse) {
    persist(authResponse)
  }

  const value = {
    user,
    loading,
    isAuthenticated: !!user,
    isCandidate:     user?.role === 'CANDIDATE',
    isBusinessOwner: user?.role === 'BUSINESS_OWNER',
    login,
    register,
    logout,
    loginFromOAuth,
  }

  return (
    <AuthContext.Provider value={value}>
      <QueryClientProvider client={session.client}>
        <Fragment key={session.revision}>
          {children}
          {/* 403 EMAIL_NOT_VERIFIED gelince açılan doğrulama penceresi (tek yer) */}
          <EmailVerifyDialog />
        </Fragment>
      </QueryClientProvider>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider içinde kullanılmalı')
  return ctx
}
