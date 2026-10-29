import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'

const checkFavorite = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  checkFavorite: (...a) => checkFavorite(...a),
}))
vi.mock('../../../../api/client', () => ({
  extractErrorMessage: () => 'Hata',
}))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => vi.fn() }))
vi.mock('../../../../lib/confetti', () => ({ celebrate: vi.fn() }))
vi.mock('../../../../components/LegalNotice', () => ({ SgkNotice: () => null }))

import ApplicationDetail from '../ApplicationDetail'
import { queryClient } from '../../../../lib/queryClient'

const APP = {
  id: 11,
  status: 'PENDING',
  candidate: { id: 42, fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' },
  listing: { title: 'Garson', businessName: 'Deniz Otel' },
}

function renderPanel(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={queryClient}>
      <ApplicationDetail app={APP} onRefresh={vi.fn()} variant="panel" onClose={onClose} />
    </QueryClientProvider>
  )
  return { onClose }
}

describe('ApplicationDetail — başlık ikon düğmeleri erişilebilirliği', () => {
  beforeEach(() => { checkFavorite.mockReset().mockResolvedValue(false) })
  afterEach(() => { vi.restoreAllMocks(); queryClient.clear() })

  it('Kapat düğmesi erişilebilir adla bulunur, type=button ve onClose çağırır', () => {
    const { onClose } = renderPanel()
    const close = screen.getByRole('button', { name: 'Kapat' })
    expect(close).toHaveAttribute('type', 'button')
    expect(close).toHaveAttribute('aria-label', 'Kapat')
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Yazdır, Favori ve Kapat düğmelerinin adı var; SVG ikonlar aria-hidden', () => {
    renderPanel()
    const buttons = [
      screen.getByRole('button', { name: 'Yazdır' }),
      screen.getByRole('button', { name: 'Favorilere ekle' }),
      screen.getByRole('button', { name: 'Kapat' }),
    ]
    for (const btn of buttons) {
      expect(btn).toHaveAttribute('type', 'button')
      const svg = btn.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg).toHaveAttribute('aria-hidden', 'true')
    }
  })
})
