import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge, { CAND_STATUS_FILTERS } from '../StatusBadge'

/**
 * UI Paket 3 — durum etiketleri kaynağında Türkçe. API enum değerleri (HELD vb.)
 * değişmez; kullanıcı hiçbir durumda İngilizce "HOLD" görmez.
 */
const STATUSES = ['PENDING', 'REVIEWING', 'HELD', 'STANDBY', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']

describe('StatusBadge (aday)', () => {
  it('HELD → "Beklemede…" rozeti', () => {
    render(<StatusBadge status="HELD" />)
    expect(screen.getByText(/^Beklemede/)).toBeInTheDocument()
  })

  it.each(STATUSES)('%s rozetinde "HOLD" veya ham enum metni yok', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(container.textContent).not.toMatch(/HOLD/i)
    expect(container.textContent).not.toBe(status)
  })

  it('filtre etiketleri Türkçe; HELD filtresi "Beklemede", enum değeri aynı', () => {
    const held = CAND_STATUS_FILTERS.find(f => f.value === 'HELD')
    expect(held.label).toBe('Beklemede')
    for (const f of CAND_STATUS_FILTERS) {
      expect(f.label).not.toMatch(/HOLD|STANDBY|PENDING/)
    }
  })
})
