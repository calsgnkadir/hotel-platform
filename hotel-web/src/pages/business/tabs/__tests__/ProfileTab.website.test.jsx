import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * İşletme profili web sitesi: istemci tarafında http(s) kontrolü (sunucudaki
 * WebsiteUrlPolicy ile aynı kural). Hatalı adresle kayıt isteği gitmez; sunucu
 * yine de 422 verirse mesaj alanın altında yardımcı metin olarak görünür.
 */
const api = vi.hoisted(() => ({
  getBusinessProfile: vi.fn(),
  getMyBusinessPhotos: vi.fn(),
  updateBusinessProfile: vi.fn(),
}))
vi.mock('../../../../api/hotel', () => api)
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => vi.fn() }))
vi.mock('../../../../components/ChangePasswordCard', () => ({ default: () => null }))
vi.mock('../../../../components/PhoneVerifyCard', () => ({ default: () => null }))
vi.mock('../../../../components/GdprCard', () => ({ default: () => null }))
vi.mock('../../../../components/NotificationSettings', () => ({ default: () => null }))
vi.mock('../../../../components/GalleryEditor', () => ({ default: () => null }))
vi.mock('../../../../components/ProfileCompletenessCard', () => ({ default: () => null }))
vi.mock('../../components/BusinessLocationEditor', () => ({ default: () => null }))
vi.mock('../../components/WorkingHoursEditor', () => ({ default: () => null }))
vi.mock('../../components/MediaBlock', () => ({ default: () => null }))

import ProfileTab, { websiteError } from '../ProfileTab'

describe('websiteError (WebsiteUrlPolicy aynası)', () => {
  it.each([
    ['', false], ['https://www.isletmem.com', false], ['http://a.co/x', false],
    ['www.isletmem.com', true], ['javascript:alert(1)', true], ['ftp://a.com', true],
    ['https://site.com@kotu.example', true], ['https://a b.com', true],
  ])('%s → %s', (v, bad) => expect(websiteError(v)).toBe(bad))
})

describe('ProfileTab web sitesi alanı', () => {
  beforeEach(() => {
    Object.values(api).forEach(f => f.mockReset())
    api.getBusinessProfile.mockResolvedValue({ name: 'Deniz Otel', type: 'HOTEL', website: '' })
    api.getMyBusinessPhotos.mockResolvedValue([])
    api.updateBusinessProfile.mockResolvedValue({ name: 'Deniz Otel', type: 'HOTEL' })
  })

  it('hatalı adreste yardımcı metin gösterir ve kaydetmez', async () => {
    render(<ProfileTab />)
    const input = await screen.findByLabelText('Web sitesi')
    fireEvent.change(input, { target: { value: 'www.isletmem.com' } })
    fireEvent.blur(input)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('http:// veya https://')
    fireEvent.submit(input.closest('form'))
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(api.updateBusinessProfile).not.toHaveBeenCalled()
  })

  it('sunucu 422 verirse mesaj alanın altında görünür', async () => {
    api.updateBusinessProfile.mockRejectedValue({
      response: { status: 422, data: { message: 'Web sitesi adresi http:// veya https:// ile başlamalı (örn: https://www.isletmem.com).' } },
    })
    render(<ProfileTab />)
    const input = await screen.findByLabelText('Web sitesi')
    fireEvent.change(input, { target: { value: 'https://ok.example' } })
    fireEvent.submit(input.closest('form'))
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByText(/Web sitesi adresi http/)).toBeInTheDocument()
  })
})
