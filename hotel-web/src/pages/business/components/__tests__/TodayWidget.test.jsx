import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import TodayWidget from '../TodayWidget'

describe('TodayWidget (FAZ 0/#4d smoke)', () => {
  it('basvuru yokken yesil "her sey yolunda" branch', () => {
    render(<TodayWidget applications={[]} onTabChange={() => {}} />)
    expect(screen.getByText('Her şey yolunda')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yeni ilan' })).toBeInTheDocument()
    expect(screen.getByText(/Ekibim/i)).toBeInTheDocument()
  })

  it('PENDING basvuru varken amber item gosterilir', () => {
    const apps = [
      { id: 1, status: 'PENDING', createdAt: new Date().toISOString() },
      { id: 2, status: 'PENDING', createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString() },
    ]
    render(<TodayWidget applications={apps} onTabChange={() => {}} />)
    expect(screen.getByText(/2 başvuru karar bekliyor/i)).toBeInTheDocument()
  })

  it('REVIEWING + PENDING farkli satirlar', () => {
    const apps = [
      { id: 1, status: 'PENDING', createdAt: new Date().toISOString() },
      { id: 2, status: 'REVIEWING', createdAt: new Date().toISOString() },
    ]
    render(<TodayWidget applications={apps} onTabChange={() => {}} />)
    expect(screen.getByText(/1 başvuru karar bekliyor/i)).toBeInTheDocument()
    expect(screen.getByText(/1 aday incelemede/i)).toBeInTheDocument()
  })

  it('CTA butona tiklayinca onTabChange cagrilir', () => {
    const onTabChange = vi.fn()
    const apps = [{ id: 1, status: 'PENDING', createdAt: new Date().toISOString() }]
    render(<TodayWidget applications={apps} onTabChange={onTabChange} />)
    const btn = screen.getByRole('button', { name: /Kanban'a Git/i })
    fireEvent.click(btn)
    expect(onTabChange).toHaveBeenCalledWith('applications')
  })

  it('hep ACCEPTED ise actionable yok, "yolunda" gosterilir', () => {
    const apps = Array.from({ length: 5 }, (_, i) => ({
      id: i, status: 'ACCEPTED', createdAt: new Date().toISOString(),
    }))
    render(<TodayWidget applications={apps} onTabChange={() => {}} />)
    expect(screen.getByText('Her şey yolunda')).toBeInTheDocument()
  })

  // UI Paket 2 — "BUGÜN" dev büyük harf başlık yerine cümle düzeni; butonlar ortak stil
  it('başlık "Bugün" cümle düzeninde, BÜYÜK HARF sınıfı yok; CTA ortak buton', () => {
    const apps = [{ id: 1, status: 'PENDING', createdAt: new Date().toISOString() }]
    render(<TodayWidget applications={apps} onTabChange={() => {}} />)
    const h = screen.getByRole('heading', { name: 'Bugün' })
    expect(h.className).toContain('type-section')
    expect(h.className).not.toMatch(/uppercase|tracking-wider/)
    const cta = screen.getByRole('button', { name: "Kanban'a git" })
    expect(cta.className).toContain('btn-secondary')
    expect(screen.getByText('1 iş var')).toBeInTheDocument()
  })

  it('süresi yaklaşan bekleyen aday Türkçe etiketle gösterilir (HOLD yok)', () => {
    const apps = [{ id: 1, status: 'HELD', createdAt: new Date().toISOString(),
      holdDeadline: new Date(Date.now() + 3 * 3600e3).toISOString() }]
    render(<TodayWidget applications={apps} onTabChange={() => {}} />)
    expect(screen.getByText(/1 aday beklemede/)).toBeInTheDocument()
    expect(screen.queryByText(/HOLD/)).not.toBeInTheDocument()
  })
})
