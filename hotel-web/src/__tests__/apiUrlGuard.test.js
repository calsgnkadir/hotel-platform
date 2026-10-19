/**
 * E1 — Canlı derlemede VITE_API_URL boş/localhost olamaz (vite.config.js).
 * Kural saf modülde (src/lib/apiUrlGuard.js); vite.config.js onu çağırır.
 */
import { describe, it, expect } from 'vitest'
import { apiUrlProblem, checkProductionApiUrl } from '../lib/apiUrlGuard'

describe('canlı derleme API adresi koruması', () => {
  it('boş, localhost ve http adresleri sorunlu; https alan adı geçerli', () => {
    expect(apiUrlProblem('')).toMatch(/tanımlı değil/)
    expect(apiUrlProblem(undefined)).toMatch(/tanımlı değil/)
    expect(apiUrlProblem('http://localhost:8080')).toMatch(/yerel/)
    expect(apiUrlProblem('http://127.0.0.1:8081')).toMatch(/yerel/)
    expect(apiUrlProblem('http://api.kadrom.me')).toMatch(/https/)
    expect(apiUrlProblem('https://api.kadrom.me')).toBeNull()
  })

  it('KADROM_REQUIRE_API_URL=1 iken sorunlu adres derlemeyi durdurur', () => {
    const strict = { KADROM_REQUIRE_API_URL: '1' }
    expect(() => checkProductionApiUrl({ ...strict, VITE_API_URL: '' })).toThrow(/VITE_API_URL/)
    expect(() => checkProductionApiUrl({ ...strict, VITE_API_URL: 'http://localhost:8080' })).toThrow()
    expect(checkProductionApiUrl({ ...strict, VITE_API_URL: 'https://api.kadrom.me' })).toBeNull()
  })

  it('VERCEL=1 tek başına durdurmaz (canlı backend yokken önizleme kırılmasın), yalnız uyarır', () => {
    expect(checkProductionApiUrl({ VERCEL: '1', VITE_API_URL: '' })).toMatch(/tanımlı değil/)
  })

  it('vitrin önizlemesi (VITE_SHOWCASE=true) istisna; yerel/CI derlemesi yalnız uyarı', () => {
    expect(checkProductionApiUrl({ VERCEL: '1', VITE_SHOWCASE: 'true' })).toBeNull()
    expect(checkProductionApiUrl({ VITE_API_URL: '' })).toMatch(/tanımlı değil/)
  })
})

describe('vite.config.js bağlantısı', () => {
  it('derleme korumayı çağırır', async () => {
    const { readFileSync } = await import('node:fs')
    const cfg = readFileSync(process.cwd() + '/vite.config.js', 'utf8')
    expect(cfg).toContain("import { checkProductionApiUrl } from './src/lib/apiUrlGuard.js'")
    expect(cfg).toMatch(/command === 'build' && mode === 'production'/)
  })
})
