import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

/** UI Paket 5 — ayarlar menüsü: aria-expanded, Escape ile kapanma, öğeler lib/navigation.js'ten. */
const auth = vi.hoisted(() => ({ user: { role: 'BUSINESS_OWNER' }, logout: vi.fn() }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

import SettingsMenu from '../SettingsMenu'

const renderMenu = (onTabChange = vi.fn()) => {
  render(<MemoryRouter><SettingsMenu onTabChange={onTabChange} /></MemoryRouter>)
  return onTabChange
}

describe('SettingsMenu', () => {
  it('aria-expanded açılışta true olur; Escape kapatır ve odağı düğmeye verir', () => {
    renderMenu()
    const btn = screen.getByRole('button', { name: 'Ayarlar menüsü' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(document.activeElement).toBe(btn)
  })

  it('işletme menüsünde "İşletme profili" var; eski Çalışanlar/Favoriler öğeleri yok', () => {
    const onTabChange = renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar menüsü' }))
    expect(screen.queryByText('Bizde Çalışanlar')).not.toBeInTheDocument()
    expect(screen.queryByText(/Favori ve engellenen/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'İşletme profili' }))
    expect(onTabChange).toHaveBeenCalledWith('profile')
  })

  it('aday menüsünde Profilim, Geçmiş işlerim, Takip ettiklerim', () => {
    auth.user = { role: 'CANDIDATE' }
    renderMenu()
    fireEvent.click(screen.getByRole('button', { name: 'Ayarlar menüsü' }))
    for (const l of ['Profilim', 'Geçmiş işlerim', 'Takip ettiklerim']) {
      expect(screen.getByRole('button', { name: l })).toBeInTheDocument()
    }
    auth.user = { role: 'BUSINESS_OWNER' }
  })
})
