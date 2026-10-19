import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/**
 * E8/E9 — Girişten sonra geldiği sayfaya dönüş.
 *  - router state.from (ProtectedRoute, paylaşılan ilan) → girişten sonra oraya
 *  - oturum süresi dolunca (api/client.js tam yenileme) sekmeye bırakılan yol + "oturum sona erdi" bilgisi
 *  - giriş ekranından kayda geçerken from korunur
 */
const login = vi.fn()
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ login }) }))
vi.mock('../../../lib/authProviders', () => ({ useGoogleSignIn: () => false }))

import LoginPage from '../LoginPage'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname}{loc.search}|{JSON.stringify(loc.state)}</div>
}

function renderAt(entry) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

async function submit(email = 'a@b.co') {
  fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'gizli1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Giriş yap' }))
}

describe('LoginPage dönüş yolu', () => {
  beforeEach(() => { login.mockReset(); sessionStorage.clear() })

  it('state.from varsa girişten sonra oraya gider (sorgu dizesiyle)', async () => {
    login.mockResolvedValue({ role: 'CANDIDATE', fullName: 'Ayşe Yılmaz' })
    renderAt({ pathname: '/login', state: { from: { pathname: '/business', search: '?tab=billing' } } })
    await submit()
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/business?tab=billing'))
  })

  it('from yoksa rol paneline gider', async () => {
    login.mockResolvedValue({ role: 'CANDIDATE', fullName: 'Ayşe' })
    renderAt('/login')
    await submit()
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/candidate'))
  })

  it('başka kökene (//) dönüş kabul edilmez', async () => {
    login.mockResolvedValue({ role: 'ADMIN', fullName: 'Yönetici' })
    renderAt({ pathname: '/login', state: { from: '//kotu.example/x' } })
    await submit()
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'))
  })

  it('oturum süresi dolduysa bilgi gösterilir ve girişten sonra saklanan sayfaya dönülür', async () => {
    sessionStorage.setItem('kadrom.auth.return', JSON.stringify({ path: '/candidate?tab=applications', reason: 'expired' }))
    login.mockResolvedValue({ role: 'CANDIDATE', fullName: 'Ayşe' })
    renderAt('/login')
    expect(screen.getByRole('status')).toHaveTextContent('Oturumun sona erdi, tekrar giriş yap.')
    expect(sessionStorage.getItem('kadrom.auth.return')).toBeNull()  // tek kullanımlık
    await submit()
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/candidate?tab=applications'))
  })

  it('normal girişte "oturum sona erdi" bilgisi yok', () => {
    renderAt('/login')
    expect(screen.queryByText(/Oturumun sona erdi/)).not.toBeInTheDocument()
  })

  it('kayda geçerken from korunur', () => {
    renderAt({ pathname: '/login', state: { from: { pathname: '/listings/7' } } })
    fireEvent.click(screen.getByRole('link', { name: 'Ücretsiz oluştur' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/register|{"from":{"pathname":"/listings/7"}}')
  })
})
