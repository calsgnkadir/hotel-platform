import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * Kanban düzeni: tüm durumlar görünürken masaüstünde (lg+) sütunlar yan yana
 * pano olur; chip filtresiyle tek sütun kalınca tam genişlik ızgara. Sütun
 * başlığında durum adı + sayı. 11px yazı kalmadı.
 */
vi.mock('../../../../api/hotel', () => ({}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'Hata' }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => vi.fn(async () => false) }))
vi.mock('../../../../lib/confetti', () => ({ celebrate: vi.fn() }))

import ApplicationsKanban from '../ApplicationsKanban'

const now = new Date().toISOString()
const APPS = [
  { id: 1, status: 'PENDING', createdAt: now, candidate: { id: 1, fullName: 'Ayşe Yılmaz' }, listing: { title: 'Garson' } },
  { id: 2, status: 'REVIEWING', createdAt: now, candidate: { id: 2, fullName: 'Can Öztürk' }, listing: { title: 'Komi' } },
  { id: 3, status: 'ACCEPTED', createdAt: now, candidate: { id: 3, fullName: 'Elif Şahin' }, listing: { title: 'Barista' } },
]

describe('ApplicationsKanban düzen', () => {
  it('tüm durumlar: lg+ yan yana pano, sütun başlığı ad + sayı', () => {
    render(<ApplicationsKanban applications={APPS} />)
    const board = screen.getByRole('list', { name: 'Başvuru panosu' })
    expect(board.className).toContain('lg:flex')
    expect(board.className).toContain('lg:overflow-x-auto')
    const cols = within(board).getAllByRole('listitem')
    expect(cols).toHaveLength(5)
    const pending = screen.getByRole('listitem', { name: /2 başvuru/ })
    expect(within(pending).getByText('2')).toBeInTheDocument()
    expect(within(pending).getByText('Ayşe Yılmaz')).toBeInTheDocument()
    expect(screen.getAllByText('Bu sütunda başvuru yok')).toHaveLength(3)
  })

  it('tek durum filtresi: pano yerine tam genişlik ızgara', () => {
    render(<ApplicationsKanban applications={APPS} statusFilter="ACCEPTED" />)
    const board = screen.getByRole('list', { name: 'Başvuru panosu' })
    expect(board.className).not.toContain('lg:flex')
    expect(within(board).getAllByRole('listitem')).toHaveLength(1)
  })

  it('11px yazı kullanılmaz', () => {
    const { container } = render(<ApplicationsKanban applications={APPS} />)
    expect(container.innerHTML).not.toContain('text-[11px]')
  })

  it('kompakt kart: tarih ve Aç düğmesi isim bloğunda, ayrı alt şerit yok; inline rgba gölge yok', () => {
    const { container } = render(<ApplicationsKanban applications={[APPS[0]]} statusFilter="PENDING" />)
    const name = screen.getByText('Ayşe Yılmaz')
    const block = name.closest('.min-w-0.flex-1')
    expect(within(block).getByText('Bugün')).toBeInTheDocument()
    expect(within(block).getByRole('button', { name: 'Ayşe Yılmaz başvurusunu aç' })).toHaveTextContent('Aç')
    expect(within(block).getByText('Garson')).toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/rgba\(/)
    expect(screen.getByRole('link', { name: /Ayşe Yılmaz profilini/ })).toHaveAttribute('href', '/p/candidate/1')
  })
})
