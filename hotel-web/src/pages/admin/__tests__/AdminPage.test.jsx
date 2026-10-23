import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'

/**
 * Admin paneli (Madde 5):
 *  - sekme adreste (?tab=reports derin linki açar, sekme değişimi adrese yazılır)
 *  - şikâyet reddi tarayıcı prompt() yerine not alanlı pencere
 *  - ilan araması 400ms debounce (her tuşta istek yok)
 *  - ham enum metni (ACTIVE, OPEN, BUSINESS_OWNER) görünmez
 */
const api = vi.hoisted(() => ({
  adminGetStats: vi.fn(),
  adminListUsers: vi.fn(),
  adminGetUser: vi.fn(),
  adminListReports: vi.fn(),
  adminUpdateReportStatus: vi.fn(),
  adminListAuditLogs: vi.fn(),
  adminListListings: vi.fn(),
  adminSetListingStatus: vi.fn(),
  adminListSupport: vi.fn(),
  adminUpdateSupportStatus: vi.fn(),
  adminListBusinesses: vi.fn(),
  adminSetBusinessVerified: vi.fn(),
  adminListOutbox: vi.fn(),
  adminRetryOutbox: vi.fn(),
  adminBanUser: vi.fn(),
  adminUnbanUser: vi.fn(),
}))
vi.mock('../../../api/hotel', () => api)
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
const confirmMock = vi.fn(async () => true)
vi.mock('../../../lib/useConfirm', () => ({ useConfirm: () => confirmMock }))
vi.mock('../../../components/DashboardLayout', () => ({
  default: ({ children, activeTab, onTabChange }) => (
    <div>
      <span data-testid="active-tab">{activeTab}</span>
      <button onClick={() => onTabChange('support')}>git: destek</button>
      <button onClick={() => onTabChange('/olmayan')}>git: geçersiz</button>
      {children}
    </div>
  ),
}))

import AdminPage from '../AdminPage'

function Where() {
  return <div data-testid="where">{useLocation().search}</div>
}

function renderAt(url) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes><Route path="/admin" element={<><AdminPage /><Where /></>} /></Routes>
    </MemoryRouter>
  )
}

const REPORT = {
  id: 7, targetType: 'LISTING', targetId: 42, reason: 'SPAM', status: 'PENDING',
  description: 'Sürekli aynı ilan', reporterName: 'Ayşe', reporterEmail: 'a@x.com',
  createdAt: '2026-10-01T10:00:00',
}

beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  confirmMock.mockClear()
  api.adminGetStats.mockResolvedValue({ totalUsers: 10, candidates: 6, businessOwners: 3, admins: 1, bannedUsers: 0, totalBusinesses: 3, totalListings: 5, totalApplications: 9 })
  api.adminListReports.mockResolvedValue([REPORT])
  api.adminUpdateReportStatus.mockResolvedValue({})
  api.adminListSupport.mockResolvedValue([
    { id: 3, status: 'OPEN', subject: 'ACCOUNT', userRole: 'BUSINESS_OWNER', userFullName: 'Ali', userEmail: 'ali@x.com', message: 'Yardım', createdAt: '2026-10-01T10:00:00' },
  ])
  api.adminListListings.mockResolvedValue([
    { id: 1, title: 'Garson', status: 'ACTIVE', position: 'WAITER', businessName: 'Deniz', ownerEmail: 'o@x.com', createdAt: '2026-10-01T10:00:00' },
  ])
  api.adminListOutbox.mockResolvedValue([
    { id: 9, status: 'DEAD', eventType: 'EMAIL', attempts: 5, createdAt: '2026-10-01T10:00:00', lastError: 'smtp' },
  ])
})

afterEach(() => { vi.useRealTimers() })

