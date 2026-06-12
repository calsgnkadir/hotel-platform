import { createContext, useContext, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import * as authApi from '../api/auth'
import api from '../api/client'
import { wsConnect, wsDisconnect } from '../lib/websocket'
import { presenceInit, presenceSubscribe, presenceUnsubscribe } from '../lib/presence'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        // FAZ 1/#12 — page reload sonrası user mevcutsa WS bağlan
        wsConnect()
        // FAZ 1/#60 — Online presence init + sub
        presenceInit()
        presenceSubscribe()
      } catch {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

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

  async function logout() {
    // F0.2: Backend'i bilgilendir → refresh token DB'de revoke + cookie sil
    try { await api.post('/api/auth/logout') } catch { /* sessiz */ }
    presenceUnsubscribe()
    wsDisconnect()
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  function persist(authResponse) {
    const { token, ...userInfo } = authResponse
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userInfo))
    // FIX: flushSync ile setUser senkron commit edilir. Aksi halde await login()
    // sonrasi navigate yapilirsa ProtectedRoute user'i hala null gorur ve
    // /login'e geri atar. "Bazen tek seferde girilemiyor" bug'inin sebebi buydu.
    flushSync(() => setUser(userInfo))
    wsConnect()
    // FAZ 1/#60 — Presence (WS bağlandıktan sonra init/sub)
    setTimeout(() => { presenceInit(); presenceSubscribe() }, 800)
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth AuthProvider içinde kullanılmalı')
  return ctx
}
