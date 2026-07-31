import { describe, it, expect } from 'vitest'
import { formatSalary, salaryTypeShort, salaryTypeLabel } from '../salary'

/**
 * Ucret birimi regresyon testi.
 *
 * Gercek hata: DemoSeeder salaryType yazmayi atladi -> alan null kaldi ->
 * salaryTypeShort(null) sessizce "ay" dondu -> gunluk vardiya ilanlari
 * kartlarda "800 – 1.200 ₺ / ay" diye gorundu. Ilanin kendi etiketi
 * "Gunluk" derken ucret aylik gosteriliyordu.
 *
 * Kural: birimi bilmiyorsak UYDURMA. Tutar yazilir, birim yazilmaz.
 */
describe('formatSalary — birim son eki', () => {
  it('bilinen tipler dogru son eki alir', () => {
    expect(formatSalary(150, 200, 'HOURLY')).toBe('150 – 200 ₺ / saat')
    expect(formatSalary(800, 1200, 'DAILY')).toBe('800 – 1.200 ₺ / gün')
    expect(formatSalary(20000, 30000, 'MONTHLY')).toBe('20.000 – 30.000 ₺ / ay')
  })

  it('salaryType YOKSA birim uydurmaz (eskiden "/ ay" yaziyordu)', () => {
    expect(formatSalary(800, 1200, null)).toBe('800 – 1.200 ₺')
    expect(formatSalary(800, 1200, undefined)).toBe('800 – 1.200 ₺')
    expect(formatSalary(800, 1200, 'BILINMEYEN')).toBe('800 – 1.200 ₺')
  })

  it('NEGOTIABLE tutari gizler', () => {
    expect(formatSalary(800, 1200, 'NEGOTIABLE')).toBe('Görüşülecek')
  })

  it('tek deger + bahsis', () => {
    expect(formatSalary(1500, null, 'DAILY', true)).toBe('1.500 ₺ / gün + bahşiş')
  })

  it('tutar yoksa null doner', () => {
    expect(formatSalary(null, null, null)).toBe(null)
  })
})

describe('yardimcilar bilinmeyen kodda varsayilan UYDURMAZ', () => {
  it('salaryTypeShort bos string doner', () => {
    expect(salaryTypeShort(null)).toBe('')
    expect(salaryTypeShort('ZART')).toBe('')
    expect(salaryTypeShort('DAILY')).toBe('gün')
  })

  it('salaryTypeLabel null doner', () => {
    expect(salaryTypeLabel(null)).toBe(null)
    expect(salaryTypeLabel('DAILY')).toBe('Günlük')
  })
})
