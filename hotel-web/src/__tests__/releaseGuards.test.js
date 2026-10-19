/**
 * Yayın engelleri — statik dosyalar ve derleme koruması.
 *  H1  robots.txt: ayrı "User-agent: Googlebot" grubu yok (Google yalnız kendi grubunu
 *      okur; "Allow: /" grubu Disallow kurallarını Googlebot için siliyordu).
 *  E10 paylaşım görseli: mutlak adres + 1200x630 PNG.
 *  E1  derlenmiş sürümde boş API adresi localhost'a düşmez
 *      (derleme koruması: apiUrlGuard.test.js — node ortamı).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveWsBase } from '../lib/websocket'
import { PRIVACY_NOTICE_VERSION, consentPayload } from '../lib/legal'

const root = process.cwd()

describe('robots.txt', () => {
  const robots = readFileSync(resolve(root, 'public/robots.txt'), 'utf8')

  it('tek user-agent grubu (*), Googlebot grubu yok', () => {
    const agents = [...robots.matchAll(/^User-agent:\s*(.+)$/gim)].map(m => m[1].trim())
    expect(agents).toEqual(['*'])
    expect(robots).not.toMatch(/Googlebot/i)
  })

  it('paneller kapalı, sitemap tanımlı', () => {
    for (const p of ['/candidate/', '/business/', '/admin/', '/api/']) {
      expect(robots).toContain(`Disallow: ${p}`)
    }
    expect(robots).toMatch(/^Sitemap: https:\/\/kadrom\.me\/sitemap\.xml$/m)
  })
})

describe('paylaşım görseli', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8')

  it('og:image ve twitter:image mutlak og.png', () => {
    expect(html).toContain('<meta property="og:image" content="https://kadrom.me/og.png" />')
    expect(html).toContain('<meta name="twitter:image" content="https://kadrom.me/og.png" />')
    expect(html).not.toMatch(/(og|twitter):image" content="\/favicon\.svg"/)
  })

  it('public/og.png 1200x630 PNG', () => {
    const png = readFileSync(resolve(root, 'public/og.png'))
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1200)   // IHDR genişlik
    expect(png.readUInt32BE(20)).toBe(630)    // IHDR yükseklik
  })
})

describe('çalışma anı API/WS adresi', () => {
  it('derlenmiş sürümde boş adres localhost\'a düşmez (aynı köken)', () => {
    expect(resolveWsBase('', false)).toBe(window.location.origin)
    expect(resolveWsBase('', false)).not.toContain('localhost:8080')
  })
  it('geliştirmede backend portu, tanımlıysa verilen adres', () => {
    expect(resolveWsBase('', true)).toBe('http://localhost:8080')
    expect(resolveWsBase('https://api.kadrom.me/', false)).toBe('https://api.kadrom.me')
  })
})

describe('yasal sürüm tek kaynak', () => {
  it('kayıt gövdesi alanları', () => {
    expect(PRIVACY_NOTICE_VERSION).toBe('2026-10-17')
    expect(consentPayload()).toEqual({ termsAccepted: true, privacyNoticeVersion: '2026-10-17' })
  })
})
