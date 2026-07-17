import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import StatsTab from '../StatsTab'
import * as hotelApi from '../../../../api/hotel'

vi.mock('../../../../api/hotel', () => ({ getBusinessStats: vi.fn() }))

/**
 * FAZ 19 — Funnel drill-down.
 *
 * Asil sozlesme: grafikte gorunen sayi ile drill-down sonrasi listedeki
 * kayit sayisi ayni olmali. Backend'de reviewed = total - pending ve
 * completed = accepted (placeholder) oldugu icin bu iki asamanin tek bir
 * status karsiligi YOK — tiklanamaz olmalilar. Testler bunu kilitliyor ki
 * ileride "hepsini tiklanabilir yapalim" denip veri guveni bozulmasin.
 */
const STATS = {
  thisMonthApplications: 8, lastMonthApplications: 4,
  acceptanceRate: 0.25, activeListings: 3, totalApplications: 20,
  funnel: { received: 20, reviewed: 12, accepted: 5, completed: 5 },
  hireTime: [], byStatus: [], byPosition: [], dailyTrend: [],
}

function renderStats(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <StatsTab {...props} />
    </QueryClientProvider>
  )
}

describe('StatsTab drill-down (FAZ 19)', () => {
  beforeEach(() => {
    hotelApi.getBusinessStats.mockResolvedValue(STATS)
  })

  it('"Kabul" asamasi tiklanabilir ve ACCEPTED ile drill-down yapar', async () => {
    const onDrillDown = vi.fn()
    renderStats({ onDrillDown })

    const btn = await screen.findByTitle('Kabul başvurularını listele')
    fireEvent.click(btn)
    expect(onDrillDown).toHaveBeenCalledWith('ACCEPTED')
  })

  it('"Alındı" asamasi tum basvurulari acar (ALL)', async () => {
    const onDrillDown = vi.fn()
    renderStats({ onDrillDown })

    fireEvent.click(await screen.findByTitle('Alındı başvurularını listele'))
    expect(onDrillDown).toHaveBeenCalledWith('ALL')
  })

  it('"İncelendi" ve "Tamamlandı" TIKLANAMAZ — tek status karsiligi yok', async () => {
    renderStats({ onDrillDown: vi.fn() })
    await screen.findByText('İncelendi')

    // Buton olarak var olmamalilar (metin olarak var, ama tiklanabilir degil)
    expect(screen.queryByTitle('İncelendi başvurularını listele')).toBeNull()
    expect(screen.queryByTitle('Tamamlandı başvurularını listele')).toBeNull()
  })

  it('onDrillDown verilmezse hicbir asama tiklanabilir degil', async () => {
    renderStats()
    await screen.findByText('Kabul')
    expect(document.querySelector('.funnel-stage-btn')).toBeNull()
  })

  it('count=0 olan asama tiklanamaz — bos listeye goturmez', async () => {
    hotelApi.getBusinessStats.mockResolvedValue({
      ...STATS, funnel: { received: 20, reviewed: 12, accepted: 0, completed: 0 },
    })
    renderStats({ onDrillDown: vi.fn() })
    await screen.findByText('Kabul')

    expect(screen.queryByTitle('Kabul başvurularını listele')).toBeNull()
    // Alindi hala tiklanabilir (count > 0)
    expect(screen.getByTitle('Alındı başvurularını listele')).toBeInTheDocument()
  })
})
