import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PrivateAttachment from '../PrivateAttachment'
import api from '../../../api/client'
vi.mock('../../../api/client', () => ({ default: { get: vi.fn() } }))
const message = { attachmentUrl: '/api/messages/conversations/7/messages/9/attachment', attachmentName: 'belge.pdf', attachmentType: 'file' }
beforeEach(() => {
  vi.clearAllMocks()
  URL.createObjectURL = vi.fn(() => 'blob:test')
  URL.revokeObjectURL = vi.fn()
})
describe('private chat attachments', () => {
  it('uses the authenticated client and releases its local blob', async () => {
    api.get.mockResolvedValue({ data: new Blob(['test']) })
    const { unmount } = render(<PrivateAttachment message={message} />)
    expect(api.get).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Dosyayı aç' }))
    await screen.findByRole('link', { name: 'Dosyayı indir' })
    expect(api.get).toHaveBeenCalledWith(message.attachmentUrl, { responseType: 'blob' })
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
  it('does not request a legacy external URL', async () => {
    render(<PrivateAttachment message={{ ...message, attachmentUrl: 'https://example.com/private.pdf' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dosyayı aç' }))
    await screen.findByRole('alert')
    expect(api.get).not.toHaveBeenCalled()
  })
  it('allows retry after a failed download', async () => {
    api.get.mockRejectedValueOnce(new Error('Bağlantı hatası')).mockResolvedValueOnce({ data: new Blob(['ok']) })
    render(<PrivateAttachment message={message} />)
    fireEvent.click(screen.getByRole('button', { name: 'Dosyayı aç' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Dosyayı aç' }))
    await screen.findByRole('link', { name: 'Dosyayı indir' })
    expect(api.get).toHaveBeenCalledTimes(2)
  })
})
