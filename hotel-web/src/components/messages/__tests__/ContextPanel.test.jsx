import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * İşletme profili bağlantısı İŞLETME id'si (otherPartyBusinessId) ile açılır.
 * Eskiden kullanıcı id'si (otherPartyId) ile /p/business/ açılıyordu → yanlış işletme / 404.
 * Alan yoksa bağlantı gösterilmez.
 */
vi.mock('../../ReportModal', () => ({ default: ({ targetType, targetId }) => <div data-testid="report-modal">{targetType}:{targetId}</div> }))

import ContextPanel, { ContextSheet } from '../ContextPanel'

const base = { id: 1, otherPartyId: 77, otherPartyName: 'Deniz Otel', createdAt: new Date().toISOString() }

describe('ContextPanel profil bağlantısı', () => {
  it('işletme: /p/business/{otherPartyBusinessId}', () => {
    render(<ContextPanel conversation={{ ...base, otherPartyRole: 'BUSINESS_OWNER', otherPartyBusinessId: 12 }} userRole="CANDIDATE" />)
    expect(screen.getByTitle('Profili gör')).toHaveAttribute('href', '/p/business/12')
    expect(screen.getByRole('button', { name: /İşletme profili/ })).toBeInTheDocument()
    expect(document.querySelector('a[href="/p/business/77"]')).toBeNull()
  })

  it('işletme id\'si yoksa profil bağlantısı ve düğmesi gösterilmez', () => {
    render(<ContextPanel conversation={{ ...base, otherPartyRole: 'BUSINESS_OWNER' }} userRole="CANDIDATE" />)
    expect(screen.queryByTitle('Profili gör')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /İşletme profili/ })).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="/p/business/"]')).toBeNull()
  })

  it('aday: /p/candidate/{otherPartyId}', () => {
    render(<ContextPanel conversation={{ ...base, otherPartyName: 'Ayşe', otherPartyRole: 'CANDIDATE' }} userRole="BUSINESS_OWNER" />)
    expect(screen.getByTitle('Profili gör')).toHaveAttribute('href', '/p/candidate/77')
    expect(screen.getByRole('button', { name: /Aday profili/ })).toBeInTheDocument()
  })
})

/**
 * Mobil (lg altı) bağlam paneli gizliydi; profil, ilan ve "Kullanıcıyı bildir"
 * mobilde erişilemiyordu. ContextSheet aynı içeriği alttan açılan sayfada verir.
 */
describe('ContextSheet (mobil sohbet bilgileri)', () => {
  const conv = { ...base, otherPartyRole: 'CANDIDATE', listingId: 5, listingTitle: 'Garson', applicationId: 9 }

  it('kapalıyken hiçbir şey çizmez', () => {
    render(<ContextSheet open={false} onClose={() => {}} conversation={conv} userRole="BUSINESS_OWNER" />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('profil, ilan, başvuru ve bildir işlemlerini sunar; Kapat ile kapanır', () => {
    const onClose = vi.fn()
    const navigate = vi.fn()
    render(<ContextSheet open onClose={onClose} conversation={conv} userRole="BUSINESS_OWNER" navigate={navigate} />)
    const dialog = screen.getByRole('dialog', { name: 'Sohbet bilgileri' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aday profili/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /İlanı görüntüle/ })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /Başvuruyu yönet/ }))
    expect(navigate).toHaveBeenCalledWith('/business?tab=applications&id=9')
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('"Kullanıcıyı bildir" şikâyet penceresini kullanıcı hedefiyle açar', () => {
    render(<ContextSheet open onClose={() => {}} conversation={conv} userRole="CANDIDATE" />)
    fireEvent.click(screen.getByRole('button', { name: /Kullanıcıyı bildir/ }))
    expect(screen.getByTestId('report-modal')).toHaveTextContent('USER:77')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Esc alt sayfayı kapatır', () => {
    const onClose = vi.fn()
    render(<ContextSheet open onClose={onClose} conversation={conv} userRole="CANDIDATE" />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('ContextPanel sohbet bilgisi', () => {
  it('başlangıç tarihi yoksa "Başladı" satırı gösterilmez, diğer satırlar kalır', () => {
    render(<ContextPanel conversation={{ id: 2, otherPartyId: 5, otherPartyName: 'Ayşe', otherPartyRole: 'CANDIDATE', lastMessageAt: new Date().toISOString() }} userRole="BUSINESS_OWNER" />)
    expect(screen.queryByText('Başladı')).not.toBeInTheDocument()
    expect(screen.getByText('Son mesaj')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('Başladı—')
  })

  it('hiç sohbet verisi yoksa bölüm gizlenir', () => {
    render(<ContextPanel conversation={{ id: 3, otherPartyId: 5, otherPartyName: 'Ayşe', otherPartyRole: 'CANDIDATE' }} userRole="BUSINESS_OWNER" />)
    expect(screen.queryByRole('region', { name: 'Sohbet bilgisi' })).not.toBeInTheDocument()
    expect(screen.queryByText('Başladı')).not.toBeInTheDocument()
  })

  it('başlangıç tarihi varsa satır görünür', () => {
    render(<ContextPanel conversation={{ ...base, otherPartyRole: 'CANDIDATE' }} userRole="BUSINESS_OWNER" />)
    expect(screen.getByText('Başladı')).toBeInTheDocument()
    expect(screen.getByText('Bugün')).toBeInTheDocument()
  })
})
