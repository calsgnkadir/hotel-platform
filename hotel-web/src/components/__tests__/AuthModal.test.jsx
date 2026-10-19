import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/**
 * Giriş penceresi: Google yalnız aday hesabı açar → işletme seçiliyken görünmez.
 * Kullanım Şartları işaretlenmeden Google pasif; işaret e-posta yoluyla kayda taşınır.
 */
vi.mock('../../lib/authProviders', () => ({ useGoogleSignIn: () => true }))

import AuthModal from '../AuthModal'

function RegisterProbe() {
  const loc = useLocation()
  return <div data-testid="register-state">{JSON.stringify(loc.state)}</div>
}

function renderModal(defaultRole = null) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<AuthModal open onClose={vi.fn()} defaultRole={defaultRole} />} />
        <Route path="/register" element={<RegisterProbe />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AuthModal', () => {
  beforeEach(() => sessionStorage.clear())

  it('işletme seçiliyken Google düğmesi ve onay kutusu görünmez', () => {
    renderModal('BUSINESS_OWNER')
    expect(screen.queryByText(/Google ile/)).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('aday/rol seçilmemişken Google, Kullanım Şartları işaretlenene kadar pasif', () => {
    renderModal(null)
    expect(screen.getByRole('button', { name: /Google ile aday olarak devam et/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    expect(screen.getByRole('link', { name: /Google ile aday olarak devam et/ })).toBeInTheDocument()
  })

  it('rol işletmeye çevrilince Google kaybolur', () => {
    renderModal('CANDIDATE')
    expect(screen.getByText(/Google ile aday olarak devam et/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /İşletme/ }))
    expect(screen.queryByText(/Google ile/)).not.toBeInTheDocument()
  })

  it('e-posta ile devam: işaretlenen onay kayıt formuna taşınır', () => {
    renderModal('CANDIDATE')
    fireEvent.click(screen.getByRole('checkbox', { name: /Kullanım Şartları/ }))
    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'a@b.co' } })
    fireEvent.click(screen.getByRole('button', { name: 'E-posta ile devam et' }))
    const state = JSON.parse(screen.getByTestId('register-state').textContent)
    expect(state).toMatchObject({ preselectedRole: 'CANDIDATE', prefillEmail: 'a@b.co', termsAccepted: true })
  })
})
