import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * UI Paket 2 — aday "Başvurularım": kullanıcıya görünen durum adları Türkçe.
 * API değeri HELD aynen kalır; aday "Yanıtın bekleniyor" görür ("HOLD" görünmez).
 */
const respondToHold = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  getActiveSessionsBatch: vi.fn(async () => ({})),
  respondToHold: (...a) => respondToHold(...a),
  respondToStandbyOffer: vi.fn(),
  withdrawApplication: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../../lib/useMyLocation', () => ({
  useMyLocation: () => ({ location: null, loading: false, request: vi.fn() }),
}))
const { confirmSpy } = vi.hoisted(() => ({ confirmSpy: vi.fn(async () => true) }))
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => confirmSpy }))
vi.mock('../../../../components/LegalNotice', () => ({ PlatformRoleNotice: () => null }))
const toastSuccess = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: (...a) => toastSuccess(...a), error: vi.fn() },
}))

import ApplicationsTab from '../ApplicationsTab'
import * as hotelApi from '../../../../api/hotel'

function app(id, status, extra = {}) {
  return {
    id, status,
    createdAt: new Date().toISOString(),
    listing: { title: 'Garson', businessName: 'Deniz Otel', businessDistrict: 'Beşiktaş' },
    requestedSlots: [],
    ...extra,
  }
}

const APPS = [
  app(1, 'PENDING'),
  app(2, 'HELD', { holdDeadline: new Date(Date.now() + 5 * 3600e3).toISOString() }),
]

describe('Aday ApplicationsTab — Türkçe durum etiketleri', () => {
  beforeEach(() => { respondToHold.mockReset(); toastSuccess.mockReset() })

  it('HELD filtresi ve rozeti "Yanıtın bekleniyor" yazar, İngilizce "HOLD" görünmez', () => {
    render(<ApplicationsTab applications={APPS} onRefresh={vi.fn()} />)
    // Filtre çipi (sayaçla birlikte)
    const chip = screen.getAllByRole('button').find(b => b.className.includes('chip') && /Yanıtın bekleniyor/.test(b.textContent))
    expect(chip).toBeTruthy()
    expect(within(chip).getByText('1')).toBeInTheDocument()
    // Satır rozeti + çip = en az 2 "Yanıtın bekleniyor"
    expect(screen.getAllByText('Yanıtın bekleniyor').length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/HOLD/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Hold/)).not.toBeInTheDocument()
  })

  it('bekleyen teklif reddedilince Türkçe toast gösterilir, API değeri değişmez', async () => {
    render(<ApplicationsTab applications={APPS} onRefresh={vi.fn()} />)
    respondToHold.mockResolvedValue({})
    fireEvent.click(screen.getByRole('button', { name: 'Reddet' }))
    await waitFor(() => expect(respondToHold).toHaveBeenCalledWith(2, false))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Teklif reddedildi.'))
  })

  it('satır butonları cümle düzeninde ve ortak buton sınıfını kullanır; reddet kırmızı çerçeveli', () => {
    render(<ApplicationsTab applications={APPS} onRefresh={vi.fn()} />)
    const onayla = screen.getByRole('button', { name: 'Onayla' })
    const reddet = screen.getByRole('button', { name: 'Reddet' })
    expect(onayla.className).toContain('btn-primary')
    expect(reddet.className).toContain('btn-danger')
    expect(reddet.className).not.toMatch(/uppercase/)
    expect(screen.getByRole('button', { name: 'İptal et' })).toBeInTheDocument()
  })
})

