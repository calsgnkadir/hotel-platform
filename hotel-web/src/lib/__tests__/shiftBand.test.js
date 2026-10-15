import { describe, it, expect } from 'vitest'
import { slotBands, listingMatchesBands } from '../shiftBand'

const NOW = new Date(2026, 9, 13, 10, 0, 0)  // 13 Eki 2026 10:00 yerel
const s = (date, start, end) => ({ date, startTime: start, endTime: end })

describe('slotBands', () => {
  it('başlangıç saatine göre sınıflar (05–12 / 12–18 / 18–05)', () => {
    expect([...slotBands(s('2026-10-14', '05:00', '11:00'))]).toEqual(['MORNING'])
    expect([...slotBands(s('2026-10-14', '11:59', '15:00'))]).toEqual(['MORNING'])
    expect([...slotBands(s('2026-10-14', '12:00', '17:00'))]).toEqual(['EVENING'])
    expect([...slotBands(s('2026-10-14', '18:00', '23:00'))]).toEqual(['NIGHT'])
    expect([...slotBands(s('2026-10-14', '04:30', '09:00'))]).toEqual(['NIGHT'])
  })

  it('gece yarısını geçen vardiya başlangıcı ne olursa olsun Gece bandına da girer', () => {
    expect([...slotBands(s('2026-10-14', '17:00', '01:00'))].sort()).toEqual(['EVENING', 'NIGHT'])
    expect([...slotBands(s('2026-10-14', '22:00', '06:00'))]).toEqual(['NIGHT'])
  })
})

describe('listingMatchesBands', () => {
  it('seçim yoksa her ilan uyar', () => {
    expect(listingMatchesBands({ shiftSlots: [] }, [], NOW)).toBe(true)
  })

  it('yalnız başlamamış vardiyalara bakar', () => {
    const l = { shiftSlots: [s('2026-10-12', '22:00', '06:00'), s('2026-10-14', '09:00', '17:00')] }
    expect(listingMatchesBands(l, ['NIGHT'], NOW)).toBe(false)
    expect(listingMatchesBands(l, ['MORNING'], NOW)).toBe(true)
  })

  it('slotsuz eski ilanda ilan düzeyindeki shift alanına düşer', () => {
    expect(listingMatchesBands({ shift: 'NIGHT', shiftSlots: [] }, ['NIGHT'], NOW)).toBe(true)
    expect(listingMatchesBands({ shiftSlots: [] }, ['NIGHT'], NOW)).toBe(false)
  })
})
