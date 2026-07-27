/**
 * FAZ B.5.3 — logoColor birim testi.
 *
 * Asil koruma kontrast testi: logo harfi beyaz basiliyor. Palete ileride
 * acik bir ton eklenirse harf okunmaz olur ve bu sessizce fark edilmez.
 */
import { describe, it, expect } from 'vitest'
import { logoColor, LOGO_COLORS } from '../logoColor'

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
  it('ayni isim her zaman ayni rengi verir (deterministik)', () => {
    expect(logoColor('Grand Otel')).toBe(logoColor('Grand Otel'))
    expect(logoColor('Hilton Bomonti')).toBe(logoColor('Hilton Bomonti'))
  })

  it('farkli isimler paletten renk alir', () => {
    for (const name of ['Grand Otel', 'Kafe Nero', 'Mikla', 'Swissotel']) {
      expect(LOGO_COLORS).toContain(logoColor(name))
    }
  })

  it('bos/null isimde patlamaz, gecerli renk doner', () => {
    expect(LOGO_COLORS).toContain(logoColor(null))
    expect(LOGO_COLORS).toContain(logoColor(undefined))
    expect(LOGO_COLORS).toContain(logoColor(''))
  })

  it('TUM palet beyaz metinle AA kontrasti saglar (>=4.5:1)', () => {
    // Logo harfi 17px/800 — WCAG'de "buyuk metin" degil, 3:1 yetmez.
    for (const c of LOGO_COLORS) {
      expect(contrast(c, '#ffffff')).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('marka teal\'i palette YOK (logo marka ogeleriyle karismasin)', () => {
    expect(LOGO_COLORS).not.toContain('#0f766e')
  })

  it('palette tekrar eden renk yok', () => {
    expect(new Set(LOGO_COLORS).size).toBe(LOGO_COLORS.length)
  })
})
