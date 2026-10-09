import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * UI Paket 3 — ilan detayı mobil öncelikli: sabit alt bar (ücret + Başvur),
 * galeri yalnız fotoğraf varsa, dev harfli kapak yok, bilgi tekrarı yok.
 */
const getListing = vi.fn()
const getBusinessGallery = vi.fn()
vi.mock('../../../api/hotel', () => ({
  getListing: (...a) => getListing(...a),
  getBusinessGallery: (...a) => getBusinessGallery(...a),
  trackListingView: vi.fn(),
  getSalaryBenchmark: vi.fn(async () => null),
  getSimilarListings: vi.fn(async () => []),
  applyToListing: vi.fn(),
}))
vi.mock('../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../lib/webpush', () => ({ requestPushMoment: vi.fn() }))
vi.mock('../../../lib/recentlyViewed', () => ({ recordView: vi.fn() }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'CANDIDATE' } }) }))
vi.mock('../../../components/MapView', () => ({ default: () => null }))
vi.mock('../../../components/GalleryCarousel', () => ({ default: ({ photos }) => <div>galeri {photos?.length}</div> }))
vi.mock('../../../components/HoverPhotoCarousel', () => ({ default: () => null }))
vi.mock('../../../components/SavedSearchManager', () => ({ default: () => null }))
vi.mock('../../../components/ReportModal', () => ({ default: () => null }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import ListingDetailPage from '../ListingDetailPage'

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }

const LISTING = {
  id: 7, title: 'Hafta sonu garson', position: 'WAITER', jobType: 'DAILY', businessType: 'HOTEL',
  businessId: 3, businessName: 'Deniz Otel', businessDistrict: 'Beşiktaş',
  salaryMin: 1200, salaryType: 'DAILY',
  paymentPeriod: 'SAME_DAY', paymentMethod: 'CASH', dressCode: 'Siyah pantolon',
  description: 'Kahvaltı servisi.',
  shiftSlots: [{ id: 11, date: day(2), startTime: '09:00:00', endTime: '17:00:00', slotsNeeded: 3, slotsFilled: 0 }],
}

function renderPage(listing = LISTING) {
  getListing.mockResolvedValue(listing)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/listings/7']}>
        <Routes><Route path="/listings/:id" element={<ListingDetailPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ListingDetailPage mobil öncelikli', () => {
  beforeEach(() => { getListing.mockReset(); getBusinessGallery.mockReset(); getBusinessGallery.mockResolvedValue([]) })

  it('mobil alt bar ücret (/gün) ve aktif "Başvur" ile render edilir; Başvur pencereyi açar', async () => {
    renderPage()
    const bar = await screen.findByTestId('mobile-apply-bar')
    expect(bar).toHaveTextContent('1.200 ₺')
    expect(bar).toHaveTextContent('/gün')
    const btn = within(bar).getByRole('button', { name: 'Başvur' })
    expect(btn).toBeEnabled()
    fireEvent.click(btn)
    expect(screen.getByRole('dialog', { name: 'Hafta sonu garson' })).toBeInTheDocument()
  })

  it('galeri boşken galeri bölümü yok', async () => {
    renderPage()
    await screen.findByTestId('mobile-apply-bar')
    expect(screen.queryByTestId('listing-gallery')).not.toBeInTheDocument()
    expect(screen.queryByText(/galeri/)).not.toBeInTheDocument()
  })

  it('fotoğraf varsa galeri bölümü gösterilir', async () => {
    getBusinessGallery.mockResolvedValue([{ id: 1, url: 'a.jpg' }, { id: 2, url: 'b.jpg' }])
    renderPage()
    expect(await screen.findByTestId('listing-gallery')).toHaveTextContent('galeri 2')
  })

  it('başlık: pozisyon H1, işletme · ilçe, ücret; ilçe sayfada tekrar etmez', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Garson' })).toBeInTheDocument()
    expect(screen.getByText('Deniz Otel · Beşiktaş · Günlük')).toBeInTheDocument()
    expect(screen.getByTestId('listing-salary')).toHaveTextContent('1.200 ₺/gün')
    // Eski hızlı bilgi kutuları / yan panel "İlçe" satırı yok
    expect(screen.queryByText('İlçe')).not.toBeInTheDocument()
    expect(screen.queryByText('Beşiktaş')).not.toBeInTheDocument()
  })

  it('bölüm sırası: Vardiyalar → Ödeme ve kıyafet → Açıklama', async () => {
    renderPage()
    const v = await screen.findByRole('heading', { level: 2, name: /Vardiyalar/ })
    const o = screen.getByRole('heading', { level: 2, name: 'Ödeme ve kıyafet' })
    const a = screen.getByRole('heading', { level: 2, name: 'Açıklama' })
    expect(v.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(o.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('tüm vardiyalar geçmişse alt bar düğmesi "Süresi doldu" ve pasif', async () => {
    renderPage({ ...LISTING, shiftSlots: [{ ...LISTING.shiftSlots[0], date: day(-3) }] })
    const bar = await screen.findByTestId('mobile-apply-bar')
    expect(within(bar).getByRole('button', { name: 'Süresi doldu' })).toBeDisabled()
  })

  it('açık vardiya yoksa "Kontenjan doldu" ve pasif', async () => {
    renderPage({ ...LISTING, shiftSlots: [{ ...LISTING.shiftSlots[0], slotsFilled: 3 }] })
    const bar = await screen.findByTestId('mobile-apply-bar')
    expect(within(bar).getByRole('button', { name: 'Kontenjan doldu' })).toBeDisabled()
  })
})
