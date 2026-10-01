import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })

describe('ShowcaseBanner', () => {
  it('normal build: hicbir sey cizmez', async () => {
    vi.stubEnv('VITE_SHOWCASE', '')
    const { default: ShowcaseBanner } = await import('../ShowcaseBanner')
    const { container } = render(<ShowcaseBanner />)
    expect(container.textContent).toBe('')
  })

  it('vitrin build: uyari + istege bagli demo hesaplar', async () => {
    vi.stubEnv('VITE_SHOWCASE', 'true')
    const { default: ShowcaseBanner } = await import('../ShowcaseBanner')
    render(<ShowcaseBanner />)
    expect(screen.getByText(/gerçek kişisel bilgi/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demo hesaplar' }))
    expect(screen.getByText('demo-aday1@test.com')).toBeInTheDocument()
  })
})
