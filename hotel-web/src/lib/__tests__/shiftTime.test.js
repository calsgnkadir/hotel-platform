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
    expect(shiftDuration('09:00:00', null)).toBeNull()          // bitis yok
    expect(shiftDuration(null, '17:00:00')).toBeNull()          // baslangic yok
    expect(shiftDuration(null, null)).toBeNull()
    expect(shiftDuration('', '')).toBeNull()
    expect(shiftDuration('abc', '17:00:00')).toBeNull()         // bozuk veri
    expect(shiftDuration('09:00:00', 'xx:yy')).toBeNull()
  })
})

/* ── Gece vardiyası paketi ─────────────────────────────────────── */
import {
  shiftMinutes, shiftHours, isOvernight, formatShiftRange, annotateShiftText,
  localDateISO, addDaysISO, shiftStartDate, shiftEndDate, isShiftStarted,
  isShiftOngoing, isShiftPast, nearestShift, relativeDayLabel, validateShiftTimes,
  formatSlotShort, compareSlots, isNoShowAllowed,
} from '../shiftTime'

// Sabit yerel an: 12 Ekim 2026 23:00
const NOW = new Date(2026, 9, 12, 23, 0, 0)
const night = { date: '2026-10-12', startTime: '22:00:00', endTime: '06:00:00' }

describe('gece vardiyası süre ve etiket', () => {
  it('22:00–06:00 = 8 saat', () => {
    expect(shiftMinutes('22:00', '06:00')).toBe(480)
    expect(shiftHours('22:00:00', '06:00:00')).toBe(8)
    expect(shiftDuration('22:00:00', '06:00:00')).toBe('8 saat')
  })
  it('eşit saatli eski kayıt backend gibi 24 saatlik gece vardiyası sayılır', () => {
    expect(shiftMinutes('08:00', '08:00')).toBe(24 * 60)
    expect(shiftHours('08:00', '08:00')).toBe(24)
    expect(shiftDuration('12:00:00', '12:00:00')).toBe('24 saat')
    expect(isOvernight('08:00', '08:00')).toBe(true)
    expect(formatShiftRange('08:00:00', '08:00:00', { short: true })).toBe('08:00–08:00 +1')
    const legacy = { date: '2026-10-12', startTime: '08:00:00', endTime: '08:00:00' }
    expect(shiftEndDate(legacy)).toEqual(new Date(2026, 9, 13, 8, 0))
    expect(isShiftOngoing(legacy, NOW)).toBe(true)
    expect(isShiftPast(legacy, new Date(2026, 9, 13, 8, 0))).toBe(true)
  })
  it('isOvernight bitiş <= başlangıçta true', () => {
    expect(isOvernight('22:00', '06:00')).toBe(true)
    expect(isOvernight('09:00', '17:00')).toBe(false)
    expect(isOvernight(null, '06:00')).toBe(false)
  })
  it('etiket uzun ve kısa biçim', () => {
    expect(formatShiftRange('22:00:00', '06:00:00')).toBe('22:00–06:00 (ertesi gün)')
    expect(formatShiftRange('22:00:00', '06:00:00', { short: true })).toBe('22:00–06:00 +1')
    expect(formatShiftRange('09:00:00', '17:00:00')).toBe('09:00–17:00')
    expect(formatShiftRange('09:00:00', null)).toBe('09:00')
    expect(formatShiftRange(null, null)).toBe('')
  })
  it('backend metnine gece eki ekler, gündüzü değiştirmez', () => {
    expect(annotateShiftText('22:00 – 06:00', { short: true })).toBe('22:00 – 06:00 +1')
    expect(annotateShiftText('22:00 – 06:00')).toBe('22:00 – 06:00 (ertesi gün)')
    expect(annotateShiftText('08:00 – 16:00')).toBe('08:00 – 16:00')
    expect(annotateShiftText('Sabah')).toBe('Sabah')
    expect(annotateShiftText(null)).toBe('')
  })
})

describe('doğrulama', () => {
  it('eşit saat ve 16 saati aşan süre hata verir; gece vardiyası geçerli', () => {
    expect(validateShiftTimes('08:00', '08:00')).toBe('Başlangıç ve bitiş saati aynı olamaz')
    expect(validateShiftTimes('06:00', '23:00')).toBe('Vardiya en fazla 16 saat olabilir')
    expect(validateShiftTimes('20:00', '13:00')).toBe('Vardiya en fazla 16 saat olabilir')
    expect(validateShiftTimes('20:00', '12:00')).toBeNull()   // tam 16 saat
    expect(validateShiftTimes('22:00', '06:00')).toBeNull()
    expect(validateShiftTimes('', '06:00')).toBeNull()
  })
})

