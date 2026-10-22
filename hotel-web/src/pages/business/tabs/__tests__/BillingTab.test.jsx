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
 * Kota eşzamanlıdır: "Aktif ilan: X / Y" (activeListings / concurrentLimit).
 */
const BASE = {
  status: 'TRIAL', plan: 'STANDARD_MONTHLY', active: false, monthlyPrice: 499,
  concurrentLimit: 5, activeListings: 2,
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

  it('ödeme kapalıyken: net ücretsiz metni, aktif ilan sayacı, satın alma ve test kartı yok', async () => {
    renderTab({ enforced: false, paymentsAvailable: false, sandbox: false })
    expect(await screen.findByText('Şu an tüm işletmeler için ücretsiz: aynı anda 5 aktif ilan.')).toBeInTheDocument()
    expect(screen.getByTestId('quota-meter')).toHaveTextContent('Aktif ilan: 2 / 5')
    expect(screen.getByText('Ücretli plan henüz açık değil')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Aboneliğe geç' })).not.toBeInTheDocument()
    expect(screen.queryByText(/test kartı/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/sınırsız/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/enforce/)).not.toBeInTheDocument()
  })

  it('canlı ödeme açıkken: sayaç ve satın alma butonu var, test kartı yok', async () => {
    renderTab({ enforced: true, paymentsAvailable: true, sandbox: false })
    expect(await screen.findByRole('button', { name: 'Aboneliğe geç' })).toBeInTheDocument()
    expect(screen.getByTestId('quota-meter')).toHaveTextContent('Aktif ilan: 2 / 5')
    expect(screen.getByText('Aylık · aynı anda 10 aktif ilan')).toBeInTheDocument()
    expect(screen.queryByText(/test kartı/i)).not.toBeInTheDocument()
  })

  it('abonelikte sınır 10: "Aktif ilan: 7 / 10"', async () => {
    renderTab({ status: 'ACTIVE', active: true, paymentsAvailable: true, concurrentLimit: 10, activeListings: 7 })
    expect(await screen.findByTestId('quota-meter')).toHaveTextContent('Aktif ilan: 7 / 10')
    expect(screen.getByTestId('billing-post-state')).toHaveTextContent('İlan yayınlayabilirsin')
  })

  it('eski yanıt (concurrentLimit yok) freeListings/usedListings ile çalışır', async () => {
    renderTab({ concurrentLimit: undefined, activeListings: undefined, freeListings: 5, usedListings: 4, paymentsAvailable: false })
    expect(await screen.findByTestId('quota-meter')).toHaveTextContent('Aktif ilan: 4 / 5')
  })

  it('sandbox ortamında test kartı gösterilir', async () => {
    renderTab({ enforced: true, paymentsAvailable: true, sandbox: true })
    expect(await screen.findByText(/test kartı/i)).toBeInTheDocument()
  })

  it('sınır dolunca uyarı ve yol gösterme (ödeme kapalı: yalnız ilan kapatma)', async () => {
    renderTab({ paymentsAvailable: false, activeListings: 5 })
    expect(await screen.findByTestId('billing-post-state')).toHaveTextContent('Aktif ilan sınırına ulaştın')
    expect(screen.getByText(/Yeni ilan için yayındaki bir ilanı kapat/)).not.toHaveTextContent(/aboneliğe geç/)
  })

  it('sınır dolunca, ödeme açıksa abonelik de önerilir', async () => {
    renderTab({ paymentsAvailable: true, activeListings: 5 })
    expect(await screen.findByText(/Yeni ilan için yayındaki bir ilanı kapat/)).toHaveTextContent('ya da aboneliğe geç')
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
      `Aboneliğin iptal edildi; ${PERIOD_END_TR} tarihine kadar aynı anda 5 aktif ilan hakkın sürer.`)
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
