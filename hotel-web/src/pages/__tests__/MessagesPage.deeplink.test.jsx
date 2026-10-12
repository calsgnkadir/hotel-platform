import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Sohbet derin linki: ?tab=messages&c={id} → ilgili sohbet seçilir, mobilde
 * liste yerine doğrudan sohbet görünümü açılır.
 */
const getMyConversations = vi.fn()
vi.mock('../../api/hotel', () => ({ getMyConversations: (...a) => getMyConversations(...a) }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: 'CANDIDATE' } }) }))
vi.mock('../../lib/useWsConnected', () => ({ default: () => true, useWsReconnectInvalidate: () => {} }))
vi.mock('../../components/messages/ConversationsRail', () => ({
  default: ({ conversations, visible, onSelect }) => (
    <div data-testid="rail" data-visible={String(visible)}>
      {conversations.map(c => <button key={c.id} onClick={() => onSelect(c)}>{c.otherPartyName}</button>)}
    </div>
  ),
}))
vi.mock('../../components/messages/MessageThread', () => ({
  default: ({ conversation }) => <div data-testid="thread">{conversation ? `sohbet ${conversation.id}` : 'seçili yok'}</div>,
}))
vi.mock('../../components/messages/ContextPanel', () => ({ default: () => null }))

import MessagesPage from '../MessagesPage'

const CONVS = [
  { id: 5, otherPartyName: 'Deniz Otel' },
  { id: 6, otherPartyName: 'Mavi Kafe' },
]

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.search}</div>
}

function renderAt(url) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/candidate" element={<><MessagesPage /><Where /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('MessagesPage derin link', () => {
  beforeEach(() => {
    getMyConversations.mockReset().mockResolvedValue({ content: CONVS })
  })

  it('c parametresindeki sohbeti seçer ve mobilde listeyi gizler', async () => {
    renderAt('/candidate?tab=messages&c=6')
    await waitFor(() => expect(screen.getByTestId('thread')).toHaveTextContent('sohbet 6'))
    expect(screen.getByTestId('rail')).toHaveAttribute('data-visible', 'false')
  })

  it('parametre yoksa sohbet seçilmez, liste görünür', async () => {
    renderAt('/candidate?tab=messages')
    await screen.findByText('Deniz Otel')
    expect(screen.getByTestId('thread')).toHaveTextContent('seçili yok')
    expect(screen.getByTestId('rail')).toHaveAttribute('data-visible', 'true')
  })

  it('yeni sohbet önbellekteki listede yoksa liste bir kez tazelenir ve seçilir', async () => {
    getMyConversations
      .mockResolvedValueOnce({ content: CONVS })
      .mockResolvedValue({ content: [...CONVS, { id: 9, otherPartyName: 'Yeni İşletme' }] })
    renderAt('/candidate?tab=messages&c=9')
    await waitFor(() => expect(screen.getByTestId('thread')).toHaveTextContent('sohbet 9'))
    expect(getMyConversations).toHaveBeenCalledTimes(2)
  })

  it('listeden seçim URL\'deki c\'yi günceller', async () => {
    renderAt('/candidate?tab=messages&c=6')
    await waitFor(() => expect(screen.getByTestId('thread')).toHaveTextContent('sohbet 6'))
    fireEvent.click(screen.getByText('Deniz Otel'))
    expect(screen.getByTestId('thread')).toHaveTextContent('sohbet 5')
    expect(screen.getByTestId('where')).toHaveTextContent('tab=messages&c=5')
  })
})
