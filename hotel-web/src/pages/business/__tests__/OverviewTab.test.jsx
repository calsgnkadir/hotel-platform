import { render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import OverviewTab, { overviewKpis } from '../tabs/OverviewTab'
import { buildTodos } from '../components/TodayWidget'

/**
 * UI Paket 5 — işletme Genel bakış: tek "Yapılacaklar" kartı (her satır derin
 * bağlantı), 4 sayılı KPI şeridi, "Son hareketler" tek liste.
 */
const NOW = new Date(2026, 9, 13, 10, 0, 0)       // 13 Eki 2026 10:00 yerel
const TODAY = '2026-10-13'
const iso = (h) => new Date(NOW.getTime() - h * 3600_000).toISOString()

const app = (id, status, extra = {}) => ({
  id, status, createdAt: iso(id), candidate: { id: 500 + id, fullName: `Aday ${id}` },
  listing: { id: 70, title: 'Garson' }, requestedSlots: [], ...extra,
})

describe('buildTodos', () => {
  it('tek bekleyen başvuruda doğrudan başvuruya derin link (&id=)', () => {
    const todos = buildTodos([app(1, 'PENDING')], NOW)
    expect(todos[0]).toMatchObject({ key: 'pending', label: '1 başvuru karar bekliyor' })
    expect(todos[0].to).toBe('/business?tab=applications&status=PENDING&id=1')
  })

  it('birden fazla bekleyende filtre linki', () => {
    const todos = buildTodos([app(1, 'PENDING'), app(2, 'PENDING')], NOW)
    expect(todos[0].to).toBe('/business?tab=applications&status=PENDING')
  })

  it('onayı 24 saatten az kalan HELD; 2 günlük HELD sayılmaz', () => {
    const soon = new Date(NOW.getTime() + 5 * 3600_000).toISOString()
    const later = new Date(NOW.getTime() + 48 * 3600_000).toISOString()
    const todos = buildTodos([app(3, 'HELD', { holdDeadline: soon }), app(4, 'HELD', { holdDeadline: later })], NOW)
    const held = todos.find(t => t.key === 'held')
    expect(held.label).toBe('1 aday onayında, 24 saatten az kaldı')
    expect(held.to).toBe('/business?tab=applications&status=HELD&id=3')
  })

  it('bugünün vardiyası + yoklama (başlamış/2 saat içinde); gelmedi vardiyası düşer', () => {
    const s1 = { id: 1, date: TODAY, startTime: '09:00:00', endTime: '17:00:00' }      // sürüyor
    const s2 = { id: 2, date: TODAY, startTime: '20:00:00', endTime: '23:00:00' }      // 10 saat sonra
    const todos = buildTodos([
      app(5, 'ACCEPTED', { requestedSlots: [s1] }),
      app(6, 'ACCEPTED', { requestedSlots: [s2], listing: { id: 71, title: 'Komi' } }),
      app(7, 'ACCEPTED', { requestedSlots: [{ ...s1, id: 9 }], noShowSlotIds: [9] }),
    ], NOW)
    const shifts = todos.find(t => t.key === 'today-shifts')
    expect(shifts.label).toBe('Bugün 2 kişi çalışıyor')
    expect(shifts.to).toBe('/business?tab=applications&status=ACCEPTED')
    const att = todos.filter(t => t.key.startsWith('attendance-'))
    expect(att).toHaveLength(1)
    expect(att[0].to).toBe('/business?tab=mylistings&attendance=70')
  })

  it('dün 22:00 başlayıp süren gece vardiyası bugün sayılır', () => {
    const early = new Date(2026, 9, 13, 2, 0, 0)
    const night = { id: 1, date: '2026-10-12', startTime: '22:00:00', endTime: '06:00:00' }
    const todos = buildTodos([app(8, 'ACCEPTED', { requestedSlots: [night] })], early)
    expect(todos.map(t => t.key)).toEqual(['today-shifts', 'attendance-70'])
  })

  it('iş yoksa boş liste', () => {
    expect(buildTodos([app(9, 'REJECTED')], NOW)).toEqual([])
  })
})

describe('OverviewTab', () => {
  it('KPI şeridi 4 sayı ve Yapılacaklar sayısını tekrarlamaz', () => {
    const kpis = overviewKpis([app(1, 'PENDING'), app(2, 'ACCEPTED', { workCompleted: true })], NOW)
    expect(kpis.map(k => k.label)).toEqual(['Toplam başvuru', 'Son 7 günde gelen', 'Kabul edilen', 'Tamamlanan iş'])
    expect(kpis.map(k => k.value)).toEqual([2, 2, 1, 1])
  })

  it('tek Yapılacaklar kartı, Son hareketler satırları başvuruya derin link', () => {
    render(<MemoryRouter><OverviewTab applications={[app(1, 'PENDING'), app(2, 'REVIEWING')]} onTabChange={() => {}} /></MemoryRouter>)
    expect(screen.getAllByTestId('todo-card')).toHaveLength(1)
    expect(screen.queryByText('Bugünkü akış')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('kpi-strip')).getAllByRole('listitem')).toHaveLength(4)
    const row = screen.getByRole('link', { name: /Aday 2/ })
    expect(row).toHaveAttribute('href', '/business?tab=applications&id=2')
  })
})
