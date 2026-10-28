import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HistoryTab from '../HistoryTab'

const getMyEarnings = vi.fn()
vi.mock('../../../../api/hotel', () => ({ startConversation: vi.fn(), getMyEarnings: (...args) => getMyEarnings(...args) }))

function renderHistory(applications) {
  return render(<QueryClientProvider client={new QueryClient()}><HistoryTab applications={applications} /></QueryClientProvider>)
}

const slot = (id, date) => ({ id, date, startTime: '09:00', endTime: '17:00' })
const app = (id, extra = {}) => ({
  id, status: 'ACCEPTED', workCompleted: true, createdAt: '2026-10-01T10:00:00',
  listing: { title: `İlan ${id}`, businessId: id, businessName: `İşletme ${id}`, position: 'WAITER' },
  requestedSlots: [slot(id * 10 + 1, '2026-10-01'), slot(id * 10 + 2, '2026-10-02'), slot(id * 10 + 3, '2026-10-03')],
  noShow: false, noShowSlotIds: [], ...extra,
})

describe('HistoryTab — vardiya bazlı gelmedi', () => {
  beforeEach(() => { getMyEarnings.mockResolvedValue({ entries: [1, 2, 3, 4].flatMap(id =>
    [1, 2, 3].map(day => ({ applicationId: id, shiftSlotId: id * 10 + day, hours: 8, durationMinutes: 480, hoursSource: 'PLANNED' }))) }) })
  it('gelmedi işaretli vardiya planlanan saatten düşer, kayıt olmadan çalışıldı denmez', async () => {
    renderHistory([app(1, { noShow: true, noShowSlotIds: [13] })])
    expect(screen.getByText('İlan 1')).toBeInTheDocument()
    // 3 x 8 saat yerine 2 x 8 = 16 saat
    expect(await screen.findByText('16 saat planlanan (kayıt yok)')).toBeInTheDocument()
    expect(screen.queryByText('24 saat planlanan (kayıt yok)')).not.toBeInTheDocument()
  })

  it('tüm vardiyaları gelmedi olan ve eski (vardiyasız) gelmedi kaydı listelenmez', () => {
    renderHistory([
      app(2, { noShow: true, noShowSlotIds: [21, 22, 23] }),
      app(3, { noShow: true, noShowSlotIds: [] }),
      app(4),
    ])
    expect(screen.queryByText('İlan 2')).toBeNull()
    expect(screen.queryByText('İlan 3')).toBeNull()
    expect(screen.getByText('İlan 4')).toBeInTheDocument()
  })
})
