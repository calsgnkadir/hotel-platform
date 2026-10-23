import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * Kanban toplu işlem çubuğu: Toplu kabul birincil, Toplu red tehlikeli
 * (eskiden ikisi de aynı soluk gri).
 */
vi.mock('../../../../api/hotel', () => ({}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'Hata' }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
const { confirmSpy } = vi.hoisted(() => ({ confirmSpy: vi.fn(async () => false) }))
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => confirmSpy }))
vi.mock('../../../../lib/confetti', () => ({ celebrate: vi.fn() }))

import ApplicationsKanban from '../ApplicationsKanban'

const APPS = [{
  id: 1, status: 'PENDING', createdAt: new Date().toISOString(),
  candidate: { id: 42, fullName: 'Ayşe Yılmaz' },
  listing: { title: 'Garson', businessName: 'Deniz Otel' },
}]

describe('ApplicationsKanban toplu işlem', () => {
  it('seçim yapılınca Toplu kabul btn-primary, Toplu ret btn-danger', () => {
    render(<ApplicationsKanban applications={APPS} />)
    expect(screen.queryByRole('button', { name: 'Toplu kabul' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Seç' }))
    expect(screen.getByRole('button', { name: 'Toplu kabul' }).className).toContain('btn-primary')
    expect(screen.getByRole('button', { name: 'Toplu ret' }).className).toContain('btn-danger')
    fireEvent.click(screen.getByRole('button', { name: 'İptal' }))
    expect(screen.queryByRole('button', { name: 'Toplu kabul' })).not.toBeInTheDocument()
  })

  it('toplu ret onayı doğru Türkçe: "reddedilecek" / "Evet, reddet"', async () => {
    confirmSpy.mockClear()
    render(<ApplicationsKanban applications={APPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Seç' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toplu ret' }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
    const arg = confirmSpy.mock.calls[0][0]
    expect(arg.description).toContain('1 başvuru reddedilecek')
    expect(arg.confirmLabel).toBe('Evet, reddet')
    expect(arg.destructive).toBe(true)
    expect(JSON.stringify(arg)).not.toMatch(/red edil|red et/)
  })

  it('toplu kabul onayı "kabul edilecek" / "Evet, kabul et"', async () => {
    confirmSpy.mockClear()
    render(<ApplicationsKanban applications={APPS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Seç' }))
    fireEvent.click(screen.getByRole('button', { name: 'Toplu kabul' }))
    await waitFor(() => expect(confirmSpy).toHaveBeenCalled())
    const arg = confirmSpy.mock.calls[0][0]
    expect(arg.description).toContain('1 başvuru kabul edilecek')
    expect(arg.confirmLabel).toBe('Evet, kabul et')
    expect(arg.destructive).toBe(false)
  })
})
