import { describe, it, expect } from 'vitest'
import { formatHours, formatHoursNumber } from '../format'

describe('formatHours — Türkçe saat biçimi', () => {
  it('tam sayıda ondalık yazmaz', () => {
    expect(formatHours(5)).toBe('5 saat')
    expect(formatHours(8.0)).toBe('8 saat')
    expect(formatHours(0)).toBe('0 saat')
  })

  it('ondalık ayırıcı virgül, en fazla bir hane', () => {
    expect(formatHours(5.5)).toBe('5,5 saat')
    expect(formatHours(6.25)).toBe('6,3 saat')
    expect(formatHours(7.04)).toBe('7 saat')
  })

  it('maxFraction 0 yuvarlar ve binlik ayırıcı nokta kullanır', () => {
    expect(formatHoursNumber(1234.6, { maxFraction: 0 })).toBe('1.235')
    expect(formatHours(15.5, { maxFraction: 0 })).toBe('16 saat')
  })

  it('geçersiz değer 0 sayılır', () => {
    expect(formatHours(undefined)).toBe('0 saat')
    expect(formatHours(NaN)).toBe('0 saat')
  })
})
