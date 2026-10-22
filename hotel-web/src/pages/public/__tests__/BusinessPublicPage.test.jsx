import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * İşletme sayfası: şikâyet hedefi İŞLETME (eskiden USER + işletme id'si),
 * aday için onaylı "Engelle / Engeli kaldır", logo yedeği baş harf kutusu.
 */
const api = {
  getPublicBusiness: vi.fn(),
  getMyFollowingBusinesses: vi.fn(),
  getMyBlockedBusinesses: vi.fn(),
  getBusinessGallery: vi.fn(),
  followBusiness: vi.fn(),
  unfollowBusiness: vi.fn(),
  blockBusiness: vi.fn(),
  unblockBusiness: vi.fn(),
}
vi.mock('../../../api/hotel', () => ({
  getPublicBusiness: (...a) => api.getPublicBusiness(...a),
  getMyFollowingBusinesses: (...a) => api.getMyFollowingBusinesses(...a),
  getMyBlockedBusinesses: (...a) => api.getMyBlockedBusinesses(...a),
  getBusinessGallery: (...a) => api.getBusinessGallery(...a),
  followBusiness: (...a) => api.followBusiness(...a),
  unfollowBusiness: (...a) => api.unfollowBusiness(...a),
  blockBusiness: (...a) => api.blockBusiness(...a),
  unblockBusiness: (...a) => api.unblockBusiness(...a),
}))
let role = 'CANDIDATE'
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: role ? { id: 1, role } : null }) }))
const confirmMock = vi.fn()
vi.mock('../../../lib/useConfirm', () => ({ useConfirm: () => confirmMock }))
vi.mock('../../../components/MapView', () => ({ default: () => null }))
vi.mock('../../../components/ReportModal', () => ({
  default: ({ targetType, targetId }) => <div data-testid="report-modal">{targetType}:{targetId}</div>,
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import BusinessPublicPage from '../BusinessPublicPage'

const BUSINESS = { id: 3, name: 'deniz otel', type: 'HOTEL', district: 'Beşiktaş' }

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p/business/3']}>
        <Routes><Route path="/p/business/:id" element={<BusinessPublicPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BusinessPublicPage', () => {
  beforeEach(() => {
    role = 'CANDIDATE'
    Object.values(api).forEach(f => f.mockReset())
    api.getPublicBusiness.mockResolvedValue(BUSINESS)
    api.getMyFollowingBusinesses.mockResolvedValue([])
    api.getMyBlockedBusinesses.mockResolvedValue([])
    api.getBusinessGallery.mockResolvedValue([])
    api.blockBusiness.mockResolvedValue(undefined)
    api.unblockBusiness.mockResolvedValue(undefined)
    confirmMock.mockReset()
  })

  it('"İşletmeyi bildir" BUSINESS hedefiyle işletme id\'sini gönderir', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'İşletmeyi bildir' }))
    expect(screen.getByTestId('report-modal')).toHaveTextContent('BUSINESS:3')
  })

  it('logo yoksa baş harf kutusu (Türkçe büyük harf)', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('img', { name: 'deniz otel logosu' })).toHaveTextContent('D')
  })

  it('Engelle: onay verilmezse API çağrılmaz; verilirse engeller', async () => {
    renderPage()
    const btn = await screen.findByRole('button', { name: 'Engelle' })
    confirmMock.mockResolvedValueOnce(false)
    fireEvent.click(btn)
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(confirmMock.mock.calls[0][0]).toMatchObject({ title: 'İşletmeyi engelle', destructive: true })
    expect(api.blockBusiness).not.toHaveBeenCalled()

    confirmMock.mockResolvedValueOnce(true)
    fireEvent.click(btn)
    await waitFor(() => expect(api.blockBusiness).toHaveBeenCalledWith('3'))
  })

  it('engelliyse "Engeli kaldır" onayla engeli kaldırır', async () => {
    api.getMyBlockedBusinesses.mockResolvedValue([{ id: 3 }])
    renderPage()
    const btn = await screen.findByRole('button', { name: 'Engeli kaldır' })
    confirmMock.mockResolvedValueOnce(true)
    fireEvent.click(btn)
    await waitFor(() => expect(api.unblockBusiness).toHaveBeenCalledWith('3'))
    expect(confirmMock.mock.calls[0][0]).toMatchObject({ title: 'Engeli kaldır' })
    expect(api.blockBusiness).not.toHaveBeenCalled()
  })

  it('aday olmayan kullanıcı engelle/bildir düğmelerini görmez', async () => {
    role = 'BUSINESS_OWNER'
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Engelle' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'İşletmeyi bildir' })).not.toBeInTheDocument()
  })

  it('web sitesi yalnız http(s) ise bağlantı; javascript: düz metin', async () => {
    api.getPublicBusiness.mockResolvedValue({ ...BUSINESS, website: 'javascript:alert(1)',
      instagram: 'javascript:alert(2)', facebook: 'otelim' })
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    const text = screen.getByText('javascript:alert(1)')
    expect(text.closest('a')).toBeNull()
    expect(screen.queryByRole('link', { name: 'Instagram' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Facebook' })).toHaveAttribute('href', 'https://facebook.com/otelim')
    for (const a of document.querySelectorAll('a[href]')) {
      expect(a.getAttribute('href').toLowerCase()).not.toMatch(/^javascript:/)
    }
  })

  it('https web sitesi bağlantı olarak gösterilir', async () => {
    api.getPublicBusiness.mockResolvedValue({ ...BUSINESS, website: 'https://www.isletmem.com' })
    renderPage()
    expect(await screen.findByRole('link', { name: 'https://www.isletmem.com' }))
      .toHaveAttribute('href', 'https://www.isletmem.com/')
  })

  it('işletme sahibinin e-postası herkese açık sayfada gösterilmez (yanıtta gelse bile)', async () => {
    api.getPublicBusiness.mockResolvedValue({ ...BUSINESS, email: 'sahip@otel.test' })
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByText('sahip@otel.test')).not.toBeInTheDocument()
    expect(screen.queryByText('E-posta')).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="mailto:"]')).toBeNull()
    // Yalnız e-posta varsa iletişim bölümü boş durumunu gösterir
    expect(screen.getByText('İletişim bilgisi eklenmemiş.')).toBeInTheDocument()
  })

  it('Paket 2: cümle düzeni başlıklar, boş durumlar ve oturuma göre üst düğme', async () => {
    renderPage()
    await screen.findByRole('heading', { level: 1, name: /deniz otel/ })
    expect(screen.getByText('Otel')).toBeInTheDocument()
    expect(screen.queryByText('KADROM')).not.toBeInTheDocument()
    expect(screen.getByText('İşletme henüz tanıtım yazısı eklemedi.')).toBeInTheDocument()
    expect(screen.getByText('İletişim bilgisi eklenmemiş.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Panelime dön' })).toHaveAttribute('href', '/candidate')
    expect(screen.queryByRole('button', { name: 'Giriş yap' })).not.toBeInTheDocument()
  })

  it('misafir "Giriş yap" görür', async () => {
    role = null
    renderPage()
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('button', { name: 'Giriş yap' })).toBeInTheDocument()
  })

  it('404: "İşletme bulunamadı" ve ana sayfa bağlantısı', async () => {
    api.getPublicBusiness.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 404 } }))
    renderPage()
    expect(await screen.findByRole('heading', { name: 'İşletme bulunamadı' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('button', { name: 'Tekrar dene' })).not.toBeInTheDocument()
  })

  it('ağ hatasında "Tekrar dene" yeniden ister', async () => {
    api.getPublicBusiness.mockRejectedValueOnce(new Error('ağ'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByRole('heading', { level: 1, name: /deniz otel/ })).toBeInTheDocument()
  })
})
