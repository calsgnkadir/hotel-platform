import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

let mockUser = null
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))
vi.mock('../../lib/webpush', async (importOriginal) => ({
  ...(await importOriginal()),
  isPushSupported: () => true,
  getPermission: () => 'default',
  requestPermission: vi.fn(async () => 'granted'),
  subscribeUser: vi.fn(async () => ({})),
}))

import PushPermissionPrompt from '../PushPermissionPrompt'
import { requestPushMoment, isPushSnoozed } from '../../lib/webpush'

async function fireMoment(reason) {
  await act(async () => { requestPushMoment(reason) })
  await act(async () => { vi.advanceTimersByTime(1100) })
}

describe('PushPermissionPrompt', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); mockUser = null; document.body.innerHTML = '' })
  afterEach(() => { vi.useRealTimers() })

  it('sayfa acilinca kendiliginden sormaz', async () => {
    mockUser = { id: 1, role: 'CANDIDATE' }
    render(<PushPermissionPrompt />)
    await act(async () => { vi.advanceTimersByTime(10_000) })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('giris yapmamis kullaniciya hic sormaz', async () => {
    render(<PushPermissionPrompt />)
    await fireMoment('applied')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('basvurudan sonra adaya dogru metinle sorar', async () => {
    mockUser = { id: 1, role: 'CANDIDATE' }
    render(<PushPermissionPrompt />)
    await fireMoment('applied')
    expect(screen.getByText('push.appliedTitle')).toBeInTheDocument()
  })

  it('acik pencere kapanana kadar bekler', async () => {
    mockUser = { id: 1, role: 'CANDIDATE' }
    const overlay = document.createElement('div')
    overlay.className = 'modal-overlay'
    document.body.appendChild(overlay)
    render(<PushPermissionPrompt />)
    await fireMoment('applied')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    overlay.remove()
    await act(async () => { vi.advanceTimersByTime(1100) })
    expect(screen.getByText('push.appliedTitle')).toBeInTheDocument()
  })

  it('Simdi degil: 7 gun erteler, bu surede tekrar sormaz', async () => {
    mockUser = { id: 2, role: 'BUSINESS_OWNER' }
    render(<PushPermissionPrompt />)
    await fireMoment('listing')
    fireEvent.click(screen.getByRole('button', { name: 'push.later' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(isPushSnoozed()).toBe(true)
    expect(isPushSnoozed(Date.now() + 8 * 24 * 60 * 60 * 1000)).toBe(false)

    await fireMoment('listing')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
