import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Gece vardiyası — ilan formu slot satırı: bitiş < başlangıç geçerli
 * ("Ertesi gün biter" + süre), eşit saat ve 16 saati aşan süre hata.
 */
vi.mock('../../../../api/hotel', () => ({ createListing: vi.fn(), updateListing: vi.fn() }))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../../lib/webpush', () => ({ requestPushMoment: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import toast from 'react-hot-toast'
import * as hotelApi from '../../../../api/hotel'
import ListingFormModal from '../ListingFormModal'

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }

function renderWith(startTime, endTime) {
  const listing = {
    id: 5, position: 'WAITER', jobType: 'DAILY', title: 'Gece resepsiyon', description: 'Açıklama',
    salaryMin: 200, salaryType: 'HOURLY', dressCode: 'Siyah', paymentPeriod: 'SAME_DAY', paymentMethod: 'CASH',
    shiftSlots: [{ id: 1, date: day(3), startTime, endTime, slotsNeeded: 1, slotsFilled: 0 }],
  }
  return render(<ListingFormModal listing={listing} onClose={vi.fn()} onSuccess={vi.fn()} />)
}

describe('ListingFormModal gece vardiyası', () => {
  beforeEach(() => vi.clearAllMocks())

  it('22:00–06:00: "Ertesi gün biter" ve 8 saat süre görünür, kayıt gönderilir', async () => {
    hotelApi.updateListing.mockResolvedValue({})
    renderWith('22:00:00', '06:00:00')
    const hint = screen.getByTestId('slot-time-hint')
    expect(hint).toHaveTextContent('Ertesi gün biter')
    expect(hint).toHaveTextContent('8 saat')
    fireEvent.click(screen.getByRole('button', { name: /Güncelle|Kaydet/ }))
    await vi.waitFor(() => expect(hotelApi.updateListing).toHaveBeenCalled())
    const payload = hotelApi.updateListing.mock.calls[0][1]
    expect(payload.shiftSlots[0]).toMatchObject({ startTime: '22:00:00', endTime: '06:00:00' })
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('gündüz vardiyasında "Ertesi gün" notu yok', () => {
    renderWith('09:00:00', '17:00:00')
    expect(screen.getByTestId('slot-time-hint')).toHaveTextContent('8 saat')
    expect(screen.queryByText('Ertesi gün biter')).not.toBeInTheDocument()
  })

  it('eşit saat satırda hata gösterir ve gönderimi engeller', () => {
    const { container } = renderWith('09:00:00', '17:00:00')
    const [, end] = container.querySelectorAll('input[type="time"]')
    fireEvent.change(end, { target: { value: '09:00' } })
    expect(screen.getByTestId('slot-time-error')).toHaveTextContent('Başlangıç ve bitiş saati aynı olamaz')
    fireEvent.click(screen.getByRole('button', { name: /Güncelle|Kaydet/ }))
    expect(toast.error).toHaveBeenCalledWith('Slot 1: Başlangıç ve bitiş saati aynı olamaz')
    expect(hotelApi.updateListing).not.toHaveBeenCalled()
  })

  it('16 saati aşan süre hata verir', () => {
    renderWith('20:00:00', '13:00:00')
    expect(screen.getByTestId('slot-time-error')).toHaveTextContent('Vardiya en fazla 16 saat olabilir')
  })
})
