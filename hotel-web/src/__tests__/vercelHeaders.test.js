/**
 * Vercel güvenlik başlıkları (vercel.json). CSP inline işleyicileri hash ile izinli:
 * index.html'deki font yükleme onload'u ve offline.html'deki betikler değişirse
 * hash'ler de güncellenmeli — bu test kayma olursa kırmızı olur.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const root = process.cwd()
const vercel = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'))
const headers = Object.fromEntries(
  vercel.headers.find(h => h.source === '/(.*)').headers.map(h => [h.key, h.value])
)
const csp = headers['Content-Security-Policy']
const directive = (name) => {
  const part = csp.split(';').map(s => s.trim()).find(s => s.startsWith(name + ' '))
  return part ? part.split(/\s+/).slice(1) : null
}
const sha = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`

describe('vercel.json güvenlik başlıkları', () => {
  it('SPA rewrite korunur', () => {
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/' }])
  })

  it('temel başlıklar', () => {
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['Strict-Transport-Security']).toMatch(/max-age=\d{7,}/)
    expect(headers['Permissions-Policy']).toContain('camera=()')
    // sesli mesaj kaydı ve "yakınımdaki ilanlar" kendi kökenimizde çalışmalı
    expect(headers['Permissions-Policy']).toContain('microphone=(self)')
    expect(headers['Permissions-Policy']).toContain('geolocation=(self)')
  })

  it('CSP: betik yalnız kendi kökenimiz, çerçeveleme yok, eklenti yok', () => {
    expect(directive('default-src')).toEqual(["'self'"])
    expect(directive('script-src')).toContain("'self'")
    expect(directive('script-src')).not.toContain("'unsafe-inline'")
    expect(directive('script-src')).not.toContain("'unsafe-eval'")
    expect(directive('frame-ancestors')).toEqual(["'none'"])
    expect(directive('object-src')).toEqual(["'none'"])
    expect(directive('base-uri')).toEqual(["'self'"])
    expect(directive('form-action')).toEqual(["'self'"])
  })

  it('CSP: uygulamanın kullandığı dış kaynaklar izinli', () => {
    expect(directive('style-src')).toContain('https://fonts.googleapis.com')
    expect(directive('font-src')).toContain('https://fonts.gstatic.com')
    expect(directive('img-src')).toEqual(expect.arrayContaining([
      'data:', 'blob:', 'https://res.cloudinary.com', 'https://*.basemaps.cartocdn.com',
    ]))
    expect(directive('media-src')).toEqual(expect.arrayContaining(['blob:', 'https://res.cloudinary.com']))
    expect(directive('connect-src')).toEqual(expect.arrayContaining([
      'https://api.kadrom.me', 'wss://api.kadrom.me',
    ]))
  })

  it("CSP: adres arama backend üzerinden — tarayıcı Nominatim'e doğrudan bağlanmaz", () => {
    // GET /api/geo/search (OSM kullanım politikası sunucuda uygulanır)
    expect(csp).not.toContain('nominatim.openstreetmap.org')
    // Harita döşemeleri (CARTO) yalnız görsel olarak yüklenir
    expect(directive('img-src')).toContain('https://*.basemaps.cartocdn.com')
  })

  it('CSP: index.html onload ve offline.html betikleri hash ile izinli (LF ve CRLF)', () => {
    const scriptSrc = directive('script-src')
    const index = readFileSync(resolve(root, 'index.html'), 'utf8')
    const handlers = [...index.matchAll(/\son\w+="([^"]*)"/g)].map(m => m[1])
    expect(handlers.length).toBeGreaterThan(0)

    const offline = readFileSync(resolve(root, 'public/offline.html'), 'utf8')
    handlers.push(...[...offline.matchAll(/\son\w+="([^"]*)"/g)].map(m => m[1]))
    const inlineScripts = [...offline.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1])

    expect(scriptSrc).toContain("'unsafe-hashes'")
    for (const h of handlers) expect(scriptSrc).toContain(sha(h))
    for (const body of inlineScripts) {
      const lf = body.replace(/\r\n/g, '\n')
      expect(scriptSrc).toContain(sha(lf))
      expect(scriptSrc).toContain(sha(lf.replace(/\n/g, '\r\n')))
    }
  })
})
