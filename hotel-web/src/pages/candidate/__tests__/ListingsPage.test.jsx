import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * UI Paket 4 — ilan listesi: sayaç/boş durum görünen listeden, hata kartı +
 * "Tekrar dene", birimli ücret çipleri, istemci tarafı "Vardiya saati" filtresi,
 * "Daha fazla göster", erişilebilir kart (başlık bağlantısı) ve ücret normalizasyonu.
 */
const api = vi.hoisted(() => ({
  getListings: vi.fn(),
  getMySavedListings: vi.fn(async () => []),
  getMyBlockedBusinesses: vi.fn(async () => []),
  getAvailabilityNow: vi.fn(async () => ({ availableNow: false })),
  setAvailabilityNow: vi.fn(),
  saveListing: vi.fn(), unsaveListing: vi.fn(),
  createSavedSearch: vi.fn(),
}))
vi.mock('../../../api/hotel', () => api)
vi.mock('../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../lib/webpush', () => ({ requestPushMoment: vi.fn() }))
vi.mock('../../../components/SavedSearchManager', () => ({ default: () => null }))
vi.mock('../../../lib/useMyLocation', () => ({
  useMyLocation: () => ({ location: null, loading: false, error: null, request: vi.fn() }),
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toast }))

import ListingsPage, {
  dailyWage, compareByDailyWageDesc, ListingCard, LISTINGS_PAGE_SIZE,
} from '../ListingsPage'

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }
const slot = (id, start = '09:00:00', end = '17:00:00', n = 2) =>
  ({ id, date: day(n), startTime: start, endTime: end, slotsNeeded: 2, slotsFilled: 0 })
const L = (id, extra = {}) => ({
  id, position: 'WAITER', businessId: 100 + id, businessName: `Otel ${id}`, businessDistrict: 'Şişli',
  jobType: 'DAILY', salaryType: 'DAILY', salaryMin: 1000, shiftSlots: [slot(id * 10)], ...extra,
})

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><ListingsPage /></MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  api.getMySavedListings.mockResolvedValue([])
  api.getMyBlockedBusinesses.mockResolvedValue([])
})

describe('ListingsPage sayaç ve boş durum', () => {
  it('sayaç engelli işletme süzgecinden SONRAKİ listeyi sayar', async () => {
    api.getListings.mockResolvedValue([L(1), L(2), L(3)])
    api.getMyBlockedBusinesses.mockResolvedValue([{ id: 102 }])
    renderPage()
    await waitFor(() => expect(screen.getByTestId('listing-count')).toHaveTextContent('2 ilan'))
    expect(screen.getAllByTestId('listing-card')).toHaveLength(2)
  })

  it('tüm ilanlar engelliyse boş durum görünür', async () => {
    api.getListings.mockResolvedValue([L(1)])
    api.getMyBlockedBusinesses.mockResolvedValue([{ id: 101 }])
    renderPage()
    expect(await screen.findByText('Henüz aktif ilan yok')).toBeInTheDocument()
  })
})

describe('ListingsPage hata durumu', () => {
  it('hata kartı + "Tekrar dene"; render sırasında toast atılmaz', async () => {
    api.getListings.mockRejectedValueOnce(new Error('ağ'))
    renderPage()
    expect(await screen.findByText('İlanlar yüklenemedi.')).toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
    api.getListings.mockResolvedValueOnce([L(1)])
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(screen.getAllByTestId('listing-card')).toHaveLength(1))
  })
})

