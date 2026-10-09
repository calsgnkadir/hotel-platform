import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const listFavorites = vi.fn()
const getMyBlockedCandidates = vi.fn()
const unblockCandidate = vi.fn()
vi.mock('../../../../api/hotel', () => ({
  listFavorites: (...a) => listFavorites(...a),
  getMyBlockedCandidates: (...a) => getMyBlockedCandidates(...a),
  unblockCandidate: (...a) => unblockCandidate(...a),
  removeFavorite: vi.fn(),
  startConversation: vi.fn(),
}))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'Hata' }))

const toastSuccess = vi.fn()
vi.mock('react-hot-toast', () => ({
  default: { success: (...a) => toastSuccess(...a), error: vi.fn() },
}))

const confirmMock = vi.fn()
vi.mock('../../../../lib/useConfirm', () => ({ useConfirm: () => confirmMock }))

import FavoritesTab from '../FavoritesTab'

const BLOCKED = [
  { candidateId: 7, candidateName: 'Mehmet Kaya', candidateAvatarUrl: null, blockedAt: '2026-10-01T10:00:00' },
  { candidateId: 8, candidateName: 'Zeynep Ak', candidateAvatarUrl: null, blockedAt: '2026-09-20T10:00:00' },
]

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <FavoritesTab />
    </QueryClientProvider>
  )
}

async function openBlocked() {
  const tab = await screen.findByRole('tab', { name: /Engellenenler/ })
  fireEvent.click(tab)
}

describe('FavoritesTab — Engellenenler', () => {
  beforeEach(() => {
    listFavorites.mockReset().mockResolvedValue([])
    getMyBlockedCandidates.mockReset()
    unblockCandidate.mockReset()
    confirmMock.mockReset()
    toastSuccess.mockReset()
  })

  it('engellenen adayları ad ve tarihle listeler, sayaç gösterir', async () => {
    getMyBlockedCandidates.mockResolvedValue(BLOCKED)
    renderTab()
    await waitFor(() => expect(screen.getByRole('tab', { name: /Engellenenler\s*2/ })).toBeInTheDocument())
    await openBlocked()
    expect(await screen.findByText('Mehmet Kaya')).toBeInTheDocument()
    expect(screen.getByText('Zeynep Ak')).toBeInTheDocument()
    expect(screen.getAllByText(/tarihinde engellendi/)).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Engeli kaldır' })).toHaveLength(2)
    expect(screen.queryByText(/@/)).not.toBeInTheDocument()
  })

  it('liste boşsa boş durum metnini gösterir', async () => {
    getMyBlockedCandidates.mockResolvedValue([])
    renderTab()
    await openBlocked()
    expect(await screen.findByText('Engellediğin aday yok.')).toBeInTheDocument()
  })

  it('yükleme hatasında hata durumu gösterir', async () => {
    getMyBlockedCandidates.mockRejectedValue(new Error('x'))
    renderTab()
    await openBlocked()
    expect(await screen.findByText('Engellenen adaylar yüklenemedi.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tekrar dene' })).toBeInTheDocument()
  })

  it('engeli kaldır: onay olmadan çağrılmaz, onayla çağrılır ve liste yenilenir', async () => {
    getMyBlockedCandidates.mockResolvedValue(BLOCKED)
    unblockCandidate.mockResolvedValue(undefined)
    renderTab()
    await openBlocked()
    const row = (await screen.findByText('Mehmet Kaya')).closest('.card')

    confirmMock.mockResolvedValueOnce(false)
    fireEvent.click(within(row).getByRole('button', { name: 'Engeli kaldır' }))
    await waitFor(() => expect(confirmMock).toHaveBeenCalledTimes(1))
    expect(unblockCandidate).not.toHaveBeenCalled()

    const callsBefore = getMyBlockedCandidates.mock.calls.length
    confirmMock.mockResolvedValueOnce(true)
    fireEvent.click(within(row).getByRole('button', { name: 'Engeli kaldır' }))
    await waitFor(() => expect(unblockCandidate).toHaveBeenCalledWith(7))
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Engel kaldırıldı.'))
    await waitFor(() => expect(getMyBlockedCandidates.mock.calls.length).toBeGreaterThan(callsBefore))
  })
})
