/**
 * Logo yedeği rengi — karar (2026-10-21): açık varyant. Zemin --ah-brand-soft,
 * harf --ah-ink, çerçeve --ah-line-2. Tüm baş harf kutuları tek renk.
 *
 * Asıl koruma kontrast testi: harf koyu ink ile basılıyor. Zemin ya da ink
 * tonu değişirse harf okunmaz hale gelebilir; bu sessizce fark edilmesin.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  logoColor, LOGO_FALLBACK_BG, LOGO_FALLBACK_FG, LOGO_FALLBACK_BORDER,
  LOGO_FALLBACK_HEX, LOGO_FALLBACK_INK_HEX,
} from '../logoColor'

/** WCAG rölatif luminans */
function luminance(hex) {
  const c = hex.replace('#', '').match(/../g).map(h => {
    const v = parseInt(h, 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const css = readFileSync(resolve(__dirname, '../../styles/tokens.css'), 'utf8')
const token = (name) => css.match(new RegExp(`--${name}:\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase()

describe('logoColor', () => {
  it('her isim (boş/null dahil) aynı açık zemini alır', () => {
    for (const name of ['Grand Otel', 'Kafe Nero', 'Mikla', '', null, undefined]) {
      expect(logoColor(name)).toBe(LOGO_FALLBACK_BG)
    }
    expect(LOGO_FALLBACK_BG).toBe('var(--ah-brand-soft)')
    expect(LOGO_FALLBACK_FG).toBe('var(--ah-ink)')
    expect(LOGO_FALLBACK_BORDER).toBe('1px solid var(--ah-line-2)')
  })

  it('hex değerleri tokens.css ile aynı', () => {
    expect(token('ah-brand-soft')).toBe(LOGO_FALLBACK_HEX)
    expect(token('ah-ink')).toBe(LOGO_FALLBACK_INK_HEX)
  })

  it('koyu harf açık zeminde AA kontrastı sağlar (>=4.5:1)', () => {
    expect(contrast(LOGO_FALLBACK_HEX, LOGO_FALLBACK_INK_HEX)).toBeGreaterThanOrEqual(4.5)
  })
})
