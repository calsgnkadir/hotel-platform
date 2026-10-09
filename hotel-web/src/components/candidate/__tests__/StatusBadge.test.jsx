import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge, { CAND_STATUS_FILTERS } from '../StatusBadge'

/**
 * UI Paket 3 — durum etiketleri kaynağında Türkçe. API enum değerleri (HELD vb.)
 * değişmez; kullanıcı hiçbir durumda İngilizce "HOLD" görmez.
 */
const STATUSES = ['PENDING', 'REVIEWING', 'HELD', 'STANDBY', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']

describe('StatusBadge (aday)', () => {
  it('HELD → aday "Yanıtın bekleniyor" (attention), işletme "Aday onayında" (nötr)', () => {
    const { unmount } = render(<StatusBadge status="HELD" />)
    expect(screen.getByText('Yanıtın bekleniyor')).toHaveAttribute('data-tone', 'attention')
    unmount()
    render(<StatusBadge status="HELD" view="business" />)
    expect(screen.getByText('Aday onayında')).toHaveAttribute('data-tone', 'neutral')
  })

  it('STANDBY + aktif teklif → aday "Sıra sende"', () => {
    render(<StatusBadge status="STANDBY" standbyOfferActive />)
    expect(screen.getByText('Sıra sende')).toBeInTheDocument()
  })

  it.each(STATUSES)('%s rozetinde "HOLD" veya ham enum metni yok', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(container.textContent).not.toMatch(/HOLD/i)
    expect(container.textContent).not.toBe(status)
  })

  it('filtre grupları Türkçe; HELD bekleyen eylem grubuna düşer', () => {
    const action = CAND_STATUS_FILTERS.find(f => f.key === 'ACTION')
    expect(action.label).toBe('Yanıtın bekleniyor')
    expect(action.match({ status: 'HELD' })).toBe(true)
    for (const f of CAND_STATUS_FILTERS) {
      expect(f.label).not.toMatch(/HOLD|STANDBY|PENDING/)
    }
  })
})
