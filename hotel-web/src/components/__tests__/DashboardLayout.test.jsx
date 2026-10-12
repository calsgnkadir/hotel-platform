import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/**
 * Bildirim linki iki biçimde gelir: "/listings/42" (tam adres) ya da
 * "applications" (sekme id'si). Eskiden tam adres sekme id'si sanılıyor,
 * panel boş ekrana düşüyordu.
 */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'CANDIDATE' } }) }))
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
