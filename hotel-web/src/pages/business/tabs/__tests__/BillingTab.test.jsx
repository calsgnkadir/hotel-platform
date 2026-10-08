import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getBilling = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  getBilling: (...a) => getBilling(...a),
  startBillingCheckout: vi.fn(),
  cancelBilling: vi.fn(),
}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => '' }))

import BillingTab from '../BillingTab'

/**
 * Ödeme sistemi kapalıyken (iyzico anahtarı yok) satın alma butonu ve test
 * kartı görünmez; test kartı yalnız sandbox ortamında görünür.
 */
const BASE = {
  status: 'TRIAL', plan: 'STANDARD_MONTHLY', active: false, monthlyPrice: 499,
  freeListings: 5, usedListings: 2, freeRemaining: 3,
}

function renderTab(billing) {
  getBilling.mockResolvedValue({ ...BASE, ...billing })
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/business?tab=billing']}>
        <BillingTab />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BillingTab ödeme durumları', () => {
  beforeEach(() => getBilling.mockReset())

  it('ödeme kapalıyken: satın alma yok, test kartı yok, sınırsız notu var', async () => {
    renderTab({ enforced: false, paymentsAvailable: false, sandbox: false })
    expect(await screen.findByText('İlan yayınlama şimdilik ücretsiz ve sınırsız.')).toBeInTheDocument()
    expect(screen.getByText(/Ücretli abonelik henüz aktif değil/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aboneliğe Geç' })).not.toBeInTheDocument()
    expect(screen.queryByText(/test kartı/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/kullanıldı/)).not.toBeInTheDocument()
    expect(screen.queryByText(/enforce/)).not.toBeInTheDocument()
  })

  it('canlı ödeme açıkken: kota ve satın alma butonu var, test kartı yok', async () => {
    renderTab({ enforced: true, paymentsAvailable: true, sandbox: false })
    expect(await screen.findByRole('button', { name: 'Aboneliğe Geç' })).toBeInTheDocument()
    expect(screen.getByText(/kullanıldı/)).toBeInTheDocument()
    expect(screen.queryByText(/test kartı/i)).not.toBeInTheDocument()
  })

  it('sandbox ortamında test kartı gösterilir', async () => {
    renderTab({ enforced: true, paymentsAvailable: true, sandbox: true })
    expect(await screen.findByText(/test kartı/i)).toBeInTheDocument()
  })

  it('kota dolunca "İlan hakkın doldu" görünür', async () => {
    renderTab({ enforced: true, paymentsAvailable: true, sandbox: false, usedListings: 5, freeRemaining: 0 })
    expect(await screen.findByText('İlan hakkın doldu')).toBeInTheDocument()
  })
})
