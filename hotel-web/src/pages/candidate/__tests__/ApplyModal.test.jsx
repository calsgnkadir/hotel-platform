import { render, screen, fireEvent } from '@testing-library/react'
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

/**
 * UI Paket 3 — mobil öncelikli akış: önce vardiya, ön yazı varsayılan kapalı
 * (açılışta klavye açılmasın), vardiya seçilmeden "Başvur" pasif + gerekçe.
 */
describe('ApplyModal mobil öncelikli akış', () => {
  const TWO = {
    ...LISTING,
    paymentPeriod: 'SAME_DAY', paymentMethod: 'CASH', dressCode: 'Siyah pantolon, beyaz gömlek\nKimlik getir',
    shiftSlots: [
      { id: 11, date: day(2), startTime: '09:00:00', endTime: '17:00:00', slotsNeeded: 3, slotsFilled: 0 },
      { id: 12, date: day(3), startTime: '09:00:00', endTime: '17:00:00', slotsNeeded: 2, slotsFilled: 0 },
    ],
  }

  it('açılışta textarea yok ve odak bir metin alanında değil', () => {
    render(<ApplyModal listing={TWO} onClose={vi.fn()} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(document.activeElement?.tagName).not.toBe('TEXTAREA')
    expect(document.activeElement?.tagName).not.toBe('INPUT')
  })

  it('vardiya seçilmeden "Başvur" pasif ve gerekçe metni görünür', () => {
    render(<ApplyModal listing={TWO} onClose={vi.fn()} />)
    const btn = screen.getByRole('button', { name: 'Başvur' })
    expect(btn).toBeDisabled()
    expect(screen.getByText('Önce en az bir vardiya seç')).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-describedby', 'apply-submit-hint')
  })

  it('2 vardiya seçince buton "2 vardiyaya başvur" olur ve aktifleşir', () => {
    render(<ApplyModal listing={TWO} onClose={vi.fn()} />)
    const boxes = screen.getAllByRole('checkbox')
    fireEvent.click(boxes[0])
    expect(screen.getByRole('button', { name: '1 vardiyaya başvur' })).toBeEnabled()
    fireEvent.click(boxes[1])
    expect(screen.getByRole('button', { name: '2 vardiyaya başvur' })).toBeEnabled()
    expect(screen.queryByText('Önce en az bir vardiya seç')).not.toBeInTheDocument()
  })

  it('"Not ekle" ile textarea açılır', () => {
    render(<ApplyModal listing={TWO} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Not ekle (isteğe bağlı)' }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Not ekle (isteğe bağlı)' })).not.toBeInTheDocument()
  })

  it('sıra: vardiya → ödeme/kıyafet özeti → not; özet Türkçe etiketli tek satır', () => {
    render(<ApplyModal listing={TWO} onClose={vi.fn()} />)
    const terms = screen.getByTestId('apply-terms')
    expect(terms).toHaveTextContent('Ödeme: Aynı gün · Elden nakit · Kıyafet: Siyah pantolon, beyaz gömlek')
    expect(terms).not.toHaveTextContent('Kimlik getir')
    const legend = screen.getByText('Vardiya seçimi *', { exact: false })
    const note = screen.getByRole('button', { name: 'Not ekle (isteğe bağlı)' })
    expect(legend.compareDocumentPosition(terms) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(terms.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('başlıkta "?" yerine işletme baş harfi', () => {
    render(<ApplyModal listing={TWO} onClose={vi.fn()} />)
    expect(screen.getByText('D')).toBeInTheDocument()
    expect(screen.queryByText('?')).not.toBeInTheDocument()
  })
})
