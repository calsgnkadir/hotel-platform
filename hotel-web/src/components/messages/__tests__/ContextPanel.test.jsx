import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * İşletme profili bağlantısı İŞLETME id'si (otherPartyBusinessId) ile açılır.
 * Eskiden kullanıcı id'si (otherPartyId) ile /p/business/ açılıyordu → yanlış işletme / 404.
 * Alan yoksa bağlantı gösterilmez.
 */
vi.mock('../../ReportModal', () => ({ default: () => null }))

import ContextPanel from '../ContextPanel'

const base = { id: 1, otherPartyId: 77, otherPartyName: 'Deniz Otel', createdAt: new Date().toISOString() }

describe('ContextPanel profil bağlantısı', () => {
  it('işletme: /p/business/{otherPartyBusinessId}', () => {
    render(<ContextPanel conversation={{ ...base, otherPartyRole: 'BUSINESS_OWNER', otherPartyBusinessId: 12 }} userRole="CANDIDATE" />)
    expect(screen.getByTitle('Profili gör')).toHaveAttribute('href', '/p/business/12')
    expect(screen.getByRole('button', { name: /İşletme Profili/ })).toBeInTheDocument()
    expect(document.querySelector('a[href="/p/business/77"]')).toBeNull()
  })

  it('işletme id\'si yoksa profil bağlantısı ve düğmesi gösterilmez', () => {
    render(<ContextPanel conversation={{ ...base, otherPartyRole: 'BUSINESS_OWNER' }} userRole="CANDIDATE" />)
    expect(screen.queryByTitle('Profili gör')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /İşletme Profili/ })).not.toBeInTheDocument()
    expect(document.querySelector('a[href^="/p/business/"]')).toBeNull()
  })

  it('aday: /p/candidate/{otherPartyId}', () => {
    render(<ContextPanel conversation={{ ...base, otherPartyName: 'Ayşe', otherPartyRole: 'CANDIDATE' }} userRole="BUSINESS_OWNER" />)
    expect(screen.getByTitle('Profili gör')).toHaveAttribute('href', '/p/candidate/77')
    expect(screen.getByRole('button', { name: /Aday Profili/ })).toBeInTheDocument()
  })
})
