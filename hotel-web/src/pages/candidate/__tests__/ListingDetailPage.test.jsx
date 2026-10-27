import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * UI Paket 3 — ilan detayı mobil öncelikli: sabit alt bar (ücret + Başvur),
 * galeri yalnız fotoğraf varsa, dev harfli kapak yok, bilgi tekrarı yok.
 */
const getListing = vi.fn()
const getSalaryBenchmark = vi.fn()
const getBusinessGallery = vi.fn()
const getMyApplications = vi.fn()
const applyToListing = vi.fn()
vi.mock('../../../api/hotel', () => ({
  getListing: (...a) => getListing(...a),
  getBusinessGallery: (...a) => getBusinessGallery(...a),
  getMyApplications: (...a) => getMyApplications(...a),
  trackListingView: vi.fn(),
  getSalaryBenchmark: (...a) => getSalaryBenchmark(...a),
  getSimilarListings: vi.fn(async () => []),
  applyToListing: (...a) => applyToListing(...a),
}))
vi.mock('../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../lib/webpush', () => ({ requestPushMoment: vi.fn() }))
vi.mock('../../../lib/recentlyViewed', () => ({ recordView: vi.fn() }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'CANDIDATE' } }) }))
vi.mock('../../../components/MapView', () => ({ default: () => null }))
vi.mock('../../../components/GalleryCarousel', () => ({ default: ({ photos }) => <div>galeri {photos?.length}</div> }))
vi.mock('../../../components/HoverPhotoCarousel', () => ({ default: () => null }))
vi.mock('../../../components/SavedSearchManager', () => ({ default: () => null }))
vi.mock('../../../components/ReportModal', () => ({
  default: ({ targetType, targetId }) => <div data-testid="report-modal">{targetType}:{targetId}</div>,
}))
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

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname}{loc.search}</div>
}

function renderPage(listing = LISTING) {
  getListing.mockResolvedValue(listing)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/listings/7']}>
        <Routes>
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/p/business/:id" element={<Where />} />
          <Route path="/candidate" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return qc
}

describe('ListingDetailPage mobil öncelikli', () => {
  beforeEach(() => {
    getListing.mockReset(); getBusinessGallery.mockReset(); getBusinessGallery.mockResolvedValue([])
    getMyApplications.mockReset(); getMyApplications.mockResolvedValue({ content: [] })
    applyToListing.mockReset()
    getSalaryBenchmark.mockReset(); getSalaryBenchmark.mockResolvedValue(null)
  })

  it('ücret karşılaştırması aynı ücret birimiyle istenir ve birimi gösterilir', async () => {
    getSalaryBenchmark.mockResolvedValue({ count: 2, avgMin: 150, avgMax: 200 })
    renderPage({ ...LISTING, salaryType: 'HOURLY', salaryMin: 150 })
    expect(await screen.findByTestId('salary-benchmark')).toHaveTextContent('150 ₺ – 200 ₺ /saat')
    expect(getSalaryBenchmark).toHaveBeenCalledWith('WAITER', 'HOURLY')
  })

  it('görüşülecek ücret için sayısal karşılaştırma gösterilmez', async () => {
    renderPage({ ...LISTING, salaryType: 'NEGOTIABLE' })
    await screen.findByTestId('mobile-apply-bar')
    expect(getSalaryBenchmark).not.toHaveBeenCalled()
    expect(screen.queryByTestId('salary-benchmark')).not.toBeInTheDocument()
  })

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
    expect(screen.getByTestId('listing-meta')).toHaveTextContent('Deniz Otel · Beşiktaş · Günlük')
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

  it('gece vardiyası "ertesi gün" etiketiyle listelenir; dün başlayan vardiya "Geçti"', async () => {
    renderPage({ ...LISTING, shiftSlots: [
      { id: 21, date: day(-2), startTime: '22:00:00', endTime: '06:00:00', slotsNeeded: 2, slotsFilled: 0 },
      { id: 22, date: day(2), startTime: '22:00:00', endTime: '06:00:00', slotsNeeded: 2, slotsFilled: 0 },
    ] })
    expect(await screen.findAllByText('22:00–06:00 (ertesi gün)')).toHaveLength(2)
    expect(screen.getByText('Geçti')).toBeInTheDocument()
    const bar = screen.getByTestId('mobile-apply-bar')
    expect(within(bar).getByRole('button', { name: 'Başvur' })).not.toBeDisabled()
  })

  it('açık vardiya yoksa "Kontenjan doldu" ve pasif', async () => {
    renderPage({ ...LISTING, shiftSlots: [{ ...LISTING.shiftSlots[0], slotsFilled: 3 }] })
    const bar = await screen.findByTestId('mobile-apply-bar')
    expect(within(bar).getByRole('button', { name: 'Kontenjan doldu' })).toBeDisabled()
  })
})

