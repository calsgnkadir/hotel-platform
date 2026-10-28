import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ExitPasses from '../ExitPasses'
import ScanPassPage from '../../../pages/business/ScanPassPage'

vi.mock('../../../api/hotel', () => ({ getMyExitPasses: vi.fn(), scanExitPass: vi.fn(), scanPass: vi.fn() }))
import * as hotelApi from '../../../api/hotel'
const pass = { applicationId: 7, sessionId: 9, fullName: 'Ayşe Demir', businessName: 'Test Kafe', shift: '22:00 – 06:00', passUrl: 'https://kadrom.me/cikis/first' }
function renderPass(onSessionChange) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
  const result = render(<QueryClientProvider client={client}><ExitPasses onSessionChange={onSessionChange} /></QueryClientProvider>)
  return { client, ...result }
}
beforeEach(() => { vi.resetAllMocks() })

describe('Çıkış kartı', () => {
  it('ilk sorgu sürerken yükleme durumunu gösterir', () => {
    hotelApi.getMyExitPasses.mockImplementation(() => new Promise(() => {}))
    renderPass()
    expect(screen.getByRole('status')).toHaveTextContent('Çıkış kartları kontrol ediliyor')
  })
  it('açık oturum yoksa kart göstermez', async () => {
    hotelApi.getMyExitPasses.mockResolvedValue([])
    const { container } = renderPass()
    await waitFor(() => expect(container.textContent).toBe(''))
  })
  it('kartı açar ve görevliye okutulacağını açıklar', async () => {
    hotelApi.getMyExitPasses.mockResolvedValue([pass])
    renderPass()
    fireEvent.click(await screen.findByRole('button', { name: /Çıkış kartın/ }))
    const dialog = screen.getByRole('dialog', { name: 'Çıkış kartı' })
    expect(dialog).toHaveTextContent('Ayşe Demir')
    expect(dialog).toHaveTextContent('22:00 – 06:00 (ertesi gün)')
    expect(dialog).toHaveTextContent('işletme görevlisine okut')
    expect(dialog.querySelector('svg')).toBeTruthy()
  })
  it('yenilenen token modalı kapatmaz; oturum kaybolunca eski kodu göstermeyi bırakır', async () => {
    hotelApi.getMyExitPasses.mockResolvedValue([pass])
    const changed = vi.fn()
    const { client } = renderPass(changed)
    fireEvent.click(await screen.findByRole('button', { name: /Çıkış kartın/ }))
    const oldCode = screen.getByRole('dialog').querySelector('svg').outerHTML
    client.setQueryData(['exit-passes'], [{ ...pass, passUrl: 'https://kadrom.me/cikis/refreshed' }])
    expect(await screen.findByRole('dialog', { name: 'Çıkış kartı' })).toHaveTextContent('Ayşe Demir')
    await waitFor(() => expect(screen.getByRole('dialog').querySelector('svg').outerHTML).not.toBe(oldCode))
    client.setQueryData(['exit-passes'], [])
    expect(await screen.findByText(/açık çıkış kartı artık bulunmuyor/)).toBeInTheDocument()
    expect(screen.getByRole('dialog').querySelector('svg')).toBeNull()
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
  })
  it('küçük QR okutulduğunda modal açılmasa da oturum değişikliğini bildirir; token yenilenmesi bildirmez', async () => {
    hotelApi.getMyExitPasses.mockResolvedValue([pass])
    const changed = vi.fn()
    const { client } = renderPass(changed)
    expect(await screen.findByRole('button', { name: /Çıkış kartın/ })).toBeInTheDocument()
    expect(changed).not.toHaveBeenCalled()
    client.setQueryData(['exit-passes'], [{ ...pass, passUrl: 'https://kadrom.me/cikis/new-token', businessName: 'Yeni isim' }])
    await screen.findByText(/Yeni isim/)
    expect(changed).not.toHaveBeenCalled()
    client.setQueryData(['exit-passes'], [])
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('button', { name: /Çıkış kartın/ })).not.toBeInTheDocument()
    client.setQueryData(['exit-passes'], [{ ...pass, sessionId: 10 }])
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(2))
  })
  it('servis hatasında uyarı ve yeniden deneme sunar', async () => {
    hotelApi.getMyExitPasses.mockRejectedValue(new Error('offline'))
    renderPass()
    expect(await screen.findByRole('alert')).toHaveTextContent('Çıkış kartları alınamadı')
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument()
  })
})

describe('İşletme çıkış kartı okutma', () => {
  function scan() { return render(<MemoryRouter initialEntries={['/cikis/a.b']}>
    <Routes><Route path="/cikis/:token" element={<ScanPassPage mode="exit" />} /></Routes>
  </MemoryRouter>) }
  it('çıkışı kaydeder ve kişi bilgilerini gösterir', async () => {
    hotelApi.scanExitPass.mockResolvedValue({ fullName: 'Ayşe Demir', listingTitle: 'Test', shift: '09:00 – 17:00', clockOutAt: '2026-10-28T17:30:00', alreadyUsed: false })
    scan()
    expect(await screen.findByText(/Çıkış yazıldı/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ayşe Demir' })).toBeInTheDocument()
    expect(hotelApi.scanExitPass).toHaveBeenCalledWith('a.b')
    expect(hotelApi.scanPass).not.toHaveBeenCalled()
  })
  it('aynı kart tekrar okunursa yeniden çıkış yazdı demez', async () => {
    hotelApi.scanExitPass.mockResolvedValue({ fullName: 'Ayşe', clockOutAt: '2026-10-28T17:30:00', alreadyUsed: true })
    scan()
    expect(await screen.findByText(/Bu kart zaten kullanıldı/)).toBeInTheDocument()
    expect(screen.queryByText(/Çıkış yazıldı/)).not.toBeInTheDocument()
  })
  it('yetki veya geçersiz kart hatasını gösterir', async () => {
    hotelApi.scanExitPass.mockRejectedValue({ response: { data: { message: 'Bu kart senin işletmene ait değil' } } })
    scan()
    expect(await screen.findByText('Bu kart senin işletmene ait değil')).toBeInTheDocument()
  })
})
