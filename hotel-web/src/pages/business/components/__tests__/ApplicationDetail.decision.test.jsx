import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Başvuru detayı: karar düğmeleri ayırt edilebilir (Kabul birincil, Beklet/Yedeğe al
 * ikincil, Reddet tehlikeli), müsaitlik günü Türkçe, okunur not/no-show metni,
 * Türkçe karakterli metinler, "Sohbete git" sohbet kimliğini iletir.
 */
const startConversation = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  checkFavorite: vi.fn(async () => false),
  startConversation: (...a) => startConversation(...a),
}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'Hata' }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => vi.fn(async () => false) }))
vi.mock('../../../../lib/confetti', () => ({ celebrate: vi.fn() }))
vi.mock('../../../../components/LegalNotice', () => ({ SgkNotice: () => null }))

import ApplicationDetail from '../ApplicationDetail'

const APP = {
  id: 11,
  status: 'PENDING',
  note: 'Deneyimli, hafta sonu uygun.',
  candidate: { id: 42, fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' },
  listing: { title: 'Garson', businessName: 'Deniz Otel' },
  availabilities: [{ dayOfWeek: 'MONDAY', startTime: '09:00:00', endTime: '17:00:00' }],
}

describe('ApplicationDetail karar düğmeleri ve metinler', () => {
  beforeEach(() => { startConversation.mockReset() })

  it('Kabul btn-primary, Beklet ve Yedeğe al btn-secondary, Reddet btn-danger', () => {
    render(<ApplicationDetail app={APP} />)
    expect(screen.getByRole('button', { name: 'Kabul et' }).className).toContain('btn-primary')
    expect(screen.getByRole('button', { name: '24 sa beklet' }).className).toContain('btn-secondary')
    expect(screen.getByRole('button', { name: /Yedeğe al/ }).className).toContain('btn-secondary')
    expect(screen.getByRole('button', { name: 'Reddet' }).className).toContain('btn-danger')
  })

  it('yedekteki aday: Direkt kabul birincil, Yedeklikten çıkar ikincil', () => {
    render(<ApplicationDetail app={{ ...APP, status: 'STANDBY' }} />)
    expect(screen.getByRole('button', { name: 'Direkt kabul' }).className).toContain('btn-primary')
    expect(screen.getByRole('button', { name: 'Yedeklikten çıkar' }).className).toContain('btn-secondary')
  })

  it('müsaitlik günü Türkçe, saat sade; ham enum görünmez', () => {
    render(<ApplicationDetail app={APP} />)
    expect(screen.getByText('Pazartesi · 09:00–17:00')).toBeInTheDocument()
    expect(screen.queryByText(/MONDAY/)).not.toBeInTheDocument()
  })

  it('not metni okunur tonda (soluk gri yok)', () => {
    render(<ApplicationDetail app={APP} />)
    const note = screen.getByTestId('application-note')
    expect(note.style.color).toBe('var(--ah-ink-2)')
  })

  it('no-show bandı uyarı zemini ve okunur başlık kullanır', () => {
    render(<ApplicationDetail app={{ ...APP, status: 'ACCEPTED', noShow: true }} />)
    const banner = screen.getByTestId('no-show-banner')
    expect(banner.style.background).toBe('var(--ah-warn-soft)')
    expect(screen.getByText('Gelmedi olarak işaretlendi').style.color).toBe('var(--ah-ink-2)')
  })

  it('Türkçe karakterli metinler (ASCII değil)', () => {
    render(<ApplicationDetail app={APP} />)
    expect(screen.getByText('Belgeleri ve mesajlaşmayı inceledikten sonra karar verin. Bu işlem geri alınmaz.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yazdır' })).toBeInTheDocument()
    expect(screen.queryByText(/mesajlasmayi|islem geri alinmaz/)).not.toBeInTheDocument()
  })

  it('"Sohbete git" açılan sohbetin kimliğini iletir', async () => {
    startConversation.mockResolvedValue({ id: 88 })
    const onOpenMessages = vi.fn()
    render(<ApplicationDetail app={APP} onOpenMessages={onOpenMessages} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sohbete git' }))
    await waitFor(() => expect(onOpenMessages).toHaveBeenCalledWith(88))
    expect(startConversation).toHaveBeenCalledWith({ otherPartyId: 42, applicationId: 11 })
  })

  it('"Mesajlaşmaya Git" mevcut sohbet kimliğini iletir', () => {
    const onOpenMessages = vi.fn()
    render(<ApplicationDetail app={{ ...APP, conversationId: 64 }} onOpenMessages={onOpenMessages} />)
    fireEvent.click(screen.getByRole('button', { name: /Mesajlaşmaya Git/ }))
    expect(onOpenMessages).toHaveBeenCalledWith(64)
  })
})
