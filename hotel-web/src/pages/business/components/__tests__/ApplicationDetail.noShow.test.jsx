import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Vardiya bazlı "Gelmedi": yalnız başlangıcı + 30 dk geçmiş ve işaretlenmemiş
 * vardiyalar seçilebilir; tek uygun vardiyada doğrudan onay; onay metni ceza
 * bilgisini içerir; slotId API'ye gider; işaretli vardiya "Gelmedi" rozeti alır.
 */
const markNoShow = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  checkFavorite: vi.fn(async () => false),
  markNoShow: (...a) => markNoShow(...a),
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

// Sabit an: 12 Ekim 2026 23:00 (yerel)
const NOW = new Date(2026, 9, 12, 23, 0, 0)
const PAST_DAY = { id: 31, date: '2026-10-12', startTime: '08:00:00', endTime: '16:00:00' }
const NIGHT = { id: 32, date: '2026-10-12', startTime: '22:00:00', endTime: '06:00:00' }        // 22:30'dan beri uygun
const JUST_STARTED = { id: 33, date: '2026-10-12', startTime: '22:45:00', endTime: '23:30:00' } // 23:15'e kadar uygun değil
const FUTURE = { id: 34, date: '2026-10-14', startTime: '09:00:00', endTime: '17:00:00' }

const BASE = {
  id: 11,
  status: 'ACCEPTED',
  candidate: { id: 42, fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' },
  listing: { title: 'Garson', businessName: 'Deniz Otel' },
}

let invalidate
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  markNoShow.mockReset(); toastSuccess.mockReset(); toastError.mockReset(); confirmMock.mockReset()
  invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
})
afterEach(() => { vi.useRealTimers(); invalidate.mockRestore() })

describe('ApplicationDetail — vardiya bazlı gelmedi', () => {
  it('tek uygun vardiya: doğrudan onay, ceza metni, slotId ile çağrı, toast + yenileme', async () => {
    confirmMock.mockResolvedValue(true)
    const application = { ...BASE, noShowSlotIds: [32] }
    markNoShow.mockResolvedValue({ application, candidateStrikesRemaining: 2, autoBanned: false })
    const onRefresh = vi.fn(), onChanged = vi.fn()
    render(<ApplicationDetail app={{ ...BASE, requestedSlots: [NIGHT, JUST_STARTED, FUTURE] }}
                              onRefresh={onRefresh} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gelmedi olarak işaretle' }))
    await waitFor(() => expect(markNoShow).toHaveBeenCalledWith(11, 32))
    const opts = confirmMock.mock.calls[0][0]
    expect(opts.description).toContain('Bu vardiya için adaya 1 ceza puanı düşer.')
    expect(opts.description).toContain('22:00–06:00 +1')
    expect(opts.destructive).toBe(true)
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('kalan ceza hakkı: 2')))
    expect(onChanged).toHaveBeenCalledWith(application)
    expect(onRefresh).toHaveBeenCalled()
    expect(invalidate).toHaveBeenCalled()
  })

  it('birden fazla uygun vardiya: seçim listesi; zaten işaretli ve henüz uygun olmayan listelenmez', async () => {
    confirmMock.mockResolvedValue(true)
    markNoShow.mockResolvedValue({ application: BASE, candidateStrikesRemaining: 0, autoBanned: true, bannedUntil: '2026-11-11T00:00:00' })
    render(<ApplicationDetail app={{
      ...BASE,
      requestedSlots: [PAST_DAY, NIGHT, JUST_STARTED, FUTURE,
        { id: 30, date: '2026-10-11', startTime: '09:00:00', endTime: '17:00:00' }],
      noShowSlotIds: [30],
    }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gelmedi olarak işaretle' }))
    expect(confirmMock).not.toHaveBeenCalled()
    const group = screen.getByRole('group', { name: 'Gelmedi işaretlenecek vardiya' })
    const options = within(group).getAllByRole('button').filter(b => b.textContent !== 'Vazgeç')
    expect(options.map(b => b.textContent)).toEqual(['Bugün 08:00–16:00', 'Bugün 22:00–06:00 +1'])
    fireEvent.click(options[0])
    await waitFor(() => expect(markNoShow).toHaveBeenCalledWith(11, 31))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining('askıya alındı'), expect.anything()))
  })

  it('onay verilmezse API çağrılmaz', async () => {
    confirmMock.mockResolvedValue(false)
    render(<ApplicationDetail app={{ ...BASE, requestedSlots: [NIGHT] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gelmedi olarak işaretle' }))
    await waitFor(() => expect(confirmMock).toHaveBeenCalled())
    expect(markNoShow).not.toHaveBeenCalled()
  })

  it('uygun vardiya yoksa düğme yok, 30 dakika kuralı yazılır', () => {
    render(<ApplicationDetail app={{ ...BASE, requestedSlots: [JUST_STARTED, FUTURE] }} />)
    expect(screen.queryByRole('button', { name: 'Gelmedi olarak işaretle' })).not.toBeInTheDocument()
    expect(screen.getByText('Gelmedi işareti vardiya başladıktan 30 dakika sonra verilebilir.')).toBeInTheDocument()
  })

  it('backend hatası (422) olduğu gibi gösterilir', async () => {
    confirmMock.mockResolvedValue(true)
    markNoShow.mockRejectedValue({ response: { data: { message: 'Bu vardiya için giriş kaydı var; gelmedi olarak işaretlenemez.' } } })
    render(<ApplicationDetail app={{ ...BASE, requestedSlots: [NIGHT] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Gelmedi olarak işaretle' }))
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Bu vardiya için giriş kaydı var; gelmedi olarak işaretlenemez.'))
  })

  it('vardiya listesinde işaretli vardiya "Gelmedi" rozeti alır; bilgi bandı görünür', () => {
    render(<ApplicationDetail app={{ ...BASE, requestedSlots: [NIGHT, PAST_DAY], noShowSlotIds: [31], noShow: true }} />)
    const list = screen.getByTestId('application-slots')
    const items = within(list).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('08:00–16:00')
    expect(within(items[0]).getByText('Gelmedi').className).toContain('badge-negative')
    expect(within(items[1]).queryByText('Gelmedi')).not.toBeInTheDocument()
    expect(screen.getByTestId('no-show-banner')).toHaveTextContent('Gelmedi olarak işaretlendi')
    // Kalan uygun vardiya (gece) hâlâ işaretlenebilir
    expect(screen.getByRole('button', { name: 'Gelmedi olarak işaretle' })).toBeInTheDocument()
  })
})
