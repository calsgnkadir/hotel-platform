import { describe, it, expect } from 'vitest'
import { historyDateLabel } from '../HistoryTab'

// Geçmiş kartı tarih aralığı: ayıraç kaybolmuştu ("12 Oca 15 Oca 2026").
describe('historyDateLabel', () => {
  it('tarih yoksa tire', () => {
    expect(historyDateLabel(undefined, undefined)).toBe('—')
  })
  it('tek gün: gün ay yıl', () => {
    expect(historyDateLabel('2026-01-12', '2026-01-12')).toBe('12 Oca 2026')
  })
  it('aynı yıl aralığı: en tire ile, yıl yalnız sonda', () => {
    expect(historyDateLabel('2026-01-12', '2026-01-15')).toBe('12 Oca – 15 Oca 2026')
  })
  it('yıl dönümü aralığı: iki uçta da yıl', () => {
    expect(historyDateLabel('2025-12-28', '2026-01-03')).toBe('28 Ara 2025 – 3 Oca 2026')
  })
})
