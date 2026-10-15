import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * İşletme paneli: geçersiz sekme reddedilir, backend'in eski "listings"
 * bildirim linki "İlanlarım"a eşlenir, sohbet kimliği derin linke yazılır.
 * Paket 5: eski ?tab=workers / ?tab=favorites linkleri Ekibim'e (team) yönlenir;
 * başvurular yüklenemezse hata kartı + "Tekrar dene".
 */
const api = vi.hoisted(() => ({ getBusinessApplications: vi.fn(async () => []) }))
vi.mock('../../../api/hotel', () => api)
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 9, role: 'BUSINESS_OWNER' } }) }))
vi.mock('../../../components/OnboardingWizard', () => ({ default: () => null, shouldShowOnboarding: () => false }))
vi.mock('../../../components/DashboardLayout', () => ({
  default: ({ children, activeTab, onTabChange }) => (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      <button onClick={() => onTabChange('/listings/42')}>geçersiz: adres</button>
      <button onClick={() => onTabChange('listings')}>eski: listings</button>
      {children}
    </div>
  ),
}))
vi.mock('../tabs/OverviewTab', () => ({ default: () => <div>genel bakış</div> }))
vi.mock('../tabs/MyListingsTab', () => ({ default: () => <div>ilanlarım</div> }))
vi.mock('../tabs/ApplicationsTab', () => ({
  default: ({ onOpenMessages }) => <button onClick={() => onOpenMessages(31)}>başvuru: mesajlaşma</button>,
}))
vi.mock('../tabs/TeamTab', () => ({ default: () => <div>ekibim</div> }))
vi.mock('../tabs/ProfileTab', () => ({ default: () => null }))
vi.mock('../tabs/BillingTab', () => ({ default: () => null }))
vi.mock('../../MessagesPage', () => ({ default: () => <div>mesajlar</div> }))

import BusinessDashboard from '../BusinessDashboard'

function Where() {
  const loc = useLocation()
  return <div data-testid="where">{loc.search}</div>
}

function renderAt(url) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/business" element={<><BusinessDashboard /><Where /></>} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BusinessDashboard sekme değiştirici', () => {
  it('geçersiz id reddedilir, "listings" İlanlarım\'a eşlenir', async () => {
    renderAt('/business')
    await screen.findByText('genel bakış')
    fireEvent.click(screen.getByText('geçersiz: adres'))
    expect(screen.getByTestId('active-tab')).toHaveTextContent('overview')
    fireEvent.click(screen.getByText('eski: listings'))
    expect(screen.getByTestId('active-tab')).toHaveTextContent('mylistings')
    expect(screen.getByText('ilanlarım')).toBeInTheDocument()
  })

  it('push bildirimi adresi ?tab=listings de İlanlarım\'ı açar', async () => {
    renderAt('/business?tab=listings')
    expect(await screen.findByText('ilanlarım')).toBeInTheDocument()
  })

  it('başvurudan mesajlaşma sohbet kimliğini korur', async () => {
    renderAt('/business?tab=applications')
    fireEvent.click(await screen.findByText('başvuru: mesajlaşma'))
    expect(screen.getByText('mesajlar')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=messages&c=31')
  })

  it('eski ?tab=workers derin linki Ekibim > Bizde çalışanlar açar ve adresi yeniler', async () => {
    renderAt('/business?tab=workers')
    expect(await screen.findByText('ekibim')).toBeInTheDocument()
    expect(screen.getByTestId('active-tab')).toHaveTextContent('team')
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=team&view=workers')
  })

  it('eski ?tab=favorites derin linki Ekibim > Favoriler açar', async () => {
    renderAt('/business?tab=favorites')
    expect(await screen.findByText('ekibim')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=team&view=favorites')
  })

  it('başvurular yüklenemezse hata kartı ve "Tekrar dene"', async () => {
    api.getBusinessApplications.mockRejectedValueOnce(new Error('ağ'))
    renderAt('/business?tab=applications')
    expect(await screen.findByText('Başvurular yüklenemedi.')).toBeInTheDocument()
    api.getBusinessApplications.mockResolvedValueOnce([])
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('başvuru: mesajlaşma')).toBeInTheDocument()
  })
})
