import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Gece müsaitliği: bitiş < başlangıç geçerli ("Ertesi gün biter" + süre);
 * eşit saat Türkçe hata ve kayıt yapılmaz; müsaitlik vardiya değildir, 16 saat
 * sınırı yoktur (00:00–23:59 geçerli); backend 422 mesajı olduğu gibi gösterilir.
 */
const getBlocks = vi.fn()
const setBlocks = vi.fn()
vi.mock('../../api/hotel', () => ({
  getMyAvailabilityBlocks: (...a) => getBlocks(...a),
  setMyAvailabilityBlocks: (...a) => setBlocks(...a),
}))
vi.mock('../../api/client', () => ({
  extractErrorMessage: (err) => err?.response?.data?.message || 'Hata',
}))
const toastSuccess = vi.fn()
const toastError = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: (...a) => toastSuccess(...a), error: (...a) => toastError(...a) },
}))

import AvailabilityBlocksEditor from '../AvailabilityBlocksEditor'

beforeEach(() => {
  getBlocks.mockReset(); setBlocks.mockReset(); toastSuccess.mockReset(); toastError.mockReset()
})

const NIGHT = { id: 5, dayOfWeek: 'FRIDAY', startTime: '22:00:00', endTime: '06:00:00' }

describe('AvailabilityBlocksEditor', () => {
  it('gece bloğu: "Ertesi gün biter" notu ve süre gösterilir', async () => {
    getBlocks.mockResolvedValue([NIGHT, { id: 6, dayOfWeek: 'MONDAY', startTime: '09:00:00', endTime: '17:00:00' }])
    render(<AvailabilityBlocksEditor />)
    const list = await screen.findByTestId('availability-blocks')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    // Pazartesi önce sıralanır, ertesi gün notu yok
    expect(within(rows[0]).queryByText('Ertesi gün biter')).toBeNull()
    expect(within(rows[1]).getByText('Ertesi gün biter')).toBeInTheDocument()
    expect(within(rows[1]).getByText('8 saat')).toBeInTheDocument()
  })

  it('gece bloğu kaydedilir (HH:mm:ss ile)', async () => {
    getBlocks.mockResolvedValue([])
    setBlocks.mockImplementation(async (list) => list.map((b, i) => ({ id: i + 1, ...b })))
    render(<AvailabilityBlocksEditor />)
    fireEvent.click(await screen.findByRole('button', { name: 'Blok ekle' }))
    fireEvent.change(screen.getByLabelText('Pazartesi başlangıç'), { target: { value: '22:00' } })
    fireEvent.change(screen.getByLabelText('Pazartesi bitiş'), { target: { value: '06:00' } })
    expect(screen.getByText('Ertesi gün biter')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Müsaitliği kaydet' }))
    await waitFor(() => expect(setBlocks).toHaveBeenCalledWith([
      { dayOfWeek: 'MONDAY', startTime: '22:00:00', endTime: '06:00:00' },
    ]))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Müsaitlik kaydedildi'))
  })

  it('eşit saat: satırda hata, kayıt yapılmaz', async () => {
    getBlocks.mockResolvedValue([])
    render(<AvailabilityBlocksEditor />)
    fireEvent.click(await screen.findByRole('button', { name: 'Blok ekle' }))
    fireEvent.change(screen.getByLabelText('Pazartesi bitiş'), { target: { value: '09:00' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Başlangıç ve bitiş saati aynı olamaz')
    fireEvent.click(screen.getByRole('button', { name: 'Müsaitliği kaydet' }))
    expect(toastError).toHaveBeenCalledWith('Pazartesi: Başlangıç ve bitiş saati aynı olamaz')
    expect(setBlocks).not.toHaveBeenCalled()
  })

  it.each([
    ['00:00', '23:59', '24 saat'],
    ['06:00', '23:59', '18 saat'],
  ])('%s–%s: 16 saat hatası yok, kaydedilir', async (start, end, dur) => {
    getBlocks.mockResolvedValue([])
    setBlocks.mockImplementation(async (list) => list.map((b, i) => ({ id: i + 1, ...b })))
    render(<AvailabilityBlocksEditor />)
    fireEvent.click(await screen.findByRole('button', { name: 'Blok ekle' }))
    fireEvent.change(screen.getByLabelText('Pazartesi başlangıç'), { target: { value: start } })
    fireEvent.change(screen.getByLabelText('Pazartesi bitiş'), { target: { value: end } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText(/en fazla 16 saat/)).toBeNull()
    expect(screen.queryByText('Ertesi gün biter')).toBeNull()
    expect(screen.getByText(dur)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Müsaitliği kaydet' }))
    await waitFor(() => expect(setBlocks).toHaveBeenCalledWith([
      { dayOfWeek: 'MONDAY', startTime: `${start}:00`, endTime: `${end}:00` },
    ]))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Müsaitlik kaydedildi'))
    expect(toastError).not.toHaveBeenCalled()
  })

  it('16 saati aşan gece bloğu (09:00–08:00) geçerli, ertesi gün notu var', async () => {
    getBlocks.mockResolvedValue([])
    render(<AvailabilityBlocksEditor />)
    fireEvent.click(await screen.findByRole('button', { name: 'Blok ekle' }))
    fireEvent.change(screen.getByLabelText('Pazartesi bitiş'), { target: { value: '08:00' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Ertesi gün biter')).toBeInTheDocument()
    expect(screen.getByText('23 saat')).toBeInTheDocument()
  })

  it('backend 422 mesajı olduğu gibi gösterilir', async () => {
    getBlocks.mockResolvedValue([])
    setBlocks.mockRejectedValue({ response: { status: 422, data: { message: 'Başlangıç ve bitiş saati aynı olamaz' } } })
    render(<AvailabilityBlocksEditor />)
    fireEvent.click(await screen.findByRole('button', { name: 'Blok ekle' }))
    fireEvent.click(screen.getByRole('button', { name: 'Müsaitliği kaydet' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Başlangıç ve bitiş saati aynı olamaz'))
  })

  it('yükleme hatası: hata durumu ve tekrar dene', async () => {
    getBlocks.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([NIGHT])
    render(<AvailabilityBlocksEditor />)
    expect(await screen.findByText('Müsaitlik blokları yüklenemedi.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('Ertesi gün biter')).toBeInTheDocument()
  })
})
