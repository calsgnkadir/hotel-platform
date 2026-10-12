import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Aday paneli: geçersiz sekme id'si reddedilir (boş ekran yok) ve sohbet
 * kimliği kaybolmadan ?tab=messages&c={id} derin linkine yazılır.
 */
vi.mock('../../../api/hotel', () => ({ getMyApplications: vi.fn(async () => []) }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 1, role: 'CANDIDATE' } }) }))
vi.mock('../../../components/OnboardingWizard', () => ({ default: () => null, shouldShowOnboarding: () => false }))
vi.mock('../../../components/candidate/EntryPasses', () => ({ default: () => null }))
vi.mock('../../../components/DashboardLayout', () => ({
  default: ({ children, activeTab, onTabChange }) => (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      <button onClick={() => onTabChange('/listings/42')}>geçersiz: adres</button>
      <button onClick={() => onTabChange('bilinmeyen')}>geçersiz: id</button>
      <button onClick={() => onTabChange('saved')}>geçerli</button>
      {children}
    </div>
  ),
}))
vi.mock('../ListingsPage', () => ({
  default: ({ onMessagesOpen }) => <button onClick={() => onMessagesOpen(55)}>ilan: sohbete git</button>,
}))
vi.mock('../tabs/ApplicationsTab', () => ({
  default: ({ onOpenMessages }) => <button onClick={() => onOpenMessages(77)}>başvuru: mesajlaşma</button>,
}))
vi.mock('../tabs/HistoryTab', () => ({ default: () => null }))
vi.mock('../tabs/ProfileTab', () => ({ default: () => null }))
vi.mock('../tabs/SavedListingsTab', () => ({ default: () => <div>kaydettiklerim</div> }))
vi.mock('../tabs/RelationsTab', () => ({ default: () => null }))
vi.mock('../../MessagesPage', () => ({ default: () => <div>mesajlar</div> }))

import CandidateDashboard from '../CandidateDashboard'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.search}</div>
}

function renderAt(url) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/candidate" element={<><CandidateDashboard /><Where /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CandidateDashboard sekme değiştirici', () => {
  it('geçersiz sekme id\'lerini reddeder; geçerli olanı açar', async () => {
    renderAt('/candidate?tab=listings')
    await screen.findByText('ilan: sohbete git')
    fireEvent.click(screen.getByText('geçersiz: adres'))
    fireEvent.click(screen.getByText('geçersiz: id'))
    expect(screen.getByTestId('active-tab')).toHaveTextContent('listings')
    expect(screen.getByText('ilan: sohbete git')).toBeInTheDocument()
    fireEvent.click(screen.getByText('geçerli'))
    expect(screen.getByTestId('active-tab')).toHaveTextContent('saved')
    expect(screen.getByText('kaydettiklerim')).toBeInTheDocument()
  })

  it('URL\'deki geçersiz sekme varsayılana düşer', async () => {
    renderAt('/candidate?tab=yok')
    expect(await screen.findByText('ilan: sohbete git')).toBeInTheDocument()
    expect(screen.getByTestId('active-tab')).toHaveTextContent('listings')
  })

  it('ilan başvurusundan "sohbete git" sohbet kimliğini URL\'ye yazar', async () => {
    renderAt('/candidate?tab=listings')
    fireEvent.click(await screen.findByText('ilan: sohbete git'))
    expect(screen.getByTestId('active-tab')).toHaveTextContent('messages')
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=messages&c=55')
  })

  it('Başvurularım "mesajlaşma" sohbet kimliğini korur', async () => {
    renderAt('/candidate?tab=applications')
    fireEvent.click(await screen.findByText('başvuru: mesajlaşma'))
    expect(screen.getByText('mesajlar')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=messages&c=77')
  })
})
