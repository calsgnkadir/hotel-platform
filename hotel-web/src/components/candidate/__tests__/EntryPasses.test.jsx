import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom'

vi.mock('../../../api/hotel', () => ({
  getMyPasses: vi.fn(),
  scanPass: vi.fn(),
}))
import * as hotelApi from '../../../api/hotel'
import EntryPasses from '../EntryPasses'
import ScanPassPage from '../../../pages/business/ScanPassPage'

function wrap(ui) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const pass = {
  applicationId: 1, fullName: 'Ayşe Demir', businessName: 'Grand Otel', listingTitle: 'Banket',
  shift: '08:00 – 16:00', passUrl: 'https://kadrom.me/giris/abc.def', usedAt: null,
  meetingPoint: 'B kapısı', meetingMinutesBefore: 30,
}

describe('EntryPasses (çalışan giriş kartı)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('vardiya yoksa hiçbir şey çizmez', async () => {
    hotelApi.getMyPasses.mockResolvedValue([])
    const { container } = wrap(<EntryPasses />)
    await new Promise(r => setTimeout(r, 0))
    expect(container.textContent).toBe('')
  })

  it('bugünkü kartı gösterir, dokununca büyük QR + toplanma açılır', async () => {
    hotelApi.getMyPasses.mockResolvedValue([pass])
    wrap(<EntryPasses />)
    fireEvent.click(await screen.findByText(/Grand Otel · 08:00 – 16:00/))
    expect(screen.getByRole('dialog', { name: 'Giriş kartı' })).toBeInTheDocument()
    expect(screen.getByText('Ayşe Demir')).toBeInTheDocument()
    expect(screen.getByText(/Tek kullanımlıktır/)).toBeInTheDocument()
    expect(screen.getByText(/B kapısı/)).toBeInTheDocument()
  })

  it('okutulmuş kart "kullanıldı" görünür', async () => {
    hotelApi.getMyPasses.mockResolvedValue([{ ...pass, usedAt: '2026-10-03T07:52:00' }])
    wrap(<EntryPasses />)
    expect(await screen.findByText(/Giriş yapıldı · 07:52/)).toBeInTheDocument()
  })

  it('aynı başvurunun ikinci vardiyası kendi kartını açar', async () => {
    hotelApi.getMyPasses.mockResolvedValue([pass, { ...pass, shift: '16:00 – 23:00', passUrl: 'https://kadrom.me/giris/second' }])
    wrap(<EntryPasses />)
    fireEvent.click(await screen.findByText(/Grand Otel · 16:00 – 23:00/))
    expect(screen.getByRole('dialog')).toHaveTextContent('16:00 – 23:00')
    expect(screen.getByRole('dialog')).not.toHaveTextContent('08:00 – 16:00')
  })
})

function renderScan() {
  return render(
    <MemoryRouter initialEntries={['/giris/abc.def']}>
      <Routes><Route path="/giris/:token" element={<ScanPassPage />} /></Routes>
    </MemoryRouter>
  )
}

describe('ScanPassPage (görevli okutma ekranı)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ilk okutmada giriş yazıldı + ad + vardiya', async () => {
    hotelApi.scanPass.mockResolvedValue({
      fullName: 'Ayşe Demir', photoUrl: null, listingTitle: 'Banket',
      shift: '08:00 – 16:00', clockInAt: '2026-10-03T07:50:00', alreadyUsed: false,
    })
    renderScan()
    expect(await screen.findByText(/Giriş yazıldı · 07:50/)).toBeInTheDocument()
    expect(screen.getByText('Ayşe Demir')).toBeInTheDocument()
    expect(hotelApi.scanPass).toHaveBeenCalledTimes(1)
    expect(hotelApi.scanPass).toHaveBeenCalledWith('abc.def')
  })

  it('ikinci okutmada "zaten kullanıldı" uyarısı', async () => {
    hotelApi.scanPass.mockResolvedValue({
      fullName: 'Ayşe Demir', photoUrl: null, listingTitle: 'Banket',
      shift: '08:00 – 16:00', clockInAt: '2026-10-03T07:50:00', alreadyUsed: true,
    })
    renderScan()
    expect(await screen.findByText(/Bu kart zaten kullanıldı · 07:50/)).toBeInTheDocument()
  })

  it('geçersiz kartta hata mesajı', async () => {
    hotelApi.scanPass.mockRejectedValue({ response: { data: { message: 'Giriş kartı geçersiz' } } })
    renderScan()
    expect(await screen.findByText('Geçersiz kart')).toBeInTheDocument()
  })

  it('StrictMode tekrarında yalnız bir istek gönderir', async () => {
    hotelApi.scanPass.mockResolvedValue({ fullName: 'Ayşe', shift: '08:00 – 16:00', clockInAt: '2026-10-03T07:50:00' })
    render(<StrictMode><MemoryRouter initialEntries={['/giris/first']}>
      <Routes><Route path="/giris/:token" element={<ScanPassPage />} /></Routes>
    </MemoryRouter></StrictMode>)
    expect(await screen.findByText('Ayşe')).toBeInTheDocument()
    expect(hotelApi.scanPass).toHaveBeenCalledTimes(1)
  })

  it('yeni karta geçince okutur ve eski isteğin geç yanıtını göstermez', async () => {
    let resolveFirst
    hotelApi.scanPass.mockImplementation(token => token === 'first'
      ? new Promise(resolve => { resolveFirst = resolve })
      : Promise.resolve({ fullName: 'İkinci kişi', shift: '16:00 – 23:00', clockInAt: '2026-10-03T16:00:00' }))
    render(<MemoryRouter initialEntries={['/giris/first']}>
      <Link to="/giris/second">Sonraki kart</Link>
      <Routes><Route path="/giris/:token" element={<ScanPassPage />} /></Routes>
    </MemoryRouter>)
    await waitFor(() => expect(hotelApi.scanPass).toHaveBeenCalledWith('first'))
    fireEvent.click(screen.getByText('Sonraki kart'))
    expect(await screen.findByText('İkinci kişi')).toBeInTheDocument()
    await act(async () => resolveFirst({ fullName: 'Eski kişi', clockInAt: '2026-10-03T07:50:00' }))
    expect(screen.queryByText('Eski kişi')).not.toBeInTheDocument()
    expect(hotelApi.scanPass).toHaveBeenCalledTimes(2)
  })
})
