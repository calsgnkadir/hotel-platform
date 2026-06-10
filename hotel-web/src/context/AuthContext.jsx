import { createContext, useContext, useEffect, useState } from 'react'
import * as authApi from '../api/auth'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
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
    // Network hatası olsa bile lokal temizlik mutlaka yapılır (finally değil await + try)
    try { await api.post('/api/auth/logout') } catch { /* sessiz */ }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  function persist(authResponse) {
    const { token, ...userInfo } = authResponse
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userInfo))
    setUser(userInfo)
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
