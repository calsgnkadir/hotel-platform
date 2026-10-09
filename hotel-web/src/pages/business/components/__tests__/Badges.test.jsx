import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StatusBadge } from '../Badges'

/** UI Paket 3 — işletme rozetleri Türkçe; HELD artık ham "HELD" yazmaz. */
const STATUSES = ['PENDING', 'REVIEWING', 'HELD', 'STANDBY', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']

describe('İşletme StatusBadge', () => {
  it('HELD → "Aday onayında" (nötr ton; işletmeden eylem beklenmiyor)', () => {
    render(<StatusBadge status="HELD" />)
    const b = screen.getByText('Aday onayında')
    expect(b.className).toContain('badge-neutral')
  })

  it('PENDING → "Yeni" (attention; işletmenin yanıtı bekleniyor)', () => {
    render(<StatusBadge status="PENDING" />)
    expect(screen.getByText('Yeni').className).toContain('badge-attention')
  })

  it.each(STATUSES)('%s ham enum / İngilizce metin göstermez', (status) => {
    const { container } = render(<StatusBadge status={status} />)
    expect(container.textContent).not.toBe(status)
    expect(container.textContent).not.toMatch(/HOLD|HELD/i)
  })
})
