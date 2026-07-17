import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'
import ApplicationsTab from '../ApplicationsTab'

/**
 * FAZ 19 — Status filtresinin URL'e tasinmasi (?status=ACCEPTED).
 *
 * Bu, analitik grafigindeki drill-down'in varis noktasi: StatsTab
 * ?tab=applications&status=X'e gonderiyor, burasi da onu okuyup filtreyi
 * uyguluyor. Testler iki ucu birden kilitliyor.
 */
function app(id, status, fullName) {
  return {
    id, status,
    candidate: { id: id * 10, fullName, email: `${fullName.toLowerCase()}@test.com` },
    listing: { title: 'Garson' },
    createdAt: '2026-07-01T10:00:00Z',
  }
}

const APPS = [
  app(1, 'PENDING',   'Ayse'),
  app(2, 'ACCEPTED',  'Burak'),
  app(3, 'ACCEPTED',  'Ceren'),
  app(4, 'REJECTED',  'Deniz'),
]

let lastSearch = ''
function SearchProbe() {
  lastSearch = useLocation().search
  return null
}

function renderTab(initialUrl = '/business?tab=applications', apps = APPS) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <SearchProbe />
      <ApplicationsTab applications={apps} onRefresh={vi.fn()} onOpenMessages={vi.fn()} />
    </MemoryRouter>
  )
}

describe('ApplicationsTab URL status filtresi (FAZ 19)', () => {
  beforeEach(() => {
    lastSearch = ''
    localStorage.setItem('biz-applications-view', 'list')  // kanban'a dusmesin
  })

  it('?status=ACCEPTED ile acilinca sadece kabul edilenler listelenir', () => {
    renderTab('/business?tab=applications&status=ACCEPTED')

    expect(screen.getByText('Burak')).toBeInTheDocument()
    expect(screen.getByText('Ceren')).toBeInTheDocument()
    expect(screen.queryByText('Ayse')).toBeNull()
    expect(screen.queryByText('Deniz')).toBeNull()
  })

  it('URL filtresi chip olarak aktif gorunur — kullanici neye baktigini bilir', () => {
    renderTab('/business?tab=applications&status=ACCEPTED')

    const chip = screen.getByRole('button', { name: /^Kabul/ })
    expect(chip.className).toContain('is-active')
  })

  it('taninmayan status sessizce ALL a duser — bos liste gostermez', () => {
    renderTab('/business?tab=applications&status=BILMEM_NE')

    expect(screen.getByText('Ayse')).toBeInTheDocument()
    expect(screen.getByText('Burak')).toBeInTheDocument()
    expect(screen.getByText('Deniz')).toBeInTheDocument()
  })

  it('chip tiklayinca filtre URL e yazilir (refresh te kaybolmaz)', () => {
    renderTab('/business?tab=applications')

    fireEvent.click(screen.getByRole('button', { name: /^Red/ }))
    expect(lastSearch).toContain('status=REJECTED')
  })

  it('"Tümü" chip i status parametresini URL den siler', () => {
    renderTab('/business?tab=applications&status=ACCEPTED')

    fireEvent.click(screen.getByRole('button', { name: /^Tümü/ }))
    expect(lastSearch).not.toContain('status=')
  })

  it('filtre degisince secili basvuru detayi kapanir (?id dusrulur)', () => {
    renderTab('/business?tab=applications&id=2')

    fireEvent.click(screen.getByRole('button', { name: /^Bekleyen/ }))
    expect(lastSearch).not.toContain('id=')
  })

  it('EXPIRED chip i: o durumda basvuru yoksa gorunmez', () => {
    renderTab('/business?tab=applications')
    expect(screen.queryByRole('button', { name: /Süresi Doldu/ })).toBeNull()
  })

  it('EXPIRED chip i: o durumda basvuru varsa gorunur (donut drill-down hedefi)', () => {
    renderTab('/business?tab=applications', [...APPS, app(5, 'EXPIRED', 'Eren')])
    expect(screen.getByRole('button', { name: /Süresi Doldu/ })).toBeInTheDocument()
  })

  it('EXPIRED chip i: veri olmasa bile filtre aktifse gorunur', () => {
    // Drill-down sonrasi veri degisirse chip kaybolup "neye gore filtreliyim?"
    // durumu olusmamali.
    renderTab('/business?tab=applications&status=EXPIRED')
    expect(screen.getByRole('button', { name: /Süresi Doldu/ })).toBeInTheDocument()
  })
})