describe('yerel tarih ve anlar', () => {
  it('localDateISO yerel takvimi kullanır (gece yarısına yakın kayma yok)', () => {
    expect(localDateISO(new Date(2026, 9, 12, 23, 59))).toBe('2026-10-12')
    expect(localDateISO(new Date(2026, 9, 13, 0, 1))).toBe('2026-10-13')
    expect(addDaysISO('2026-10-31', 1)).toBe('2026-11-01')
  })
  it('gece vardiyası ertesi gün biter', () => {
    expect(shiftStartDate(night)).toEqual(new Date(2026, 9, 12, 22, 0))
    expect(shiftEndDate(night)).toEqual(new Date(2026, 9, 13, 6, 0))
    expect(shiftEndDate({ date: '2026-10-12', startTime: '09:00', endTime: '17:00' }))
      .toEqual(new Date(2026, 9, 12, 17, 0))
  })
  it('başladı / devam ediyor / geçti', () => {
    expect(isShiftStarted(night, NOW)).toBe(true)
    expect(isShiftOngoing(night, NOW)).toBe(true)
    expect(isShiftPast(night, NOW)).toBe(false)
    // ertesi sabah 05:59 hâlâ vardiyada, 06:00'da bitti
    expect(isShiftOngoing(night, new Date(2026, 9, 13, 5, 59))).toBe(true)
    expect(isShiftPast(night, new Date(2026, 9, 13, 6, 0))).toBe(true)
    // 21:59 henüz başlamadı
    expect(isShiftStarted(night, new Date(2026, 9, 12, 21, 59))).toBe(false)
  })
  it('tarihsiz slot hiçbir zaman başlamış/geçmiş sayılmaz', () => {
    expect(isShiftStarted({ startTime: '09:00' }, NOW)).toBe(false)
    expect(isShiftPast({ startTime: '09:00' }, NOW)).toBe(false)
  })
})

describe('en yakın vardiya ve gün etiketi', () => {
  const slots = [
    { id: 3, date: '2026-10-14', startTime: '09:00:00', endTime: '17:00:00' },
    night,
    { id: 2, date: '2026-10-13', startTime: '22:00:00', endTime: '06:00:00', full: true },
    { id: 1, date: '2026-10-11', startTime: '22:00:00', endTime: '06:00:00' },
  ]
  it('upcoming: başlamamış ilk vardiya (filtreyle)', () => {
    expect(nearestShift(slots, { now: NOW }).date).toBe('2026-10-13')
    expect(nearestShift(slots, { now: NOW, filter: s => !s.full }).id).toBe(3)
  })
  it('active: devam eden gece vardiyası dahil', () => {
    expect(nearestShift(slots, { now: NOW, mode: 'active' })).toBe(night)
  })
  it('boş/eksik girdide null', () => {
    expect(nearestShift([], { now: NOW })).toBeNull()
    expect(nearestShift(null)).toBeNull()
  })
  it('Bugün / Yarın yerel takvimle', () => {
    expect(relativeDayLabel('2026-10-12', NOW)).toBe('Bugün')
    expect(relativeDayLabel('2026-10-13', NOW)).toBe('Yarın')
    expect(relativeDayLabel('2026-10-14', NOW)).toBeNull()
  })
  it('kısa slot etiketi', () => {
    expect(formatSlotShort(night, NOW)).toBe('Bugün 22:00–06:00 +1')
  })
  it('compareSlots tarih sonra saat', () => {
    expect([...slots].sort(compareSlots).map(s => s.date)).toEqual(
      ['2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'])
  })
})

describe('gelmedi işareti zamanı', () => {
  it('başlangıçtan 30 dk sonra izin verilir (sınır dahil)', () => {
    const day = { date: '2026-10-12', startTime: '09:00:00', endTime: '17:00:00' }
    expect(isNoShowAllowed(day, new Date(2026, 9, 12, 9, 29))).toBe(false)
    expect(isNoShowAllowed(day, new Date(2026, 9, 12, 9, 30))).toBe(true)
  })
  it('gece vardiyası başlangıç gününe göre hesaplanır', () => {
    expect(isNoShowAllowed(night, new Date(2026, 9, 12, 22, 15))).toBe(false)
    expect(isNoShowAllowed(night, new Date(2026, 9, 13, 2, 0))).toBe(true)
  })
  it('tarih ya da saat yoksa izin yok', () => {
    expect(isNoShowAllowed({ startTime: '09:00' }, NOW)).toBe(false)
    expect(isNoShowAllowed({ date: '2026-10-12' }, NOW)).toBe(false)
    expect(isNoShowAllowed(null, NOW)).toBe(false)
  })
})
