import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Aday "Takip ettiklerim / Engellediklerim": .ah-segment sekmeleri, cümle düzeni
 * düğmeler; engeli kaldırma artık onay penceresiyle (eskiden tek tık).
 */
const api = vi.hoisted(() => ({
  getMyFollowingBusinesses: vi.fn(),
  getMyBlockedBusinesses: vi.fn(),
  unfollowBusiness: vi.fn(),
  unblockBusiness: vi.fn(),
}))
vi.mock('../../../../api/hotel', () => api)
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
const confirmMock = vi.fn()
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => confirmMock }))

import RelationsTab from '../RelationsTab'

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><RelationsTab /></MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  confirmMock.mockReset()
  api.getMyFollowingBusinesses.mockResolvedValue([{ id: 1, name: 'Deniz Otel', type: 'HOTEL', district: 'Beşiktaş' }])
  api.getMyBlockedBusinesses.mockResolvedValue([{ id: 2, name: 'Kötü Kafe', type: 'CAFE' }])
  api.unfollowBusiness.mockResolvedValue(undefined)
  api.unblockBusiness.mockResolvedValue(undefined)
})

describe('RelationsTab', () => {
  it('takip listesi: profil bağlantısı, Türkçe tür, takipten çık', async () => {
    renderTab()
    expect(await screen.findByText('Deniz Otel')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Takip ettiklerim/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Otel · Beşiktaş')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Deniz Otel/ })).toHaveAttribute('href', '/p/business/1')
    fireEvent.click(screen.getByRole('button', { name: 'Takipten çık' }))
    await waitFor(() => expect(api.unfollowBusiness).toHaveBeenCalledWith(1))
  })

  it('engeli kaldır: onay verilmezse çağrılmaz, verilirse kaldırılır', async () => {
    renderTab()
    fireEvent.click(await screen.findByRole('tab', { name: /Engellediklerim/ }))
    const btn = await screen.findByRole('button', { name: 'Engeli kaldır' })
    confirmMock.mockResolvedValueOnce(false)
    fireEvent.click(btn)
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(confirmMock.mock.calls[0][0]).toMatchObject({ title: 'Engeli kaldır' })
    expect(api.unblockBusiness).not.toHaveBeenCalled()

    confirmMock.mockResolvedValueOnce(true)
    fireEvent.click(btn)
    await waitFor(() => expect(api.unblockBusiness).toHaveBeenCalledWith(2))
  })

  it('yükleme hatasında "Tekrar dene"', async () => {
    api.getMyFollowingBusinesses.mockRejectedValue(new Error('x'))
    renderTab()
    expect(await screen.findByText('Takip ettiğin işletmeler yüklenemedi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument()
  })
})