describe('ListingsPage filtreler', () => {
  it('çalışma türü "Tümü"yken ücret çipleri yok, ipucu var; tür seçilince birimli çipler', async () => {
    api.getListings.mockResolvedValue([L(1)])
    renderPage()
    await screen.findAllByTestId('listing-card')
    expect(screen.getByTestId('salary-hint')).toHaveTextContent('Önce çalışma türü seç')
    fireEvent.click(screen.getByRole('button', { name: 'Günlük' }))
    expect(screen.getByRole('button', { name: '1.000 ₺/gün+' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Daimi' }))
    expect(screen.getByRole('button', { name: '20.000 ₺/ay+' })).toBeInTheDocument()
  })

  it('"Hafta sonu" yazımı doğru; eski "Haftasonu" yok', async () => {
    api.getListings.mockResolvedValue([L(1)])
    renderPage()
    await screen.findAllByTestId('listing-card')
    expect(screen.getByRole('button', { name: 'Hafta sonu' })).toBeInTheDocument()
    expect(screen.queryByText('Haftasonu')).not.toBeInTheDocument()
  })

  it('"Vardiya saati" istemci tarafında süzer ve API\'ye shifts göndermez', async () => {
    api.getListings.mockResolvedValue([
      L(1, { shiftSlots: [slot(11, '08:00:00', '16:00:00')] }),
      L(2, { shiftSlots: [slot(21, '22:00:00', '06:00:00')] }),
    ])
    renderPage()
    await waitFor(() => expect(screen.getAllByTestId('listing-card')).toHaveLength(2))
    fireEvent.click(screen.getByRole('button', { name: /Gece/ }))
    await waitFor(() => expect(screen.getAllByTestId('listing-card')).toHaveLength(1))
    expect(screen.getByText('Otel 2')).toBeInTheDocument()
    expect(screen.getByTestId('listing-count')).toHaveTextContent('1 ilan')
    for (const call of api.getListings.mock.calls) expect(call[0].shifts).toBeUndefined()
  })
})

describe('ListingsPage yoğunluk', () => {
  it(`ilk ${LISTINGS_PAGE_SIZE} kart, "Daha fazla göster" ile devamı`, async () => {
    api.getListings.mockResolvedValue(Array.from({ length: 15 }, (_, i) => L(i + 1)))
    renderPage()
    await waitFor(() => expect(screen.getAllByTestId('listing-card')).toHaveLength(LISTINGS_PAGE_SIZE))
    expect(screen.getByText(`${LISTINGS_PAGE_SIZE} / 15 ilan gösteriliyor`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Daha fazla göster' }))
    await waitFor(() => expect(screen.getAllByTestId('listing-card')).toHaveLength(15))
    expect(screen.queryByRole('button', { name: 'Daha fazla göster' })).not.toBeInTheDocument()
  })

  it('mobil filtre alt sayfası "N ilanı göster" ile kapanır', async () => {
    api.getListings.mockResolvedValue([L(1), L(2)])
    renderPage()
    await screen.findAllByTestId('listing-card')
    fireEvent.click(screen.getAllByRole('button', { name: /Filtreler/ }).find(b => b.getAttribute('aria-controls') === 'listing-filters'))
    const sheet = screen.getByRole('dialog', { name: 'Filtreler' })
    const apply = within(sheet).getByTestId('filters-apply')
    expect(apply).toHaveTextContent('2 ilanı göster')
    fireEvent.click(apply)
    expect(screen.queryByRole('dialog', { name: 'Filtreler' })).not.toBeInTheDocument()
  })
})

describe('ListingCard erişilebilirlik', () => {
  const wrap = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

  it('başlık /listings/:id bağlantısı; kart role="button" değil; iç içe düğme yok', () => {
    const onDetail = vi.fn()
    wrap(<ListingCard listing={L(7)} onApply={vi.fn()} onDetail={onDetail} savedIds={new Set()} />)
    const link = screen.getByRole('link', { name: 'Garson' })
    expect(link).toHaveAttribute('href', '/listings/7')
    const card = screen.getByTestId('listing-card')
    expect(card).not.toHaveAttribute('role', 'button')
    expect(card.querySelector('button button, a button, button a')).toBeNull()
    fireEvent.click(link)
    expect(onDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }))
  })

  it('süresi dolan kartta opaklık yerine "Süresi doldu" etiketi', () => {
    wrap(<ListingCard listing={L(8, { shiftSlots: [slot(81, '09:00:00', '17:00:00', -2)] })}
                      onApply={vi.fn()} onDetail={vi.fn()} savedIds={new Set()} />)
    const card = screen.getByTestId('listing-card')
    expect(card.getAttribute('style') || '').not.toMatch(/opacity/)
    expect(within(card).getByText('Süresi doldu')).toHaveClass('badge')
  })

  it('kaydet düğmesi aria-pressed taşır', () => {
    wrap(<ListingCard listing={L(9)} onApply={vi.fn()} onDetail={vi.fn()} savedIds={new Set([9])} onToggleSave={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Kaydedilenlerden çıkar' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Ücret sıralaması (günlük karşılık)', () => {
  it('saatlik×8, günlük×1, aylık/26; görüşülecek/bilinmeyen null', () => {
    expect(dailyWage({ salaryType: 'HOURLY', salaryMin: 200 })).toBe(1600)
    expect(dailyWage({ salaryType: 'DAILY', salaryMin: 1000, salaryMax: 1500 })).toBe(1500)
    expect(dailyWage({ salaryType: 'MONTHLY', salaryMin: 26000 })).toBe(1000)
    expect(dailyWage({ salaryType: 'NEGOTIABLE', salaryMin: 1000 })).toBeNull()
    expect(dailyWage({ salaryMin: 1000 })).toBeNull()
  })

  it('aylık 30.000 (≈1.154/gün) günlük 1.500\'ün altında sıralanır; birimsiz en sonda', () => {
    const list = [
      { id: 'm', salaryType: 'MONTHLY', salaryMin: 30000 },
      { id: 'x', salaryMin: 99999 },
      { id: 'd', salaryType: 'DAILY', salaryMin: 1500 },
      { id: 'h', salaryType: 'HOURLY', salaryMin: 250 },
    ]
    expect([...list].sort(compareByDailyWageDesc).map(l => l.id)).toEqual(['h', 'd', 'm', 'x'])
  })
})
