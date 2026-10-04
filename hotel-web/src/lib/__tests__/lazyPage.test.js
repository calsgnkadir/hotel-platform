/**
 * lazyPage — yeni sürüm sonrası eski parça adı düşerse sayfa bir kez yenilenir,
 * ikinci düşüşte hata yukarı gider (sonsuz yenileme döngüsü olmaz).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadWithReload } from '../lazyPage'

const KEY = 'kadrom.chunk-reload'
const fail = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))

describe('loadWithReload', () => {
  beforeEach(() => sessionStorage.clear())

  it('basarili yuklemede modulu dondurur ve isareti temizler', async () => {
    sessionStorage.setItem(KEY, '1')
    const mod = { default: () => null }
    await expect(loadWithReload(() => Promise.resolve(mod), vi.fn())).resolves.toBe(mod)
    expect(sessionStorage.getItem(KEY)).toBeNull()
  })

  it('ilk dususte sayfayi bir kez yeniler', async () => {
    const reload = vi.fn()
    loadWithReload(fail, reload)  // yenilenene kadar bekleyen promise: await edilmez
    await new Promise(r => setTimeout(r, 0))
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(KEY)).toBe('1')
  })

  it('yenilemeden sonra yine duserse hatayi firlatir, tekrar yenilemez', async () => {
    sessionStorage.setItem(KEY, '1')
    const reload = vi.fn()
    await expect(loadWithReload(fail, reload)).rejects.toThrow('dynamically imported')
    expect(reload).not.toHaveBeenCalled()
  })
})
