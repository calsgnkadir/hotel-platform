import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

/** Gelmeyen aday o vardiyanın kadrosundan düşer: saat/iş/son tarih yalnız katıldığı vardiyalardan. */
vi.mock('../../../../api/hotel', () => ({ startConversation: vi.fn() }))
vi.mock('../../../../api/client', () => ({ extractErrorMessage: () => 'Hata' }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../../../../components/AvatarCluster', () => ({ default: () => null }))
vi.mock('../../../../components/Sparkline', () => ({ default: () => null, weeklyTrend: () => [] }))

import WorkersTab from '../WorkersTab'

const DAY = { id: 1, date: '2026-10-05', startTime: '09:00:00', endTime: '17:00:00' }      // 8 saat
const NIGHT = { id: 2, date: '2026-10-08', startTime: '22:00:00', endTime: '06:00:00' }    // 8 saat, gelmedi

const ayse = { id: 42, fullName: 'Ayşe Yılmaz', email: 'ayse@example.com' }
const mehmet = { id: 43, fullName: 'Mehmet Kaya', email: 'mehmet@example.com' }

describe('WorkersTab — vardiya bazlı gelmedi', () => {
  it('gelmedi vardiyası saate ve son tarihe katılmaz; tümü gelmedi olan aday listelenmez', () => {
    render(<WorkersTab applications={[
      { id: 1, status: 'ACCEPTED', workCompleted: true, candidate: ayse, requestedSlots: [DAY, NIGHT], noShowSlotIds: [2] },
      { id: 2, status: 'ACCEPTED', workCompleted: true, candidate: mehmet, requestedSlots: [NIGHT], noShowSlotIds: ['2'] },
    ]} />)
    expect(screen.getByText('Ayşe Yılmaz')).toBeInTheDocument()
    expect(screen.queryByText('Mehmet Kaya')).toBeNull()
    expect(screen.getByText('8.0 saat')).toBeInTheDocument()
    expect(screen.getByText(/Son: 5 Eki 2026/)).toBeInTheDocument()
    expect(screen.getByText('1 kişilik ekip')).toBeInTheDocument()
  })

  it('tüm çalışanlar gelmediyse boş durum', () => {
    render(<WorkersTab applications={[
      { id: 2, status: 'ACCEPTED', workCompleted: true, candidate: mehmet, requestedSlots: [NIGHT], noShowSlotIds: [2] },
    ]} />)
    expect(screen.getByText('Bizde çalışan yok')).toBeInTheDocument()
  })
})
