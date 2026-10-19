import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Yeni ilan formunda eşzamanlı kota: "Aktif ilan: X / Y". Bilgi amaçlı;
 * kural backend'de. Düzenlemede gösterilmez; özet alınamazsa form engellenmez.
 */
const getBilling = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  createListing: vi.fn(), updateListing: vi.fn(),
  getBilling: (...a) => getBilling(...a),
}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../../lib/webpush', () => ({ requestPushMoment: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

import ListingFormModal from '../ListingFormModal'

describe('ListingFormModal kota notu', () => {
  beforeEach(() => getBilling.mockReset())

  it('yeni ilanda "Aktif ilan: 3 / 5" ve kalan hak', async () => {
    getBilling.mockResolvedValue({ concurrentLimit: 5, activeListings: 3 })
    render(<ListingFormModal onClose={vi.fn()} onSuccess={vi.fn()} />)
    const note = await screen.findByTestId('listing-form-quota')
    expect(note).toHaveTextContent('Aktif ilan: 3 / 5')
    expect(note).toHaveTextContent('2 ilan daha açabilirsin.')
  })

  it('sınır doluysa uyarı (rol alert), form yine açık', async () => {
    getBilling.mockResolvedValue({ concurrentLimit: 5, activeListings: 5 })
    render(<ListingFormModal onClose={vi.fn()} onSuccess={vi.fn()} />)
    const note = await screen.findByRole('alert')
    expect(note).toHaveTextContent('Aktif ilan: 5 / 5')
    expect(note).toHaveTextContent('Yeni ilan için yayındaki bir ilanı kapat.')
    expect(screen.getByLabelText('İlan başlığı *')).toBeEnabled()
  })

  it('düzenlemede kota sorgulanmaz', () => {
    render(<ListingFormModal listing={{ id: 1, title: 'x', shiftSlots: [] }} onClose={vi.fn()} onSuccess={vi.fn()} />)
    expect(getBilling).not.toHaveBeenCalled()
    expect(screen.queryByTestId('listing-form-quota')).not.toBeInTheDocument()
  })

  it('özet boş dönerse not görünmez', async () => {
    getBilling.mockResolvedValue(null)
    render(<ListingFormModal onClose={vi.fn()} onSuccess={vi.fn()} />)
    await new Promise(r => setTimeout(r, 20))
    expect(screen.queryByTestId('listing-form-quota')).not.toBeInTheDocument()
  })
})
