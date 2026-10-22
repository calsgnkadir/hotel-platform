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

// Regresyon: toISOString() UTC'ye çevirdiği için İstanbul'da (UTC+3) gece
// yarısından sonraki ilk 3 saatte `max` bir önceki güne kayıyordu; 18. doğum
// gününü yaşayan kullanıcı tarih seçicide bir gün erken engelleniyordu.
describe('birthDateBounds — saat dilimi (gece yarısı yakını)', () => {
  const ORIGINAL_TZ = process.env.TZ
  afterAll(() => {
    if (ORIGINAL_TZ === undefined) delete process.env.TZ
    else process.env.TZ = ORIGINAL_TZ
  })

  it('İstanbul 00:30: en geç tarih bugünün 18 yıl öncesi (önceki gün değil)', () => {
    process.env.TZ = 'Europe/Istanbul'
    vi.setSystemTime(new Date(2026, 9, 21, 0, 30, 0)) // yerel 21 Eki 00:30 = UTC 20 Eki 21:30
    expect(new Date().getDate()).toBe(21) // TZ gerçekten uygulandı
    const { max, min } = birthDateBounds()
    expect(max).toBe('2008-10-21')
    expect(min).toBe('1961-10-21')
    // Tarih seçicinin izin verdiği en geç gün yaş kuralından da geçmeli
    expect(validateAdultAge(max)).toBeNull()
  })

  it('İstanbul 23:59: gün ileri kaymaz', () => {
    process.env.TZ = 'Europe/Istanbul'
    vi.setSystemTime(new Date(2026, 9, 21, 23, 59, 0))
    expect(birthDateBounds().max).toBe('2008-10-21')
    expect(validateAdultAge('2008-10-22')).toBe('Yaşınız en az 18 olmalı')
  })

  it('UTC batısında (New York) yarınki doğum günü bugünden sayılmaz', () => {
    process.env.TZ = 'America/New_York'
    vi.setSystemTime(new Date(2026, 9, 21, 9, 0, 0))
    // new Date('2008-10-22') UTC gece yarısı = NY'de 21 Eki akşamı → eskiden 18 sayılıyordu
    expect(calculateAge('2008-10-22')).toBe(17)
    expect(calculateAge('2008-10-21')).toBe(18)
    expect(birthDateBounds().max).toBe('2008-10-21')
  })
})
