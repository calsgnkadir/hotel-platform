import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Bildirim sayacı react-query önbelleğinden okunur. Eskiden tanımsız
 * fetchUnread()/setUnread() çağrılıyor, hata catch'te yutuluyordu: rozet
 * okununca azalmıyor, "tümünü okundu" sıfırlamıyordu.
 */
let serverUnread = 0
const markNotificationRead = vi.fn(async () => { serverUnread = Math.max(0, serverUnread - 1) })
const markAllNotificationsRead = vi.fn(async () => { serverUnread = 0 })
const getNotifications = vi.fn()
vi.mock('../../api/hotel', () => ({
  getUnreadNotificationCount: vi.fn(async () => serverUnread),
  getNotifications: (...a) => getNotifications(...a),
  markNotificationRead: (...a) => markNotificationRead(...a),
  markAllNotificationsRead: (...a) => markAllNotificationsRead(...a),
}))
vi.mock('../../lib/websocket', () => ({ wsSubscribe: () => ({ unsubscribe: () => {} }) }))
vi.mock('../../lib/useWsConnected', () => ({ default: () => true }))

import NotificationBell, { TYPE_TONE, toneOf } from '../NotificationBell'

const now = new Date().toISOString()
const ITEMS = [
  { id: 1, type: 'MATCHING_LISTING', title: 'Yeni ilan', isRead: false, createdAt: now, link: '/listings/42' },
  { id: 2, type: 'NEW_APPLICATION', title: 'Yeni başvuru', isRead: false, createdAt: now, link: 'applications' },
  { id: 3, type: 'NEW_MESSAGE', title: 'Yeni mesaj', isRead: false, createdAt: now, link: 'messages' },
]

function renderBell(onNavigate = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <NotificationBell onNavigate={onNavigate} />
    </QueryClientProvider>
  )
  return { onNavigate, qc }
}

describe('NotificationBell sayaç', () => {
  beforeEach(() => {
    serverUnread = 3
    localStorage.clear()
    getNotifications.mockReset().mockImplementation(async () => ITEMS.map(x => ({ ...x })))
    markNotificationRead.mockClear()
    markAllNotificationsRead.mockClear()
  })

  it('okunmamış sayısını rozette gösterir', async () => {
    renderBell()
    expect(await screen.findByTestId('notification-unread-badge')).toHaveTextContent('3')
  })

  it('bildirime tıklanınca okundu işaretlenir, rozet hemen azalır ve link iletilir', async () => {
    const { onNavigate } = renderBell()
    await screen.findByTestId('notification-unread-badge')
    fireEvent.click(screen.getByRole('button', { name: /Bildirimler/ }))
    fireEvent.click(await screen.findByText('Yeni ilan'))
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('2'))
    expect(onNavigate).toHaveBeenCalledWith('/listings/42')
  })

  it('"Tümünü okundu işaretle" rozeti sıfırlar', async () => {
    renderBell()
    await screen.findByTestId('notification-unread-badge')
    fireEvent.click(screen.getByRole('button', { name: /Bildirimler/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Tümünü okundu işaretle' }))
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByTestId('notification-unread-badge')).not.toBeInTheDocument())
  })

  it('okundu işaretleme hata verirse rozet değişmez', async () => {
    markNotificationRead.mockRejectedValueOnce(new Error('ağ'))
    renderBell()
    await screen.findByTestId('notification-unread-badge')
    fireEvent.click(screen.getByRole('button', { name: /Bildirimler/ }))
    fireEvent.click(await screen.findByText('Yeni başvuru'))
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith(2))
    expect(screen.getByTestId('notification-unread-badge')).toHaveTextContent('3')
  })
})

/**
 * Durum dili: bildirim noktası en fazla 4 ton. Backend'in yeni tipleri
 * (HOLD_OFFERED, HOLD_RESPONDED, LISTING_CLOSED) tanımlı; bilinmeyen tip nötr.
 */
describe('NotificationBell tonları', () => {
  it('en fazla 4 ton kullanılır', () => {
    const tones = new Set(Object.values(TYPE_TONE))
    expect(tones.size).toBeLessThanOrEqual(4)
    for (const t of tones) expect(['ok', 'warn', 'danger', 'neutral']).toContain(t)
  })

  it('yeni backend tipleri tanımlı, bilinmeyen tip nötr', () => {
    expect(toneOf('HOLD_OFFERED')).toBe('warn')
    expect(toneOf('HOLD_RESPONDED')).toBe('neutral')
    expect(toneOf('LISTING_CLOSED')).toBe('neutral')
    expect(TYPE_TONE).toHaveProperty('HOLD_OFFERED')
    expect(TYPE_TONE).toHaveProperty('HOLD_RESPONDED')
    expect(TYPE_TONE).toHaveProperty('LISTING_CLOSED')
    expect(toneOf('BILINMEYEN')).toBe('neutral')
  })
})
