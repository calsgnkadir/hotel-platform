import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/**
 * Bildirim linki iki biçimde gelir: "/listings/42" (tam adres) ya da
 * "applications" (sekme id'si). Eskiden tam adres sekme id'si sanılıyor,
 * panel boş ekrana düşüyordu.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
const auth = vi.hoisted(() => ({ user: { role: 'CANDIDATE' } }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../LanguageSwitcher', () => ({ default: () => null }))
vi.mock('../EmailVerifyBanner', () => ({ default: () => null }))
vi.mock('../MessagesButton', () => ({ default: () => null }))
vi.mock('../SettingsMenu', () => ({ default: () => null }))
vi.mock('../NotificationBell', () => ({
  default: ({ onNavigate }) => (
    <>
      <button onClick={() => onNavigate('/listings/42')}>adres bildirimi</button>
      <button onClick={() => onNavigate('applications')}>sekme bildirimi</button>
      <button onClick={() => onNavigate(null)}>boş bildirim</button>
    </>
  ),
}))

import DashboardLayout from '../DashboardLayout'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.pathname}{loc.search}</div>
}

function renderLayout(onTabChange = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/candidate']}>
      <Routes>
        <Route path="/candidate" element={<DashboardLayout activeTab="listings" onTabChange={onTabChange}><Where /></DashboardLayout>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
  return onTabChange
}

describe('DashboardLayout bildirim linki', () => {
  it('"/" ile başlayan link router ile açılır, sekme değiştirilmez', () => {
    const onTabChange = renderLayout()
    fireEvent.click(screen.getByText('adres bildirimi'))
    expect(screen.getByTestId('where')).toHaveTextContent('/listings/42')
    expect(onTabChange).not.toHaveBeenCalled()
  })

  it('sekme id\'si panelin sekme değiştiricisine gider', () => {
    const onTabChange = renderLayout()
    fireEvent.click(screen.getByText('sekme bildirimi'))
    expect(onTabChange).toHaveBeenCalledWith('applications')
    expect(screen.getByTestId('where')).toHaveTextContent('/candidate')
  })

  it('boş link yok sayılır', () => {
    const onTabChange = renderLayout()
    fireEvent.click(screen.getByText('boş bildirim'))
    expect(onTabChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('where')).toHaveTextContent('/candidate')
  })
})

/**
 * UI Paket 5 — nav tek kaynaktan; mobil alt sekme çubuğu; ikinci yatay nav satırı
 * ve dil seçici yok.
 */
describe('DashboardLayout navigasyon', () => {
  function renderAs(role, activeTab, onTabChange = vi.fn()) {
    auth.user = { role }
    render(
      <MemoryRouter initialEntries={['/x']}>
        <DashboardLayout activeTab={activeTab} onTabChange={onTabChange}><div /></DashboardLayout>
      </MemoryRouter>
    )
    return onTabChange
  }

  it('işletme: masaüstü nav ve mobil alt çubukta aynı 5 sekme', () => {
    renderAs('BUSINESS_OWNER', 'overview')
    const desktop = screen.getByRole('navigation', { name: 'Ana navigasyon' })
    const mobile = screen.getByRole('navigation', { name: 'Ana navigasyon (mobil)' })
    const names = ['Genel bakış', 'İlanlarım', 'Başvurular', 'Ekibim', 'Abonelik']
    for (const nav of [desktop, mobile]) {
      expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(names)
    }
    expect(within(mobile).getByRole('button', { name: 'Genel bakış' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByText('Profilim')).not.toBeInTheDocument()
  })

  it('başlık menüdeki sekmede de tek kaynaktan gelir; alt çubuk sekme değiştirir', () => {
    const onTabChange = renderAs('CANDIDATE', 'history')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Geçmiş işlerim')
    const mobile = screen.getByRole('navigation', { name: 'Ana navigasyon (mobil)' })
    fireEvent.click(within(mobile).getByRole('button', { name: 'Kaydettiklerim' }))
    expect(onTabChange).toHaveBeenCalledWith('saved')
    auth.user = { role: 'CANDIDATE' }
  })
})
