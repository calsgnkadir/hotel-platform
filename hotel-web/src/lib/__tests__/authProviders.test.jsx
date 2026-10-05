import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

/**
 * Google butonu yalnızca backend "google: true" derse görünür.
 * Cevap gelene kadar ve hata olursa gizli — kırık buton hiç gösterilmez.
 */
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

async function loadHook() {
  const mod = await import('../authProviders')
  return mod.useGoogleSignIn
}

const respond = (body, ok = true) => vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) }))

describe('useGoogleSignIn', () => {
  it('backend Google açık derse true', async () => {
    vi.stubGlobal('fetch', respond({ google: true }))
    const useGoogleSignIn = await loadHook()
    const { result } = renderHook(() => useGoogleSignIn())
    expect(result.current).toBe(false)  // cevap gelene kadar gizli
    await waitFor(() => expect(result.current).toBe(true))
    expect(fetch).toHaveBeenCalledWith('/api/auth/providers')
  })

  it('Google ayarlı değilse false (buton gizli)', async () => {
    vi.stubGlobal('fetch', respond({ google: false }))
    const useGoogleSignIn = await loadHook()
    const { result } = renderHook(() => useGoogleSignIn())
    await new Promise(r => setTimeout(r, 20))
    expect(result.current).toBe(false)
  })

  it('backend erişilemezse false, sonraki açılışta tekrar dener', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('ağ yok'))))
    const mod = await import('../authProviders')
    expect(await mod.fetchGoogleEnabled()).toBe(false)
    expect(await mod.fetchGoogleEnabled()).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('aynı sayfada birden fazla buton tek istek atar', async () => {
    vi.stubGlobal('fetch', respond({ google: true }))
    const mod = await import('../authProviders')
    await Promise.all([mod.fetchGoogleEnabled(), mod.fetchGoogleEnabled()])
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
