import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge, NoShowBadge } from '../Badges'

/** UI Paket 3 — işletme rozetleri Türkçe; HELD artık ham "HELD" yazmaz. */
const STATUSES = ['PENDING', 'REVIEWING', 'HELD', 'STANDBY', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']

describe('İşletme StatusBadge', () => {
  it('HELD → "Aday onayında" (nötr ton; işletmeden eylem beklenmiyor)', () => {
    render(<StatusBadge status="HELD" />)
    const b = screen.getByText('Aday onayında')
    expect(b.className).toContain('badge-neutral')
  })

  it('PENDING → "Yeni" (attention; işletmenin yanıtı bekleniyor)', () => {
    render(<StatusBadge status="PENDING" />)
    expect(screen.getByText('Yeni').className).toContain('badge-attention')
  })

  it.each(STATUSES)('%s ham enum / İngilizce metin göstermez', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(container.textContent).not.toBe(status)
    expect(container.textContent).not.toMatch(/HOLD|HELD/i)
  })
})

describe('İşletme NoShowBadge', () => {
  it('varsayılan "İşe gelmedi", vardiya satırında kısa etiket; negatif ton', () => {
    const { rerender } = render(<NoShowBadge />)
    expect(screen.getByText('İşe gelmedi').className).toContain('badge-negative')
    rerender(<NoShowBadge label="Gelmedi" />)
    expect(screen.getByText('Gelmedi').className).toContain('badge-negative')
  })
})

import { NoShowSummaryBadge } from '../Badges'

describe('İşletme NoShowSummaryBadge', () => {
  const slots = [{ id: 1 }, { id: 2 }, { id: 3 }]
  it('işaret yoksa hiçbir şey çizmez', () => {
    const { container } = render(<NoShowSummaryBadge app={{ requestedSlots: slots }} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('bir kısım vardiya işaretliyse "N vardiya gelmedi"', () => {
    render(<NoShowSummaryBadge app={{ noShow: true, requestedSlots: slots, noShowSlotIds: [1, 3] }} />)
    expect(screen.getByText('2 vardiya gelmedi').className).toContain('badge-negative')
  })
  it('tüm vardiyalar işaretliyse "İşe gelmedi"', () => {
    render(<NoShowSummaryBadge app={{ noShow: true, requestedSlots: slots, noShowSlotIds: [1, 2, 3] }} />)
    expect(screen.getByText('İşe gelmedi')).toBeInTheDocument()
  })
})
