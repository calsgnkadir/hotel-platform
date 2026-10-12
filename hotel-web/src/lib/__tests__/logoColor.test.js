/**
 * Logo yedeği rengi — karar: tüm baş harf kutuları tek renk, marka grafiti.
 *
 * Asıl koruma kontrast testi: logo harfi beyaz basılıyor. Zemin ileride açık
 * bir tona çekilirse harf okunmaz olur ve bu sessizce fark edilmez.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { logoColor, LOGO_FALLBACK_BG, LOGO_FALLBACK_HEX } from '../logoColor'

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

describe('logoColor', () => {
  it('her isim (boş/null dahil) aynı grafit zemini alır', () => {
    for (const name of ['Grand Otel', 'Kafe Nero', 'Mikla', '', null, undefined]) {
      expect(logoColor(name)).toBe(LOGO_FALLBACK_BG)
    }
    expect(LOGO_FALLBACK_BG).toBe('var(--ah-brand)')
  })

  it('zemin, tokens.css --ah-brand ile aynı grafit değer', () => {
    const css = readFileSync(resolve(__dirname, '../../styles/tokens.css'), 'utf8')
    const m = css.match(/--ah-brand:\s*(#[0-9a-fA-F]{6})/)
    expect(m?.[1].toLowerCase()).toBe(LOGO_FALLBACK_HEX)
    expect(LOGO_FALLBACK_HEX).toBe('#1f2937')
  })

  it('beyaz harf ile AA kontrastı sağlar (>=4.5:1)', () => {
    expect(contrast(LOGO_FALLBACK_HEX, '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })
})
