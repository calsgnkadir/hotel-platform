import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Yoklama penceresi: API hatasında uyarı okunur ve "Tekrar dene" veriyi
 * yeniden çeker (eskiden hata mesajında takılı kalınıyordu).
 */
const { getAttendance } = vi.hoisted(() => ({ getAttendance: vi.fn() }))
vi.mock('../../../../api/hotel', () => ({
  getAttendance,
  manualCheckIn: vi.fn(),
  downloadRoster: vi.fn(),
}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'Yoklama yüklenemedi' }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../components/AttendanceBoard', () => ({ default: () => <div>Yoklama tahtası</div> }))

import AttendanceModal from '../AttendanceModal'

function renderModal() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <AttendanceModal listing={{ id: 7, title: 'Garson' }} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe('AttendanceModal hata durumu', () => {
  it('hata uyarı olarak okunur ve Tekrar dene yeniden yükler', async () => {
    getAttendance.mockReset()
    getAttendance.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ slots: [] })
    renderModal()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Yoklama yüklenemedi')

    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(screen.getByText('Yoklama tahtası')).toBeInTheDocument())
    expect(getAttendance).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
