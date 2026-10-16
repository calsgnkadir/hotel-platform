import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/**
 * Madde 6 — ortak form bileşenlerinin etiketleri alana bağlı. Bu bileşenler
 * aynı sayfada birden çok kez kullanılabildiği için kimlikler useId ile üretilir
 * (çakışma olmaz).
 */
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../api/hotel', () => ({ changePassword: vi.fn(), createReport: vi.fn() }))

import ChangePasswordCard from '../ChangePasswordCard'
import DistrictNeighborhoodSelect from '../DistrictNeighborhoodSelect'
import ReportModal from '../ReportModal'

describe('Ortak form etiketleri', () => {
  it('ChangePasswordCard: üç şifre alanı etiketle bulunur', () => {
    render(<ChangePasswordCard />)
    expect(screen.getByLabelText('Mevcut şifre')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByLabelText('Yeni şifre')).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Yeni şifre (tekrar)')).toBeInTheDocument()
  })

  it('DistrictNeighborhoodSelect: iki örnek aynı sayfada çakışmadan bağlanır', () => {
    render(<><DistrictNeighborhoodSelect district="" neighborhood="" /><DistrictNeighborhoodSelect district="Beşiktaş" neighborhood="" /></>)
    const districts = screen.getAllByLabelText(/İlçe/)
    expect(districts).toHaveLength(2)
    expect(districts[0].id).not.toBe(districts[1].id)
    const hoods = screen.getAllByLabelText('Mahalle')
    expect(hoods[0]).toBeDisabled()
    expect(hoods[1]).toBeEnabled()
  })

  it('ReportModal: neden grubu ve açıklama alanı etiketli', () => {
    render(<ReportModal targetType="USER" targetId={3} targetLabel="Ayşe" onClose={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: 'Neden *' })).toBeInTheDocument()
    const desc = screen.getByLabelText(/Açıklama/)
    expect(desc.tagName).toBe('TEXTAREA')
    fireEvent.click(screen.getByLabelText('Diğer'))
    expect(screen.getByRole('button', { name: 'Bildirimi gönder' })).toBeInTheDocument()
  })
})
