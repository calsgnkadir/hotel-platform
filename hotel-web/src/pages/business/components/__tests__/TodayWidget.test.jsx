import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TodayWidget from '../TodayWidget'

/**
 * UI Paket 5 — "Bugün" kartı tek "Yapılacaklar" kartına dönüştü: satırlar
 * düğme değil derin bağlantı (?tab=applications&status=…). Saf hesap testleri
 * pages/business/__tests__/OverviewTab.test.jsx içinde (buildTodos).
 */
const wrap = (apps) => render(<MemoryRouter><TodayWidget applications={apps} /></MemoryRouter>)

describe('TodayWidget (Yapılacaklar)', () => {
  it('iş yoksa "Bekleyen iş yok" + İlanlarım bağlantısı', () => {
    wrap([])
    expect(screen.getByText('Bekleyen iş yok')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'İlanlarıma git' })).toHaveAttribute('href', '/business?tab=mylistings')
  })

  it('başlık "Yapılacaklar" cümle düzeninde, büyük harf sınıfı yok', () => {
    wrap([])
    const h = screen.getByRole('heading', { name: 'Yapılacaklar' })
    expect(h.className).toContain('type-section')
    expect(h.className).not.toMatch(/uppercase|tracking-wider/)
  })

  it('bekleyen başvurular filtreye derin bağlantı', () => {
    const now = Date.now()
    wrap([
      { id: 1, status: 'PENDING', createdAt: new Date(now).toISOString() },
      { id: 2, status: 'PENDING', createdAt: new Date(now - 4 * 3600e3).toISOString() },
    ])
    const row = screen.getByTestId('todo-pending')
    expect(row).toHaveTextContent('2 başvuru karar bekliyor')
    expect(row).toHaveAttribute('href', '/business?tab=applications&status=PENDING')
  })

  it('yalnız ACCEPTED (vardiyasız) ise iş yok', () => {
    wrap(Array.from({ length: 3 }, (_, i) => ({ id: i, status: 'ACCEPTED', createdAt: new Date().toISOString() })))
    expect(screen.getByText('Bekleyen iş yok')).toBeInTheDocument()
  })

  it('süresi yaklaşan onay Türkçe etiketle (HOLD yok) ve başvuruya bağlantı', () => {
    wrap([{ id: 4, status: 'HELD', createdAt: new Date().toISOString(),
      holdDeadline: new Date(Date.now() + 3 * 3600e3).toISOString() }])
    const row = screen.getByTestId('todo-held')
    expect(row).toHaveTextContent('1 aday onayında')
    expect(row).toHaveAttribute('href', '/business?tab=applications&status=HELD&id=4')
    expect(screen.queryByText(/HOLD/)).not.toBeInTheDocument()
  })
})
