import { render, waitFor, screen, fireEvent } from '@testing-library/react'
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

import OAuthSuccessPage, { oauthNav } from '../OAuthSuccessPage'

function renderAt() {
  render(
    <MemoryRouter initialEntries={['/oauth-success']}>
      <Routes>
        <Route path="/oauth-success" element={<OAuthSuccessPage />} />
        <Route path="/candidate" element={<div>aday-paneli</div>} />
        <Route path="/listings/:id" element={<div>ilan-sayfasi</div>} />
        <Route path="/login" element={<div>giris</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('OAuthSuccessPage', () => {
  beforeEach(() => {
    post.mockReset(); loginFromOAuth.mockReset(); toast.error.mockReset(); toast.success.mockReset()
    sessionStorage.clear()
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

  it('kayıtta işaretlenen onay exchange gövdesine eklenir ve sekmeden silinir', async () => {
    sessionStorage.setItem('kadrom.oauth.consent', JSON.stringify({
      termsAccepted: true, privacyNoticeVersion: '2026-10-17', at: Date.now(),
    }))
    window.history.replaceState(null, '', '/oauth-success#code=kod1')
    post.mockResolvedValue({ data: { token: 't', userId: 1, fullName: 'Ayşe', role: 'CANDIDATE' } })
    renderAt()
    await waitFor(() => expect(post).toHaveBeenCalled())
    expect(post).toHaveBeenCalledWith('/api/auth/oauth/exchange', {
      code: 'kod1', termsAccepted: true, privacyNoticeVersion: '2026-10-17',
    })
    expect(sessionStorage.getItem('kadrom.oauth.consent')).toBeNull()
  })

  it('süresi geçmiş onay gönderilmez', async () => {
    sessionStorage.setItem('kadrom.oauth.consent', JSON.stringify({
      termsAccepted: true, privacyNoticeVersion: '2026-10-17', at: Date.now() - 2 * 60 * 60 * 1000,
    }))
    window.history.replaceState(null, '', '/oauth-success#code=kod2')
    post.mockResolvedValue({ data: { token: 't', userId: 1, role: 'CANDIDATE' } })
    renderAt()
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/auth/oauth/exchange', { code: 'kod2' }))
  })

  it('girişten sonra saklanan dönüş yoluna gider (paylaşılan ilan)', async () => {
    sessionStorage.setItem('kadrom.auth.return', JSON.stringify({ path: '/listings/7', reason: null }))
    window.history.replaceState(null, '', '/oauth-success#code=kod3')
    post.mockResolvedValue({ data: { token: 't', userId: 1, role: 'CANDIDATE' } })
    renderAt()
    expect(await screen.findByText('ilan-sayfasi')).toBeInTheDocument()
  })

  it('CONSENT_REQUIRED: onay ekranı; kabul edilince onay saklanır ve Google adımı yinelenir', async () => {
    const toGoogle = vi.spyOn(oauthNav, 'toGoogle').mockImplementation(() => {})
    sessionStorage.setItem('kadrom.auth.return', JSON.stringify({ path: '/listings/7', reason: null }))
    window.history.replaceState(null, '', '/oauth-success#code=yeni')
    post.mockRejectedValue({ response: { status: 422, data: { code: 'CONSENT_REQUIRED', message: 'Onay gerekli' } } })
    renderAt()

    expect(await screen.findByRole('heading', { name: 'Hesabını oluşturmadan önce' })).toBeInTheDocument()
    expect(loginFromOAuth).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()

    // İşaretlemeden devam: hata, yönlendirme yok
    fireEvent.click(screen.getByRole('button', { name: 'Kabul et ve Google ile devam et' }))
    expect(screen.getByText("Devam etmek için Kullanım Şartları'nı kabul etmelisin.")).toBeInTheDocument()
    expect(toGoogle).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Kabul et ve Google ile devam et' }))
    expect(toGoogle).toHaveBeenCalledTimes(1)
    expect(JSON.parse(sessionStorage.getItem('kadrom.oauth.consent'))).toMatchObject({
      termsAccepted: true, privacyNoticeVersion: '2026-10-17',
    })
    expect(JSON.parse(sessionStorage.getItem('kadrom.auth.return'))).toMatchObject({ path: '/listings/7' })
    toGoogle.mockRestore()
  })
})
