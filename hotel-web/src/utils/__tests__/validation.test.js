import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { validateAdultAge, birthDateBounds, calculateAge } from '../validation'

// Sabit "bugün": 2026-10-21 (yerel saat, öğlen — gün sınırı kaymasın)
beforeAll(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 21, 12, 0, 0))
})
afterAll(() => { vi.useRealTimers() })

describe('validateAdultAge — alt sınır 18', () => {
  it('boş değer geçerli', () => {
    expect(validateAdultAge('')).toBeNull()
  })
  it('tam 18 yaşı dolduran geçer', () => {
    expect(calculateAge('2008-10-21')).toBe(18)
    expect(validateAdultAge('2008-10-21')).toBeNull()
  })
  it('18 yaşına bir gün kalan reddedilir', () => {
    expect(validateAdultAge('2008-10-22')).toBe('Yaşınız en az 18 olmalı')
  })
  it('16 ve 17 yaş artık reddedilir', () => {
    expect(validateAdultAge('2010-01-01')).toBe('Yaşınız en az 18 olmalı')
    expect(validateAdultAge('2009-01-01')).toBe('Yaşınız en az 18 olmalı')
  })
  it('65 üstü reddedilir', () => {
    expect(validateAdultAge('1950-01-01')).toBe("Yaşınız 65'i geçemez")
  })
  it('geçersiz tarih', () => {
    expect(validateAdultAge('abc')).toBe('Geçerli bir doğum tarihi girin')
  })
})

describe('birthDateBounds — tarih girişi sınırları', () => {
  it('en geç doğum tarihi 18 yıl önce', () => {
    const { max, min } = birthDateBounds()
    expect(max.startsWith('2008-10')).toBe(true)
    expect(min.startsWith('1961-10')).toBe(true)
  })
})
