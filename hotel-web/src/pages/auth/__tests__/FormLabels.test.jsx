import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

/**
 * Madde 6 — form etiketleri alana bağlı (htmlFor + id). getByLabelText yalnız
 * etiket gerçekten alana bağlıysa bulur; ekran okuyucu ve etikete tıklayıp
 * odaklanma da aynı bağlantıya dayanır.
 */
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ login: vi.fn(), register: vi.fn() }) }))
vi.mock('../../../lib/authProviders', () => ({ useGoogleSignIn: () => ({ enabled: false }) }))
vi.mock('../../../components/GoogleSignInButton', () => ({ default: () => null }))
vi.mock('../../../api/hotel', () => ({
  validatePasswordResetToken: vi.fn(async () => ({ email: 'a@x.com' })),
  confirmPasswordReset: vi.fn(),
  requestPasswordReset: vi.fn(),
}))

import LoginPage from '../LoginPage'
import RegisterPage from '../RegisterPage'
import ForgotPasswordPage from '../ForgotPasswordPage'
import ResetPasswordPage from '../ResetPasswordPage'

function at(ui, entry = '/') {
  return render(<MemoryRouter initialEntries={[entry]}>{ui}</MemoryRouter>)
}

describe('Form etiketleri alana bağlı', () => {
  it('Giriş: e-posta ve şifre', () => {
    at(<LoginPage />)
    expect(screen.getByLabelText('E-posta')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Şifre')).toHaveAttribute('autocomplete', 'current-password')
  })

  it('Kayıt (işletme adımı): ad, e-posta, şifre, işletme alanları, ilçe/mahalle', () => {
    at(<RegisterPage />, { pathname: '/register', state: { preselectedRole: 'BUSINESS_OWNER' } })
    expect(screen.getByLabelText('Ad Soyad')).toBeInTheDocument()
    expect(screen.getByLabelText('E-posta')).toBeInTheDocument()
    expect(screen.getByLabelText('Şifre')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('İşletme adı')).toBeInTheDocument()
    expect(screen.getByLabelText(/Web sitesi/)).toHaveAttribute('type', 'url')
    expect(screen.getByRole('group', { name: 'İşletme türü' })).toBeInTheDocument()
    expect(screen.getByLabelText(/İlçe/)).toBeInTheDocument()
    expect(screen.getByLabelText('Mahalle')).toBeDisabled()
  })

  it('Şifremi unuttum: e-posta', () => {
    at(<ForgotPasswordPage />)
    expect(screen.getByLabelText('E-posta')).toHaveAttribute('type', 'email')
  })

  it('Şifre sıfırlama: iki şifre alanı', async () => {
    at(<ResetPasswordPage />, '/reset-password?token=abc')
    expect(await screen.findByLabelText('Yeni şifre')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Yeni şifre (tekrar)')).toHaveAttribute('type', 'password')
  })
})
