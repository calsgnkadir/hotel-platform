/**
 * FAZ B.5.5 — shiftDuration birim testi.
 *
 * Kritik senaryo gece vardiyasi: 22:00–08:00 gun asar, naif cikarma
 * negatif verir. Bu testler o hatanin sessizce geri gelmesini engeller.
 */
import { describe, it, expect } from 'vitest'
import { shiftDuration } from '../shiftTime'

describe('shiftDuration', () => {
  it('normal gunduz vardiyasi tam saat doner', () => {
    expect(shiftDuration('16:00:00', '20:00:00')).toBe('4 saat')
    expect(shiftDuration('08:00:00', '16:00:00')).toBe('8 saat')
  })

  it('gece vardiyasi gun asimini dogru hesaplar (negatif fark +24sa)', () => {
    expect(shiftDuration('22:00:00', '08:00:00')).toBe('10 saat')
    expect(shiftDuration('23:30:00', '07:00:00')).toBe('7,5 saat')
    expect(shiftDuration('00:30:00', '00:00:00')).toBe('23,5 saat')
  })

  it('buçuklu sureler TR ondalik ayiraciyla yazilir', () => {
    expect(shiftDuration('09:00:00', '12:30:00')).toBe('3,5 saat')
    expect(shiftDuration('09:00:00', '15:15:00')).toBe('6,3 saat')
  })

  it('1 saatten kisa sureler dakika olarak yazilir', () => {
    expect(shiftDuration('10:00:00', '10:45:00')).toBe('45 dk')
    expect(shiftDuration('10:00:00', '10:01:00')).toBe('1 dk')
  })

  it('"HH:mm" formatini da kabul eder (saniyesiz)', () => {
    expect(shiftDuration('16:00', '20:00')).toBe('4 saat')
  })

  it('hesaplanamayan durumlarda null doner (kartta hic gosterilmez)', () => {
    expect(shiftDuration('12:00:00', '12:00:00')).toBeNull()   // ayni saat
    expect(shiftDuration('09:00:00', null)).toBeNull()          // bitis yok
    expect(shiftDuration(null, '17:00:00')).toBeNull()          // baslangic yok
    expect(shiftDuration(null, null)).toBeNull()
    expect(shiftDuration('', '')).toBeNull()
    expect(shiftDuration('abc', '17:00:00')).toBeNull()         // bozuk veri
    expect(shiftDuration('09:00:00', 'xx:yy')).toBeNull()
  })
})