describe('AdminPage sekme adresi', () => {
  it('?tab olmadan Genel bakış açılır', async () => {
    renderAt('/admin')
    expect(screen.getByTestId('active-tab')).toHaveTextContent('overview')
    expect(await screen.findByText('Toplam kullanıcı')).toBeInTheDocument()
  })

  it('KPI kartı ilgili sekmeye götürür; sekmesi olmayan sayı bağlantısız', async () => {
    renderAt('/admin')
    const listings = await screen.findByRole('link', { name: /Toplam ilan\s*5/ })
    expect(listings).toHaveAttribute('href', '/admin?tab=listings')
    expect(screen.queryByRole('link', { name: /Toplam başvuru/ })).not.toBeInTheDocument()
    fireEvent.click(listings)
    expect(screen.getByTestId('active-tab')).toHaveTextContent('listings')
  })

  it('?tab=reports derin linki Şikâyetler sekmesini açar', async () => {
    renderAt('/admin?tab=reports')
    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports')
    expect(await screen.findByText('Sürekli aynı ilan')).toBeInTheDocument()
  })

  it('sekme değişimi adrese yazılır, geçersiz sekme reddedilir', async () => {
    renderAt('/admin?tab=reports')
    await screen.findByText('Sürekli aynı ilan')
    fireEvent.click(screen.getByText('git: geçersiz'))
    expect(screen.getByTestId('active-tab')).toHaveTextContent('reports')
    fireEvent.click(screen.getByText('git: destek'))
    expect(screen.getByTestId('where')).toHaveTextContent('?tab=support')
    expect(await screen.findByText('Yardım')).toBeInTheDocument()
  })

  it('bilinmeyen ?tab değeri varsayılan sekmeye düşer', () => {
    renderAt('/admin?tab=bozuk')
    expect(screen.getByTestId('active-tab')).toHaveTextContent('overview')
  })
})

describe('Şikâyet reddi', () => {
  it('prompt yerine not alanlı pencere açar ve notu gönderir', async () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => 'x')
    renderAt('/admin?tab=reports')
    fireEvent.click(await screen.findByRole('button', { name: /Reddet/ }))
    const dialog = screen.getByRole('dialog', { name: 'Şikâyeti reddet' })
    expect(dialog).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Admin notu (isteğe bağlı)'), { target: { value: '  Asılsız  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Şikâyeti reddet' }))
    await waitFor(() => expect(api.adminUpdateReportStatus).toHaveBeenCalledWith(7, 'DISMISSED', 'Asılsız'))
    expect(promptSpy).not.toHaveBeenCalled()
    promptSpy.mockRestore()
  })

  it('Vazgeç istek atmadan kapatır; boş not null gider', async () => {
    renderAt('/admin?tab=reports')
    fireEvent.click(await screen.findByRole('button', { name: /Reddet/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Vazgeç' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(api.adminUpdateReportStatus).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /Reddet/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Şikâyeti reddet' }))
    await waitFor(() => expect(api.adminUpdateReportStatus).toHaveBeenCalledWith(7, 'DISMISSED', null))
  })
})

describe('İlan araması', () => {
  it('400ms debounce: hızlı yazımda tek istek', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    renderAt('/admin?tab=listings')
    await act(async () => { await vi.advanceTimersByTimeAsync(450) })
    const initialCalls = api.adminListListings.mock.calls.length
    const box = screen.getByLabelText('İlan ara')
    fireEvent.change(box, { target: { value: 'g' } })
    fireEvent.change(box, { target: { value: 'ga' } })
    fireEvent.change(box, { target: { value: 'gar' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(200) })
    expect(api.adminListListings.mock.calls.length).toBe(initialCalls)
    await act(async () => { await vi.advanceTimersByTimeAsync(300) })
    expect(api.adminListListings.mock.calls.length).toBe(initialCalls + 1)
    expect(api.adminListListings).toHaveBeenLastCalledWith(undefined, 'gar')
  })

  it('durum Türkçe rozetle görünür, ham enum yok', async () => {
    renderAt('/admin?tab=listings')
    expect(await screen.findByText('Garson')).toBeInTheDocument()
    expect(screen.getAllByText('Yayında').length).toBeGreaterThan(0)
    expect(screen.queryByText('ACTIVE')).not.toBeInTheDocument()
  })
})

