import { render, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

/**
 * Google dönüşü: adreste yalnız #code= (JWT yok). Kod okunur okunmaz adresten
 * silinir, /api/auth/oauth/exchange ile oturuma çevrilir.
 */
const post = vi.fn()
vi.mock('../../../api/client', () => ({
  default: { post: (...a) => post(...a) },
  extractErrorMessage: (e) => e?.response?.data?.message || 'Bir hata oluştu',
}))
const loginFromOAuth = vi.fn()
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ loginFromOAuth }) }))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('react-hot-toast', () => ({ default: toast }))

import OAuthSuccessPage from '../OAuthSuccessPage'

function renderAt() {
  render(
    <MemoryRouter initialEntries={['/oauth-success']}>
      <Routes>
        <Route path="/oauth-success" element={<OAuthSuccessPage />} />
        <Route path="/candidate" element={<div>aday-paneli</div>} />
        <Route path="/login" element={<div>giris</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('OAuthSuccessPage', () => {
  beforeEach(() => {
    post.mockReset(); loginFromOAuth.mockReset(); toast.error.mockReset(); toast.success.mockReset()
  })

  it('kodu okur, adresten siler ve oturuma çevirir', async () => {
    window.history.replaceState(null, '', '/oauth-success#code=abc_DEF-123')
    post.mockResolvedValue({ data: { token: 't', userId: 9, email: 'a@b.c', fullName: 'Ayşe Yılmaz', role: 'CANDIDATE' } })

    renderAt()

    expect(window.location.hash).toBe('')                 // kod adreste kalmadı
    expect(window.location.href).not.toContain('abc_DEF-123')
    await waitFor(() => expect(loginFromOAuth).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith('/api/auth/oauth/exchange', { code: 'abc_DEF-123' })
    expect(loginFromOAuth).toHaveBeenCalledWith(expect.objectContaining({ token: 't', id: 9, role: 'CANDIDATE' }))
  })

  it('kod yoksa backend çağrılmaz, girişe döner', async () => {
    window.history.replaceState(null, '', '/oauth-success')
    renderAt()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(post).not.toHaveBeenCalled()
    expect(loginFromOAuth).not.toHaveBeenCalled()
  })

  it('eski ?token= adresi artık oturum açmaz', async () => {
    window.history.replaceState(null, '', '/oauth-success?token=eyJ.sahte.jwt&role=ADMIN')
    renderAt()
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(post).not.toHaveBeenCalled()
    expect(loginFromOAuth).not.toHaveBeenCalled()
    expect(window.location.href).not.toContain('eyJ.sahte.jwt')
  })

  it('kod geçersizse hata mesajı, oturum yok', async () => {
    window.history.replaceState(null, '', '/oauth-success#code=kullanilmis')
    post.mockRejectedValue({ response: { status: 422, data: { message: 'Bağlantı geçersiz' } } })
    renderAt()
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Bağlantı geçersiz'))
    expect(loginFromOAuth).not.toHaveBeenCalled()
  })
})
