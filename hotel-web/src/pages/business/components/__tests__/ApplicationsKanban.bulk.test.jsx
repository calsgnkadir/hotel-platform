import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * Kanban toplu işlem çubuğu: Toplu kabul birincil, Toplu red tehlikeli
 * (eskiden ikisi de aynı soluk gri).
 */
vi.mock('../../../../api/hotel', () => ({}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'Hata' }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => vi.fn(async () => false) }))
vi.mock('../../../../lib/confetti', () => ({ celebrate: vi.fn() }))

import ApplicationsKanban from '../ApplicationsKanban'

const APPS = [{
  id: 1, status: 'PENDING', createdAt: new Date().toISOString(),
  candidate: { id: 42, fullName: 'Ayşe Yılmaz' },
  listing: { title: 'Garson', businessName: 'Deniz Otel' },
}]

describe('ApplicationsKanban toplu işlem', () => {
  it('seçim yapılınca Toplu kabul btn-primary, Toplu red btn-danger', () => {
    render(<ApplicationsKanban applications={APPS} />)
    expect(screen.queryByRole('button', { name: 'Toplu kabul' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seç' }))
    expect(screen.getByRole('button', { name: 'Toplu kabul' }).className).toContain('btn-primary')
    expect(screen.getByRole('button', { name: 'Toplu red' }).className).toContain('btn-danger')
    fireEvent.click(screen.getByRole('button', { name: 'İptal' }))
    expect(screen.queryByRole('button', { name: 'Toplu kabul' })).not.toBeInTheDocument()
  })
})
