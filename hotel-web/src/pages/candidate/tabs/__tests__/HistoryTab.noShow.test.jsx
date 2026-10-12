import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import HistoryTab from '../HistoryTab'

vi.mock('../../../../api/hotel', () => ({ startConversation: vi.fn() }))

const slot = (id, date) => ({ id, date, startTime: '09:00', endTime: '17:00' })
const app = (id, extra = {}) => ({
  id, status: 'ACCEPTED', workCompleted: true, createdAt: '2026-10-01T10:00:00',
  listing: { title: `İlan ${id}`, businessId: id, businessName: `İşletme ${id}`, position: 'WAITER' },
  requestedSlots: [slot(id * 10 + 1, '2026-10-01'), slot(id * 10 + 2, '2026-10-02'), slot(id * 10 + 3, '2026-10-03')],
  noShow: false, noShowSlotIds: [], ...extra,
})

describe('HistoryTab — vardiya bazlı gelmedi', () => {
  it('gelmedi işaretli vardiya saatten düşer, çalışılan vardiyalar kalır', () => {
    render(<HistoryTab applications={[app(1, { noShow: true, noShowSlotIds: [13] })]} />)
    expect(screen.getByText('İlan 1')).toBeInTheDocument()
    // 3 x 8 saat yerine 2 x 8 = 16 saat
    expect(screen.getAllByText((_, el) => el?.textContent === '16sa').length).toBeGreaterThan(0)
  })

  it('tüm vardiyaları gelmedi olan ve eski (vardiyasız) gelmedi kaydı listelenmez', () => {
    render(<HistoryTab applications={[
      app(2, { noShow: true, noShowSlotIds: [21, 22, 23] }),
      app(3, { noShow: true, noShowSlotIds: [] }),
      app(4),
    ]} />)
    expect(screen.queryByText('İlan 2')).toBeNull()
    expect(screen.queryByText('İlan 3')).toBeNull()
    expect(screen.getByText('İlan 4')).toBeInTheDocument()
  })
})