describe('ListingDetailPage başvuru, işletme bağlantısı ve bildirim', () => {
  beforeEach(() => {
    getListing.mockReset(); getBusinessGallery.mockReset(); getBusinessGallery.mockResolvedValue([])
    getMyApplications.mockReset(); getMyApplications.mockResolvedValue({ content: [] })
    applyToListing.mockReset()
  })

  it('işletme adı /p/business/:businessId bağlantısıdır', async () => {
    renderPage()
    const link = within(await screen.findByTestId('listing-meta')).getByRole('link', { name: 'Deniz Otel' })
    expect(link).toHaveAttribute('href', '/p/business/3')
    fireEvent.click(link)
    expect(screen.getByTestId('where')).toHaveTextContent('/p/business/3')
  })

  it('"İlanı bildir" LISTING hedefiyle ilan kimliğini gönderir', async () => {
    renderPage()
    await screen.findByTestId('mobile-apply-bar')
    fireEvent.click(screen.getAllByRole('button', { name: 'İlanı bildir' })[0])
    expect(screen.getByTestId('report-modal')).toHaveTextContent('LISTING:7')
  })

  it('bu ilana süren başvuru varsa düğme "Başvurdun" ve pasif', async () => {
    getMyApplications.mockResolvedValue({ content: [{ id: 50, status: 'PENDING', listing: { id: 7 } }] })
    renderPage()
    const bar = await screen.findByTestId('mobile-apply-bar')
    const btn = await within(bar).findByRole('button', { name: 'Başvurdun' })
    expect(btn).toBeDisabled()
    expect(bar).toHaveTextContent('Bu ilana başvurun var')
  })

  it('reddedilmiş/geri çekilmiş başvuru tekrar başvuruyu engellemez', async () => {
    getMyApplications.mockResolvedValue({ content: [
      { id: 50, status: 'REJECTED', listing: { id: 7 } },
      { id: 51, status: 'WITHDRAWN', listing: { id: 7 } },
    ] })
    renderPage()
    const bar = await screen.findByTestId('mobile-apply-bar')
    await waitFor(() => expect(getMyApplications).toHaveBeenCalled())
    expect(within(bar).getByRole('button', { name: 'Başvur' })).toBeEnabled()
  })

  it('başvuru sonrası onay ekranı açık kalır, sorgular yenilenir, düğme "Başvurdun" olur; sohbete git kimliği taşır', async () => {
    applyToListing.mockResolvedValue({ id: 50, conversationId: 5 })
    const qc = renderPage()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const bar = await screen.findByTestId('mobile-apply-bar')
    fireEvent.click(within(bar).getByRole('button', { name: 'Başvur' }))
    const dialog = screen.getByRole('dialog', { name: 'Hafta sonu garson' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    // Sunucu artık bu başvuruyu döndürür
    getMyApplications.mockResolvedValue({ content: [{ id: 50, status: 'PENDING', listing: { id: 7 } }] })
    fireEvent.click(within(dialog).getByRole('button', { name: '1 vardiyaya başvur' }))

    expect(await screen.findByText('Başvurun gönderildi')).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['applications', 'candidate'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['listings', 'detail', '7'] })
    await waitFor(() => expect(within(screen.getByTestId('mobile-apply-bar')).getByRole('button', { name: 'Başvurdun' })).toBeDisabled())
    // Onay ekranı hâlâ açık
    expect(screen.getByText('Başvurun gönderildi')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Mesajlaşmayı aç' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/candidate?tab=messages&c=5')
  })
})
