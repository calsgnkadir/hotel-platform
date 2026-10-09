import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * UI Paket 2 — başvuru penceresi: alt bar butonları "İptal" / "Başvur" cümle
 * düzeninde, ortak .btn-* stilinde (eskiden type-overline ile BÜYÜK HARF).
 */
vi.mock('../../../api/hotel', () => ({ applyToListing: vi.fn() }))
vi.mock('../../../api/client', () => ({ extractErrorMessage: () => 'hata' }))
vi.mock('../../../lib/webpush', () => ({ requestPushMoment: vi.fn() }))
vi.mock('../../../components/MapView', () => ({ default: () => null }))
vi.mock('../../../components/GalleryCarousel', () => ({ default: () => null }))
vi.mock('../../../components/HoverPhotoCarousel', () => ({ default: () => null }))
vi.mock('../../../components/SavedSearchManager', () => ({ default: () => null }))
vi.mock('../../../components/ReportModal', () => ({ default: () => null }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import { ApplyModal } from '../ListingsPage'

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA') }

const LISTING = {
  id: 1, title: 'Garson', businessName: 'Deniz Otel', businessDistrict: 'Beşiktaş',
  shiftSlots: [{ id: 11, date: day(2), startTime: '09:00:00', endTime: '17:00:00', slotsNeeded: 3, slotsFilled: 0 }],
}

describe('ApplyModal alt bar butonları', () => {
  it('"İptal" ikincil, "Başvur" birincil; büyük harf yok', () => {
    render(<ApplyModal listing={LISTING} onClose={vi.fn()} />)
    const iptal = screen.getByRole('button', { name: 'İptal' })
    const basvur = screen.getByRole('button', { name: 'Başvur' })
    expect(iptal.className).toContain('btn-secondary')
    expect(basvur.className).toContain('btn-primary')
    for (const b of [iptal, basvur]) {
      expect(b.className).not.toMatch(/type-overline|uppercase/)
    }
    expect(screen.queryByText('İPTAL')).not.toBeInTheDocument()
    expect(screen.queryByText('BAŞVUR')).not.toBeInTheDocument()
  })

  it('tüm vardiyalar geçmişteyse buton "Süresi doldu" der ve pasif olur', () => {
    const past = { ...LISTING, shiftSlots: [{ ...LISTING.shiftSlots[0], date: day(-2) }] }
    render(<ApplyModal listing={past} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Süresi doldu' })).toBeDisabled()
  })
})
