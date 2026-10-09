import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const blockCandidate = vi.fn()
const checkFavorite = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  blockCandidate: (...a) => blockCandidate(...a),
  checkFavorite: (...a) => checkFavorite(...a),
}))
vi.mock('../../../../api/client', () => ({
  extractErrorMessage: (err) => err?.response?.data?.message || 'Hata',
}))

const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: (...a) => toastSuccess(...a), error: (...a) => toastError(...a) },
}))

const confirmMock = vi.fn()
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => confirmMock }))
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

function renderDetail(onRefresh = vi.fn()) {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
  render(<ApplicationDetail app={APP} onRefresh={onRefresh} />)
  return { invalidate, onRefresh }
}

describe('ApplicationDetail — Adayı engelle', () => {
  beforeEach(() => {
    blockCandidate.mockReset()
    checkFavorite.mockReset().mockResolvedValue(false)
    confirmMock.mockReset()
    toastSuccess.mockReset()
    toastError.mockReset()
  })

  afterEach(() => { vi.restoreAllMocks() })

  it('onay verilmezse API çağrılmaz', async () => {
    confirmMock.mockResolvedValue(false)
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Adayı engelle' }))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(confirmMock.mock.calls[0][0]).toMatchObject({
      title: 'Adayı engelle',
      destructive: true,
    })
    expect(confirmMock.mock.calls[0][0].description).toMatch(/Aday bilgilendirilmez\./)
    expect(blockCandidate).not.toHaveBeenCalled()
  })

  it('onaylanınca engeller, toast gösterir ve sorguları yeniler', async () => {
    confirmMock.mockResolvedValue(true)
    blockCandidate.mockResolvedValue(undefined)
    const { invalidate, onRefresh } = renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Adayı engelle' }))
    await waitFor(() => expect(blockCandidate).toHaveBeenCalledWith(42))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Aday engellendi.'))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['applications', 'business'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-blocked-candidates'] })
    expect(onRefresh).toHaveBeenCalled()
  })

  it('hata olursa backend mesajını gösterir', async () => {
    confirmMock.mockResolvedValue(true)
    blockCandidate.mockRejectedValue({ response: { data: { message: 'Aday bulunamadı' } } })
    renderDetail()
    fireEvent.click(screen.getByRole('button', { name: 'Adayı engelle' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Aday bulunamadı'))
    expect(toastSuccess).not.toHaveBeenCalled()
  })
})
