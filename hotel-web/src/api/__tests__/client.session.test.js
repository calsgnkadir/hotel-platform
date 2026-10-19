import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import api, {
  sessionNav, extractErrorMessage, isEmailNotVerifiedError,
  SESSION_CLEARED_EVENT, EMAIL_NOT_VERIFIED_EVENT,
} from '../client'

/**
 * E9 — Oturum yenilenemezse:
 *  - herkese açık sayfada (ilan, ana sayfa, yasal metin) yönlendirme YOK; oturum
 *    sessizce temizlenir, istek girişsiz sürer
 *  - korumalı sayfada /login'e gidilir; geldiği yol + "expired" sekmede saklanır
 * E-posta doğrulaması — 403 EMAIL_NOT_VERIFIED olayı + anlaşılır mesaj.
 */

// Süresi geçmiş sahte JWT (yalnız exp okunur)
const b64 = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '')
const EXPIRED = `${b64({ alg: 'none' })}.${b64({ exp: 1 })}.x`

let seen = []
function okAdapter(config) {
  seen.push(config)
  return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config })
}

describe('api/client oturum süresi', () => {
  let toLogin
  beforeEach(() => {
    seen = []
    localStorage.setItem('token', EXPIRED)
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'CANDIDATE' }))
    sessionStorage.clear()
    api.defaults.adapter = okAdapter
    vi.spyOn(axios, 'post').mockRejectedValue({ response: { status: 401 } })  // refresh başarısız
    toLogin = vi.spyOn(sessionNav, 'toLogin').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('herkese açık ilan sayfasında yönlendirme yok; istek girişsiz sürer, oturum temizlenir', async () => {
    window.history.replaceState(null, '', '/listings/7')
    const cleared = vi.fn()
    window.addEventListener(SESSION_CLEARED_EVENT, cleared)

    const res = await api.get('/api/listings/7')
    expect(res.data).toEqual({ ok: true })
    expect(seen[0].headers.Authorization).toBeUndefined()
    expect(toLogin).not.toHaveBeenCalled()
    expect(localStorage.getItem('token')).toBeNull()
    expect(cleared).toHaveBeenCalled()
    expect(sessionStorage.getItem('kadrom.auth.return')).toBeNull()
    window.removeEventListener(SESSION_CLEARED_EVENT, cleared)
  })

  it.each(['/', '/kvkk', '/terms', '/p/business/3'])('%s herkese açık: yönlendirme yok', async (path) => {
    window.history.replaceState(null, '', path)
    await api.get('/api/x')
    expect(toLogin).not.toHaveBeenCalled()
  })

  it('korumalı sayfada /login\'e gider; geldiği yol ve "expired" saklanır, istek iptal', async () => {
    window.history.replaceState(null, '', '/business?tab=billing')
    await expect(api.get('/api/business/billing')).rejects.toBeInstanceOf(axios.Cancel)
    expect(seen).toHaveLength(0)
    expect(toLogin).toHaveBeenCalledTimes(1)
    expect(JSON.parse(sessionStorage.getItem('kadrom.auth.return')))
      .toEqual({ path: '/business?tab=billing', reason: 'expired' })
  })

  it('401 sonrası refresh de başarısızsa herkese açık sayfada istek tokensız yinelenir', async () => {
    window.history.replaceState(null, '', '/listings/9')
    localStorage.setItem('token', `${b64({ alg: 'none' })}.${b64({ exp: 9999999999 })}.x`)  // süresi geçmemiş
    let calls = 0
    api.defaults.adapter = (config) => {
      calls++
      if (calls === 1) {
        // eslint-disable-next-line prefer-promise-reject-errors
        return Promise.reject({ response: { status: 401, data: {} }, config })
      }
      seen.push(config)
      return Promise.resolve({ data: { again: true }, status: 200, statusText: 'OK', headers: {}, config })
    }
    const res = await api.get('/api/listings/9')
    expect(res.data).toEqual({ again: true })
    expect(seen[0].headers.Authorization).toBeUndefined()
    expect(toLogin).not.toHaveBeenCalled()
  })
})

describe('api/client EMAIL_NOT_VERIFIED', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

  it('403 EMAIL_NOT_VERIFIED olayı yayınlanır, mesaj anlaşılır', async () => {
    const heard = vi.fn()
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, heard)
    const body = { message: 'Devam etmek için e-posta adresini doğrula.', code: 'EMAIL_NOT_VERIFIED' }
    api.defaults.adapter = (config) =>
      // eslint-disable-next-line prefer-promise-reject-errors
      Promise.reject({ response: { status: 403, data: body }, config })

    const err = await api.post('/api/applications', {}).catch(e => e)
    expect(isEmailNotVerifiedError(err)).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
    expect(extractErrorMessage(err)).toBe('Devam etmek için e-posta adresini doğrula.')
    window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, heard)
  })

  it('başka 403 olay yaymaz', async () => {
    const heard = vi.fn()
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, heard)
    api.defaults.adapter = (config) =>
      // eslint-disable-next-line prefer-promise-reject-errors
      Promise.reject({ response: { status: 403, data: { message: 'Yetkin yok' } }, config })
    const err = await api.get('/api/admin').catch(e => e)
    expect(heard).not.toHaveBeenCalled()
    expect(extractErrorMessage(err)).toBe('Yetkin yok')
    window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, heard)
  })
})

describe('refresh başarılıysa emailVerified korunur', () => {
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear() })

  it('kullanıcı kaydındaki eski alanlar silinmez', async () => {
    window.history.replaceState(null, '', '/candidate')
    localStorage.setItem('token', EXPIRED)
    localStorage.setItem('user', JSON.stringify({ id: 1, role: 'CANDIDATE', emailVerified: true, email: 'a@b.co' }))
    vi.spyOn(axios, 'post').mockResolvedValue({
      data: { token: 'yeni', userId: 1, email: 'a@b.co', fullName: 'Ayşe', role: 'CANDIDATE' },
    })
    api.defaults.adapter = okAdapter
    await api.get('/api/me')
    const user = JSON.parse(localStorage.getItem('user'))
    expect(user).toMatchObject({ id: 1, emailVerified: true, fullName: 'Ayşe' })
    expect(localStorage.getItem('token')).toBe('yeni')
  })
})
