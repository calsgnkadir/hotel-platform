import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AttendanceBoard from '../AttendanceBoard'

describe('AttendanceBoard shift selection', () => {
  it('sends the selected shift and allows an eligible overnight row', async () => {
    const onMarkArrived = vi.fn().mockResolvedValue(undefined)
    render(<AttendanceBoard onMarkArrived={onMarkArrived} data={{ expected: 2, arrived: 0, rows: [
      { applicationId: 1, shiftSlotId: 11, fullName: 'Ayşe', shift: '22:00 – 06:00', status: 'Bekleniyor', canCheckIn: true },
      { applicationId: 1, shiftSlotId: 12, fullName: 'Ayşe', shift: '08:00 – 16:00', status: 'Bekleniyor', canCheckIn: false },
    ] }} />)
    expect(screen.getAllByRole('button', { name: 'Geldi' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Geldi' }))
    await waitFor(() => expect(onMarkArrived).toHaveBeenCalledWith(1, 11))
  })
})