describe('Ham enum metinleri', () => {
  it('destek talebinde durum/rol Türkçe', async () => {
    renderAt('/admin?tab=support')
    await screen.findByText('Yardım')
    expect(screen.queryByText('OPEN')).not.toBeInTheDocument()
    expect(screen.queryByText(/BUSINESS_OWNER/)).not.toBeInTheDocument()
    expect(screen.getByText(/Ali · İşletme · ali@x.com/)).toBeInTheDocument()
  })

  it('giden kuyrukta DEAD/EMAIL yerine Türkçe etiket', async () => {
    renderAt('/admin?tab=outbox')
    expect(await screen.findByText('E-posta')).toBeInTheDocument()
    expect(screen.queryByText('DEAD')).not.toBeInTheDocument()
    expect(screen.queryByText('Dead Letter')).not.toBeInTheDocument()
  })
})

describe('Genel bakış — bekleyen işler', () => {
  it('bekleyen şikâyet ve açık destek talebi kısa listede, ilgili sekmeye bağlı', async () => {
    renderAt('/admin')
    const reports = await screen.findByRole('region', { name: 'Bekleyen şikâyetler' })
    expect(api.adminListReports).toHaveBeenCalledWith('PENDING')
    const reportRow = await within(reports).findByRole('link', { name: /Sürekli aynı ilan/ })
    expect(reportRow).toHaveAttribute('href', '/admin?tab=reports')
    expect(within(reports).getByRole('link', { name: /Tümünü gör/ })).toHaveAttribute('href', '/admin?tab=reports')

    const support = screen.getByRole('region', { name: 'Açık destek talepleri' })
    const supportRow = await within(support).findByRole('link', { name: /Yardım/ })
    expect(supportRow).toHaveAttribute('href', '/admin?tab=support')
    expect(api.adminListSupport).toHaveBeenCalledWith('OPEN', 100)
    expect(api.adminListSupport).toHaveBeenCalledWith('IN_PROGRESS', 100)
    // iki istek aynı kaydı döndürse de tek satır (id ile tekilleşir)
    expect(within(support).getAllByRole('listitem')).toHaveLength(1)
    expect(within(support).queryByText('OPEN')).not.toBeInTheDocument()
  })

  it('en yeni 5 kayıt gösterilir, rozet toplamı verir', async () => {
    api.adminListReports.mockResolvedValue(Array.from({ length: 7 }, (_, i) => ({
      ...REPORT, id: 100 + i, description: `Şikâyet ${i}`,
    })))
    renderAt('/admin')
    const reports = await screen.findByRole('region', { name: 'Bekleyen şikâyetler' })
    await within(reports).findByText('Şikâyet 0')
    expect(within(reports).getAllByRole('listitem')).toHaveLength(5)
    expect(within(reports).getByText('7')).toBeInTheDocument()
    expect(within(reports).queryByText('Şikâyet 5')).not.toBeInTheDocument()
  })

  it('destek talepleri tarihe göre yeniden eskiye birleşir', async () => {
    api.adminListSupport.mockImplementation(async (status) => status === 'OPEN'
      ? [{ id: 1, status: 'OPEN', subject: 'GENERAL', message: 'Eski talep', createdAt: '2026-10-01T10:00:00' }]
      : [{ id: 2, status: 'IN_PROGRESS', subject: 'TECHNICAL', message: 'Yeni talep', createdAt: '2026-10-05T10:00:00' }])
    renderAt('/admin')
    const support = await screen.findByRole('region', { name: 'Açık destek talepleri' })
    await within(support).findByText('Yeni talep')
    const rows = within(support).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Yeni talep')
    expect(rows[0]).toHaveTextContent('İnceleniyor')
    expect(rows[1]).toHaveTextContent('Eski talep')
  })

  it('boş ve hata durumları; hata yeniden denenebilir', async () => {
    api.adminListReports.mockResolvedValue([])
    api.adminListSupport.mockRejectedValueOnce(new Error('x'))
    renderAt('/admin')
    expect(await screen.findByText('Bekleyen şikâyet yok')).toBeInTheDocument()
    expect(await screen.findByText('Destek talepleri yüklenemedi.')).toBeInTheDocument()
    api.adminListSupport.mockResolvedValue([])
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByText('Açık destek talebi yok')).toBeInTheDocument()
  })
})
