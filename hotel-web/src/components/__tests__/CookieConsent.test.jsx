import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CookieConsent from '../CookieConsent'

const renderBar = () => render(<MemoryRouter><CookieConsent /></MemoryRouter>)

describe('CookieConsent', () => {
  beforeEach(() => localStorage.clear())

  it('ilk ziyarette bilgilendirme gorunur, Anladim deyince kapanir ve hatirlanir', () => {
    const { unmount } = renderBar()
    expect(screen.getByText(/gerekli çerezleri/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Anladım' }))
    expect(screen.queryByText(/gerekli çerezleri/)).not.toBeInTheDocument()
    unmount()

    renderBar()
    expect(screen.queryByText(/gerekli çerezleri/)).not.toBeInTheDocument()
  })

  it('eski surumde tercih yapmis kullaniciya tekrar gosterilmez', () => {
    localStorage.setItem('cookie-consent', JSON.stringify({ v: 1, necessary: true, analytics: false }))
    renderBar()
    expect(screen.queryByRole('region', { name: 'Çerez bilgilendirmesi' })).not.toBeInTheDocument()
  })
})
