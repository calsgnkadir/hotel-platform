import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import HistoryTab from '../HistoryTab'
import { historyHoursForApplication } from '../../../../utils/shifts'

const getMyEarnings = vi.fn()
vi.mock('../../../../api/hotel', () => ({ getMyEarnings: (...args) => getMyEarnings(...args), startConversation: vi.fn() }))
const app = {
  id: 7, status: 'ACCEPTED', workCompleted: true,
  listing: { title: 'Test vardiyası', businessName: 'Test kafe', businessId: 1, position: 'WAITER' },
  requestedSlots: [{ id: 11, date: '2026-10-01', startTime: '09:00', endTime: '17:00' }],
}
const entry = (overrides = {}) => ({ applicationId: 7, shiftSlotId: 11, hours: 6, durationMinutes: 360, hoursSource: 'CLOCKED', ...overrides })
function open() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })}>
    <HistoryTab applications={[app]} />
  </QueryClientProvider>)
}
beforeEach(() => { getMyEarnings.mockReset() })

describe('History actual hours', () => {
  it('8 saat planlanan fakat 6 saat kaydedilen vardiyada 6 saat gösterir', async () => {
    getMyEarnings.mockResolvedValue({ entries: [entry()] })
    open()
    expect(await screen.findByText('6 saat kayıtlı')).toBeInTheDocument()
    expect(screen.getByText('Kaydedilen çalışma')).toBeInTheDocument()
    expect(screen.queryByText(/8 saat/)).not.toBeInTheDocument()
  })

  it('kayıt yoksa planlanan süreyi gerçek çalışmadan ayrı gösterir', async () => {
    getMyEarnings.mockResolvedValue({ entries: [entry({ hours: 8, durationMinutes: 480, hoursSource: 'PLANNED' })] })
    open()
    expect(await screen.findByText('8 saat planlanan (kayıt yok)')).toBeInTheDocument()
    expect(screen.getByText('Giriş/çıkış kaydı yok')).toBeInTheDocument()
    expect(screen.queryByText('8 saat kayıtlı')).not.toBeInTheDocument()
  })

  it('açık mesaiyi planlanan 8 saat çalışılmış gibi saymaz', async () => {
    getMyEarnings.mockResolvedValue({ entries: [entry({ hours: 0, durationMinutes: null, hoursSource: 'INCOMPLETE' })] })
    open()
    expect(await screen.findByText('Çıkış kaydı tamamlanmamış')).toBeInTheDocument()
    expect(screen.queryByText(/8 saat/)).not.toBeInTheDocument()
  })

  it('sıfır süreli kapalı mesaiyi sıfır kayıtlı saat olarak gösterir', async () => {
    getMyEarnings.mockResolvedValue({ entries: [entry({ hours: 0, durationMinutes: 0 })] })
    open()
    expect(await screen.findByText('0 saat kayıtlı')).toBeInTheDocument()
    expect(screen.queryByText('Giriş/çıkış kaydı yok')).not.toBeInTheDocument()
  })

  it('istek başarısızsa uydurma toplam yerine tekrar deneme gösterir', async () => {
    getMyEarnings.mockRejectedValue(new Error('offline'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Çalışma süreleri alınamadı')
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument()
    expect(screen.queryByText(/8 saat/)).not.toBeInTheDocument()
  })

  it('yanıt eksikse çalışma kaydının eksik olduğunu belirtir', async () => {
    getMyEarnings.mockResolvedValue({ entries: [] })
    open()
    expect(await screen.findByText('Çalışma süresi kaydı eksik')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  })
})

it('toplamları yuvarlanmış satır saatlerinden değil kesin dakikadan hesaplar; diğer başvuruyu/slotu saymaz', () => {
  const summary = historyHoursForApplication({ ...app, requestedSlots: [{ id: 11 }, { id: 12 }, { id: 13 }] }, [
    entry({ durationMinutes: 385, hours: 6.4 }), entry({ shiftSlotId: 12, durationMinutes: 385, hours: 6.4 }),
    entry({ shiftSlotId: 13, durationMinutes: 385, hours: 6.4 }), entry({ applicationId: 99 }), entry({ shiftSlotId: 999 }),
  ])
  expect(summary.recordedHours).toBeCloseTo(19.25)
  expect(summary.recordedCount).toBe(3)
  expect(summary.missingCount).toBe(0)
})