describe('Aday ApplicationsTab — düğme önceliği ve filtre çipleri', () => {
  beforeEach(() => { confirmSpy.mockClear(); confirmSpy.mockResolvedValue(true) })

  const chips = () => screen.getAllByRole('button').filter(b => b.className.includes('cand-filter-chip'))

  it('açık mesaide adayın doğrudan çıkış düğmesi yok, görevli QR yönlendirmesi var', async () => {
    hotelApi.getActiveSessionsBatch.mockResolvedValueOnce({ 4: { clockInAt: '2026-10-28T09:00:00' } })
    render(<ApplicationsTab applications={[app(4, 'ACCEPTED')]} onRefresh={vi.fn()} />)
    expect(await screen.findByText(/Çıkış için yukarıdaki çıkış kartını/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mesaiyi bitir' })).not.toBeInTheDocument()
    expect(hotelApi.clockOut).not.toHaveBeenCalled()
  })

  it('Mesajlaşma ikincil, İptal et çerçevesiz metin düğmesi; birincil yalnız gerçek eylem', () => {
    render(<ApplicationsTab applications={[app(1, 'PENDING')]} onRefresh={vi.fn()} />)
    const msg = screen.getByRole('button', { name: 'Mesajlaşma' })
    expect(msg.className).toContain('btn-secondary')
    expect(msg.className).not.toContain('btn-primary')
    const cancel = screen.getByRole('button', { name: 'İptal et' })
    expect(cancel.className).toContain('btn-ghost')
    expect(cancel.className).not.toContain('btn-danger')
    expect(cancel.className).not.toContain('btn-primary')
  })

  it('kabul edilen başvuruda "Mesaiye başla" birincil, Mesajlaşma ikincil', () => {
    render(<ApplicationsTab applications={[app(4, 'ACCEPTED')]} onRefresh={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Mesaiye başla/ }).className).toContain('btn-primary')
    expect(screen.getByRole('button', { name: 'Mesajlaşma' }).className).toContain('btn-secondary')
    expect(screen.queryByRole('button', { name: 'İptal et' })).toBeNull()
  })

  it('İptal et onay penceresini korur, onaylanınca geri çekme çağrılır', async () => {
    const hotel = await import('../../../../api/hotel')
    hotel.withdrawApplication.mockResolvedValue({})
    const onRefresh = vi.fn()
    render(<ApplicationsTab applications={[app(7, 'REVIEWING')]} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: 'İptal et' }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
    expect(confirmSpy.mock.calls[0][0]).toMatchObject({ destructive: true })
    await waitFor(() => expect(hotel.withdrawApplication).toHaveBeenCalledWith(7))
    await waitFor(() => expect(onRefresh).toHaveBeenCalled())
  })

  it('İptal et onayı reddedilirse geri çekme çağrılmaz', async () => {
    const hotel = await import('../../../../api/hotel')
    hotel.withdrawApplication.mockClear()
    confirmSpy.mockResolvedValue(false)
    render(<ApplicationsTab applications={[app(8, 'PENDING')]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'İptal et' }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
    expect(hotel.withdrawApplication).not.toHaveBeenCalled()
  })

  it('sayısı 0 olan çipler gizlenir, "Tümü" her zaman görünür', () => {
    render(<ApplicationsTab applications={[app(1, 'PENDING'), app(2, 'REVIEWING')]} onRefresh={vi.fn()} />)
    expect(chips().map(c => c.textContent)).toEqual(['Tümü2', 'Süren2'])
    expect(screen.queryByRole('button', { name: /Kabul edildi/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Kapanan/ })).toBeNull()
  })

  it('derin linkle seçili grup boş olsa da çipi görünür ve aktif kalır', () => {
    render(<ApplicationsTab applications={[app(1, 'PENDING')]} initialFilter="ACCEPTED" onRefresh={vi.fn()} />)
    const chip = chips().find(c => /Kabul edildi/.test(c.textContent))
    expect(chip).toBeTruthy()
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Bu filtrede başvuru yok')).toBeInTheDocument()
  })
})

describe('Aday ApplicationsTab — işletme logosu', () => {
  it('her satırda ortak BusinessLogo baş harf kutusu', () => {
    render(<ApplicationsTab applications={APPS} onRefresh={vi.fn()} />)
    const boxes = screen.getAllByTestId('business-logo-initial')
    expect(boxes).toHaveLength(2)
    for (const b of boxes) {
      expect(b).toHaveTextContent('D')
      expect(b.style.background).toBe('var(--ah-brand-soft)')
    }
  })
})

describe('Aday ApplicationsTab — vardiya bazlı gelmedi', () => {
  it('işaretlenen vardiya "Gelmedi" rozetiyle listelenir, diğeri listelenmez', () => {
    const slots = [
      { id: 31, date: '2026-10-10', startTime: '08:00:00', endTime: '16:00:00' },
      { id: 32, date: '2099-10-11', startTime: '22:00:00', endTime: '06:00:00' },
    ]
    render(<ApplicationsTab applications={[app(5, 'ACCEPTED', { requestedSlots: slots, noShowSlotIds: [31] })]}
                            onRefresh={vi.fn()} />)
    const list = screen.getByTestId('candidate-no-show-slots')
    expect(within(list).getByText('Gelmedi').className).toContain('badge-negative')
    expect(list).toHaveTextContent('08:00–16:00')
    expect(list).not.toHaveTextContent('22:00')
  })

  it('gelmedi işareti yoksa liste çizilmez', () => {
    render(<ApplicationsTab applications={[app(6, 'ACCEPTED', {
      requestedSlots: [{ id: 40, date: '2099-01-01', startTime: '09:00:00', endTime: '17:00:00' }],
    })]} onRefresh={vi.fn()} />)
    expect(screen.queryByTestId('candidate-no-show-slots')).not.toBeInTheDocument()
  })

  it('acil yedek teklifi kabul onayında "ceza hakkı" terimi; "strike" yok', async () => {
    confirmSpy.mockClear()
    render(<ApplicationsTab applications={[app(3, 'STANDBY', { standbyOfferActive: true })]} onRefresh={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Kabul et' }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
    const arg = confirmSpy.mock.calls[0][0]
    expect(arg.description).toContain('gelmezsen 1 ceza hakkın düşer')
    expect(JSON.stringify(arg)).not.toMatch(/strike/i)
  })
})
