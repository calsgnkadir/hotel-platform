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
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => async () => true }))
vi.mock('../../../../components/LegalNotice', () => ({ PlatformRoleNotice: () => null }))
const toastSuccess = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: (...a) => toastSuccess(...a), error: vi.fn() },
}))

import ApplicationsTab from '../ApplicationsTab'

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
})
