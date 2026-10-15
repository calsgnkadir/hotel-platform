import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/** UI Paket 5 — Ekibim: Bizde çalışanlar · Favoriler · Engellenenler tek sekmede, segmentli. */
vi.mock('../WorkersTab', () => ({ default: () => <div>çalışanlar listesi</div> }))
vi.mock('../FavoritesTab', () => ({ default: ({ segment }) => <div>favori bileşeni: {segment}</div> }))

import TeamTab from '../TeamTab'

function Where() { return <div data-testid="where">{useLocation().search}</div> }
function renderAt(url) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/business" element={<><TeamTab applications={[]} /><Where /></>} /></Routes>
    </MemoryRouter>
  )
}

describe('TeamTab', () => {
  it('varsayılan görünüm Bizde çalışanlar', () => {
    renderAt('/business?tab=team')
    expect(screen.getByRole('tab', { name: 'Bizde çalışanlar' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('çalışanlar listesi')).toBeInTheDocument()
  })

  it('segment değişince FavoritesTab denetimli açılır ve adres güncellenir', () => {
    renderAt('/business?tab=team')
    fireEvent.click(screen.getByRole('tab', { name: 'Engellenenler' }))
    expect(screen.getByText('favori bileşeni: blocked')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('view=blocked')
  })

  it('?view=favorites doğrudan Favoriler açar', () => {
    renderAt('/business?tab=team&view=favorites')
    expect(screen.getByText('favori bileşeni: favorites')).toBeInTheDocument()
  })
})
