import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * UI Paket 5 — İlanlarım kartı: görünür iki eylem (Düzenle, Yoklama), diğerleri
 * "Diğer" menüsünde; "Kapat" ve "Acil" onaylı; yükleme hatası kart + "Tekrar dene";
 * ?attendance=<id> derin linki yoklamayı açar.
 */
const api = vi.hoisted(() => ({
  getMyListings: vi.fn(),
  updateListingStatus: vi.fn(async () => ({})),
  setListingUrgent: vi.fn(async () => ({ notifiedCount: 0 })),
  downloadRoster: vi.fn(),
}))
vi.mock('../../../../api/hotel', () => api)
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../modals/ListingFormModal', () => ({ default: () => <div>form</div> }))
vi.mock('../../modals/AttendanceModal', () => ({ default: ({ listing }) => <div>yoklama: {listing.title}</div> }))
const confirmMock = vi.hoisted(() => vi.fn())
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => confirmMock }))

import MyListingsTab from '../MyListingsTab'

const LISTING = {
  id: 5, title: 'Garson aranıyor', status: 'ACTIVE', position: 'WAITER', jobType: 'DAILY',
  createdAt: '2026-10-01T10:00:00', shiftSlots: [],
}

function renderTab(url = '/business?tab=mylistings') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}><MyListingsTab applications={[]} /></MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getMyListings.mockResolvedValue([LISTING])
})

describe('MyListingsTab eylemleri', () => {
  it('görünür iki eylem + "Diğer"; Kapat/Durdur menüde', async () => {
    renderTab()
    await screen.findByText('Garson aranıyor')
    expect(screen.getByRole('button', { name: 'Düzenle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yoklama' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kapat' })).not.toBeInTheDocument()
    const more = screen.getByRole('button', { name: /diğer eylemler/ })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: 'Kapat' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Durdur' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('"Kapat" onay ister; vazgeçilirse istek gitmez', async () => {
    confirmMock.mockResolvedValueOnce(false)
    renderTab()
    await screen.findByText('Garson aranıyor')
    fireEvent.click(screen.getByRole('button', { name: /diğer eylemler/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Kapat' }))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ destructive: true })))
    expect(api.updateListingStatus).not.toHaveBeenCalled()
  })

  it('"Acil" onaylanınca istek gider', async () => {
    confirmMock.mockResolvedValueOnce(true)
    renderTab()
    await screen.findByText('Garson aranıyor')
    fireEvent.click(screen.getByRole('button', { name: /diğer eylemler/ }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Acil olarak işaretle' }))
    await waitFor(() => expect(api.setListingUrgent).toHaveBeenCalledWith(5, true))
  })

  it('?attendance=<id> derin linki yoklamayı açar', async () => {
    renderTab('/business?tab=mylistings&attendance=5')
    expect(await screen.findByText('yoklama: Garson aranıyor')).toBeInTheDocument()
  })

  it('yükleme hatası: kart + "Tekrar dene"', async () => {
    api.getMyListings.mockRejectedValueOnce(new Error('ağ'))
    renderTab()
    expect(await screen.findByText('İlanların yüklenemedi.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('Garson aranıyor')).toBeInTheDocument()
  })
})
