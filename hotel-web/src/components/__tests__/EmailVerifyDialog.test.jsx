import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * 403 EMAIL_NOT_VERIFIED → "E-postanı doğrula" penceresi: adres görünür,
 * "Doğrulama e-postasını tekrar gönder" mevcut uca (resend-verification) gider.
 */
const post = vi.fn()
vi.mock('../../api/client', () => ({
  default: { post: (...a) => post(...a) },
  EMAIL_NOT_VERIFIED_EVENT: 'kadrom:email-not-verified',
  extractErrorMessage: () => 'Gönderilemedi',
}))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'ayse@example.com' } }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toast }))

import EmailVerifyDialog from '../EmailVerifyDialog'

function fire() {
  act(() => { window.dispatchEvent(new CustomEvent('kadrom:email-not-verified', { detail: {} })) })
}

describe('EmailVerifyDialog', () => {
  beforeEach(() => { post.mockReset(); toast.success.mockReset(); toast.error.mockReset() })

  it('olay gelmeden görünmez', () => {
    render(<EmailVerifyDialog />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('olayla açılır; adres ve eylemler görünür', () => {
    render(<EmailVerifyDialog />)
    fire()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('E-postanı doğrula')
    expect(dialog).toHaveTextContent('ayse@example.com')
    expect(screen.getByRole('button', { name: 'Doğrulama e-postasını tekrar gönder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kapat' })).toBeInTheDocument()
  })

  it('tekrar gönder: resend-verification çağrılır, pencere kapanır', async () => {
    post.mockResolvedValue({ data: {} })
    render(<EmailVerifyDialog />)
    fire()
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulama e-postasını tekrar gönder' }))
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/auth/resend-verification'))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toast.success).toHaveBeenCalledWith('Doğrulama e-postası ayse@example.com adresine gönderildi.')
  })

  it('gönderim hatasında pencere açık kalır, hata bildirilir', async () => {
    post.mockRejectedValue(new Error('x'))
    render(<EmailVerifyDialog />)
    fire()
    fireEvent.click(screen.getByRole('button', { name: 'Doğrulama e-postasını tekrar gönder' }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Gönderilemedi'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
