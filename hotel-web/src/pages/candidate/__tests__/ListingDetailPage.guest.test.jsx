import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * E8 — Paylaşılan ilandan gelen girişsiz ziyaretçi: "Başvurmak için kayıt ol"
 * birincil, "Giriş yap" ikincil; ikisi de ilana dönüş yolunu (state.from) taşır.
 * Eski '/login?return=' adresi kullanılmaz.
 */
const getListing = vi.fn()
const getBusinessGallery = vi.fn()
const getMyApplications = vi.fn()
const applyToListing = vi.fn()
vi.mock('../../../api/hotel', () => ({
  getListing: (...a) => getListing(...a),
  getBusinessGallery: (...a) => getBusinessGallery(...a),
  getMyApplications: (...a) => getMyApplications(...a),
  trackListingView: vi.fn(),
  getSalaryBenchmark: vi.fn(async () => null),
  getSimilarListings: vi.fn(async () => []),
  applyToListing: (...a) => applyToListing(...a),
}))
vi.mock('../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../lib/webpush', () => ({ requestPushMoment: vi.fn() }))
vi.mock('../../../lib/recentlyViewed', () => ({ recordView: vi.fn() }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
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
  return <div data-testid="where">{loc.pathname}{loc.search}|{JSON.stringify(loc.state)}</div>
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
          <Route path="/login" element={<Where />} />
          <Route path="/register" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
  return qc
}

describe('ListingDetailPage girişsiz ziyaretçi', () => {
  beforeEach(() => {
    getListing.mockReset(); getBusinessGallery.mockReset(); getBusinessGallery.mockResolvedValue([])
    getMyApplications.mockReset(); getMyApplications.mockResolvedValue({ content: [] })
  })

  it('yan panelde "Başvurmak için kayıt ol" birincil, "Giriş yap" ikincil', async () => {
    renderPage()
    const box = await screen.findByTestId('guest-apply-actions')
    const register = within(box).getByRole('button', { name: 'Başvurmak için kayıt ol' })
    const login = within(box).getByRole('button', { name: 'Giriş yap' })
    expect(register).toHaveClass('btn-primary')
    expect(login).toHaveClass('btn-secondary')
  })

  it('kayıt ol: aday rolü seçili ve ilana dönüş yolu taşınır', async () => {
    renderPage()
    const box = await screen.findByTestId('guest-apply-actions')
    fireEvent.click(within(box).getByRole('button', { name: 'Başvurmak için kayıt ol' }))
    const where = screen.getByTestId('where').textContent
    expect(where.startsWith('/register|')).toBe(true)
    expect(JSON.parse(where.split('|')[1])).toMatchObject({
      preselectedRole: 'CANDIDATE', from: { pathname: '/listings/7' },
    })
  })

  it('mobil alt bardaki giriş: /login, state.from = ilan (eski ?return= yok)', async () => {
    renderPage()
    const bar = await screen.findByTestId('mobile-apply-bar')
    fireEvent.click(within(bar).getByRole('button', { name: 'Giriş yap' }))
    const where = screen.getByTestId('where').textContent
    expect(where.startsWith('/login|')).toBe(true)
    expect(where).not.toContain('return=')
    expect(JSON.parse(where.split('|')[1])).toMatchObject({ from: { pathname: '/listings/7' } })
  })

  it('mobil alt barda birincil eylem kayıt', async () => {
    renderPage()
    const bar = await screen.findByTestId('mobile-apply-bar')
    expect(within(bar).getByRole('button', { name: 'Kayıt ol, başvur' })).toHaveClass('btn-primary')
  })
})
