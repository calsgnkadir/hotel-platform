import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/**
 * E5/E6 — Kayıt onayı.
 *  - Kullanım Şartları ayrı, zorunlu onay kutusu; KVKK aydınlatması kutu DEĞİL, bilgi metni.
 *  - Kutusuz kayıt isteği gitmez; kayıt gövdesinde termsAccepted + privacyNoticeVersion.
 *  - Google düğmesi kutu işaretlenmeden pasif; tıklanınca onay + dönüş yolu sekmede saklanır.
 *  - Kayıttan sonra geldiği sayfaya (from) dönülür.
 */
const registerUser = vi.fn()
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ register: registerUser }) }))
const google = vi.hoisted(() => ({ enabled: true }))
vi.mock('../../../lib/authProviders', () => ({ useGoogleSignIn: () => google.enabled }))

import RegisterPage from '../RegisterPage'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname}</div>
}

function renderAt(state) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/register', state }]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

function fillCandidateForm() {
  fireEvent.change(screen.getByLabelText('Ad Soyad'), { target: { value: 'Ayşe Yılmaz' } })
  fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'ayse@example.com' } })
  fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'gizli1234' } })
}

describe('Kayıt formu: Kullanım Şartları onayı', () => {
  beforeEach(() => {
    registerUser.mockReset()
    sessionStorage.clear()
    google.enabled = true
  })

  it('KVKK için onay kutusu yok, yalnız bilgilendirme bağlantısı var', () => {
    renderAt({ preselectedRole: 'CANDIDATE' })
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: /Kullanım Şartları'nı okudum ve kabul ediyorum/ })).not.toBeChecked()
    expect(screen.getByText(/Kişisel verilerinin nasıl işlendiğini/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Aydınlatma Metni' })).toHaveAttribute('href', '/kvkk')
  })

  it('kutu işaretlenmeden kayıt isteği gitmez, hata görünür', async () => {
    renderAt({ preselectedRole: 'CANDIDATE' })
    fillCandidateForm()
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect(await screen.findByText("Devam etmek için Kullanım Şartları'nı kabul etmelisin.")).toBeInTheDocument()
    expect(registerUser).not.toHaveBeenCalled()
  })

  it('kutu işaretliyse gövdede termsAccepted + privacyNoticeVersion; from sayfasına döner', async () => {
    registerUser.mockResolvedValue({ role: 'CANDIDATE', fullName: 'Ayşe Yılmaz' })
    renderAt({ preselectedRole: 'CANDIDATE', from: { pathname: '/listings/7' } })
    fillCandidateForm()
    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))

    await waitFor(() => expect(registerUser).toHaveBeenCalledTimes(1))
    const body = registerUser.mock.calls[0][0]
    expect(body).toMatchObject({
      role: 'CANDIDATE', email: 'ayse@example.com',
      termsAccepted: true, privacyNoticeVersion: '2026-10-17',
    })
    expect(body).not.toHaveProperty('acceptedTerms')
    expect(await screen.findByTestId('where')).toHaveTextContent('/listings/7')
  })

  it('from yoksa rol paneline gider', async () => {
    registerUser.mockResolvedValue({ role: 'BUSINESS_OWNER', fullName: 'Ali' })
    renderAt({ preselectedRole: 'CANDIDATE' })
    fillCandidateForm()
    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Hesap oluştur' }))
    expect(await screen.findByTestId('where')).toHaveTextContent('/business')
  })
})

describe('Kayıt adım 1: Google ile aday kaydı', () => {
  beforeEach(() => { sessionStorage.clear(); google.enabled = true })

  it('Kullanım Şartları işaretlenmeden Google düğmesi pasif; işaretlenince bağlantı olur', () => {
    renderAt(undefined)
    const passive = screen.getByRole('button', { name: /Google ile aday olarak kayıt ol/ })
    expect(passive).toBeDisabled()
    expect(screen.queryByRole('link', { name: /Google ile aday olarak kayıt ol/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    const link = screen.getByRole('link', { name: /Google ile aday olarak kayıt ol/ })
    expect(link.getAttribute('href')).toMatch(/\/oauth2\/authorization\/google$/)
  })

  it('Google tıklanınca onay ve dönüş yolu sekmede saklanır', () => {
    renderAt({ from: { pathname: '/listings/7', search: '?ref=paylas' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    const link = screen.getByRole('link', { name: /Google ile aday olarak kayıt ol/ })
    link.addEventListener('click', (e) => e.preventDefault())  // jsdom gezinmesin
    fireEvent.click(link)

    const consent = JSON.parse(sessionStorage.getItem('kadrom.oauth.consent'))
    expect(consent).toMatchObject({ termsAccepted: true, privacyNoticeVersion: '2026-10-17' })
    expect(JSON.parse(sessionStorage.getItem('kadrom.auth.return'))).toMatchObject({ path: '/listings/7?ref=paylas' })
  })

  it('kutu adımlar arasında korunur (adım 1 işaretlenirse formda da işaretli)', () => {
    renderAt(undefined)
    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    fireEvent.click(screen.getByRole('button', { name: /İş Arıyorum/ }))
    expect(screen.getByRole('checkbox', { name: /Kullanım Şartları/ })).toBeChecked()
  })

  it('işletme adımında Google düğmesi yok', () => {
    renderAt({ preselectedRole: 'BUSINESS_OWNER' })
    expect(screen.queryByText(/Google ile/)).not.toBeInTheDocument()
  })
})
