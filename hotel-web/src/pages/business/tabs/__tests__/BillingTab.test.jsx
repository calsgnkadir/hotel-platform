import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const getBilling = vi.fn()
const cancelBilling = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  getBilling: (...a) => getBilling(...a),
  startBillingCheckout: vi.fn(),
  cancelBilling: (...a) => cancelBilling(...a),
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
  beforeEach(() => { getBilling.mockReset() })  // süslü parantez: dönen fn teardown sayılmasın

  it('ödeme kapalıyken: satın alma yok, test kartı yok, sınırsız notu var', async () => {
    renderTab({ enforced: false, paymentsAvailable: false, sandbox: false })
    expect(await screen.findByText('İlan yayınlama şimdilik ücretsiz ve sınırsız.')).toBeInTheDocument()
    expect(screen.getByText(/Ücretli abonelik henüz aktif değil/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aboneliğe geç' })).not.toBeInTheDocument()
    expect(screen.queryByText(/test kartı/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/kullanıldı/)).not.toBeInTheDocument()
    expect(screen.queryByText(/enforce/)).not.toBeInTheDocument()
  })

  it('canlı ödeme açıkken: kota ve satın alma butonu var, test kartı yok', async () => {
    renderTab({ enforced: true, paymentsAvailable: true, sandbox: false })
    expect(await screen.findByRole('button', { name: 'Aboneliğe geç' })).toBeInTheDocument()
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

/**
 * Otomatik yenileme yok: currentPeriodEnd bitiş tarihidir. İptal edilen abonelik
 * (CANCELED) ödenmiş dönem sonuna kadar active=true kalır.
 */
describe('BillingTab abonelik bitişi / iptal', () => {
  beforeEach(() => { getBilling.mockReset() })  // süslü parantez: dönen fn teardown sayılmasın

  const PERIOD_END = '2026-11-15T12:00:00Z'
  const PERIOD_END_TR = new Date(PERIOD_END).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  it('ACTIVE: "Abonelik bitişi" tarihi görünür, "Bir sonraki yenileme" yok, iptal butonu var', async () => {
    renderTab({ status: 'ACTIVE', active: true, enforced: true, paymentsAvailable: true, currentPeriodEnd: PERIOD_END })
    expect(await screen.findByText('Aktif abonelik')).toBeInTheDocument()
    expect(screen.getByText(/Abonelik bitişi:/)).toBeInTheDocument()
    expect(screen.getByText(PERIOD_END_TR)).toBeInTheDocument()
    expect(screen.queryByText(/Bir sonraki yenileme/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'İptal et' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aboneliği yenile / uzat' })).toBeInTheDocument()
  })

  it('CANCELED + active: iptal metni ve bitiş tarihi görünür, iptal butonu yok', async () => {
    renderTab({ status: 'CANCELED', active: true, enforced: true, paymentsAvailable: true, currentPeriodEnd: PERIOD_END })
    expect(await screen.findByText('İptal edildi (dönem sonuna kadar geçerli)')).toBeInTheDocument()
    expect(screen.getByText(/Aboneliğin iptal edildi;/)).toHaveTextContent(
      `Aboneliğin iptal edildi; ${PERIOD_END_TR} tarihine kadar sınırsız ilan açık.`)
    expect(screen.queryByRole('button', { name: 'İptal et' })).not.toBeInTheDocument()
    expect(screen.queryByText('Aktif abonelik')).not.toBeInTheDocument()
    expect(screen.queryByText(/Bir sonraki yenileme/)).not.toBeInTheDocument()
    // Ödeme açıksa yeniden abone olunabilir
    expect(screen.getByRole('button', { name: 'Aboneliği yenile / uzat' })).toBeInTheDocument()
  })

  it('sunucu hatasında hata durumu ve "Tekrar dene" gösterilir', async () => {
    getBilling.mockImplementation(async () => { throw new Error('500') })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><BillingTab /></MemoryRouter>
      </QueryClientProvider>
    )
    expect(await screen.findByText('Abonelik bilgisi yüklenemedi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument()
  })
})

/**
 * UI Paket 3 — "İptal et" artık onaysız çalışmaz: önce onay penceresi açılır,
 * yalnız onaylanınca cancelBilling çağrılır.
 */
describe('BillingTab abonelik iptali onayı', () => {
  beforeEach(() => { getBilling.mockReset(); cancelBilling.mockReset(); cancelBilling.mockResolvedValue({}) })

  const PERIOD_END = '2026-11-15T12:00:00Z'
  const PERIOD_END_TR = new Date(PERIOD_END).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const ACTIVE = { status: 'ACTIVE', active: true, enforced: true, paymentsAvailable: true, currentPeriodEnd: PERIOD_END }

  it('"İptal et" onay penceresini açar, cancelBilling çağrılmaz', async () => {
    renderTab(ACTIVE)
    fireEvent.click(await screen.findByRole('button', { name: 'İptal et' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Aboneliği iptal et')
    expect(dialog).toHaveTextContent(`Aboneliğin ${PERIOD_END_TR} tarihine kadar geçerli kalır; sonra ücretsiz plana geçersin. Otomatik yenileme zaten yok.`)
    expect(cancelBilling).not.toHaveBeenCalled()
  })

  it('onaylayınca cancelBilling çağrılır', async () => {
    renderTab(ACTIVE)
    fireEvent.click(await screen.findByRole('button', { name: 'İptal et' }))
    const dialog = screen.getByRole('dialog')
    const confirmBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'İptal et')
    fireEvent.click(confirmBtn)
    await waitFor(() => expect(cancelBilling).toHaveBeenCalledTimes(1))
  })

  it('"Vazgeç" pencereyi kapatır, cancelBilling çağrılmaz', async () => {
    renderTab(ACTIVE)
    fireEvent.click(await screen.findByRole('button', { name: 'İptal et' }))
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(cancelBilling).not.toHaveBeenCalled()
  })

  it('bitiş tarihi yoksa metin tarihsiz', async () => {
    renderTab({ ...ACTIVE, currentPeriodEnd: null })
    fireEvent.click(await screen.findByRole('button', { name: 'İptal et' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Aboneliğin dönem sonuna kadar geçerli kalır; sonra ücretsiz plana geçersin.')
  })
})
