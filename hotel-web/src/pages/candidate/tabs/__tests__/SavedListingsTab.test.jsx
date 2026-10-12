import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getMySavedListings = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  getMySavedListings: (...a) => getMySavedListings(...a),
  unsaveListing: vi.fn(),
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import SavedListingsTab from '../SavedListingsTab'

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><SavedListingsTab /></MemoryRouter>
    </QueryClientProvider>
  )
}

describe('SavedListingsTab işletme logosu', () => {
  it('logo varsa görsel, yoksa baş harf kutusu', async () => {
    getMySavedListings.mockResolvedValue([
      { id: 1, title: 'Garson', businessName: 'Deniz Otel', businessLogoUrl: 'https://cdn.example.com/deniz.png', position: 'WAITER', jobType: 'DAILY' },
      { id: 2, title: 'Barista', businessName: 'Mavi Kafe', position: 'WAITER', jobType: 'DAILY' },
    ])
    renderTab()
    expect(await screen.findByText('Barista')).toBeInTheDocument()
    expect(screen.getByTestId('business-logo-img')).toHaveAttribute('src', expect.stringContaining('deniz.png'))
    expect(screen.getByTestId('business-logo-initial')).toHaveTextContent('M')
  })

  it('boş listede boş durum gösterilir', async () => {
    getMySavedListings.mockResolvedValue([])
    renderTab()
    expect(await screen.findByText('Henüz kaydettiğin ilan yok')).toBeInTheDocument()
  })
})
