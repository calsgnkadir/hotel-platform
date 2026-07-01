import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Sparkline, { weeklyTrend } from '../Sparkline'

describe('Sparkline (FAZ 0/#4d smoke)', () => {
  it('tum bucket 0 ise placeholder gosterir', () => {
    const empty = Array.from({ length: 8 }, (_, i) => ({ w: i, c: 0 }))
    render(<Sparkline data={empty} color="#a855f7" />)
    expect(screen.getByText('─')).toBeInTheDocument()
  })

  it('veri varken ResponsiveContainer wrapper render eder', () => {
    const data = [0, 1, 2, 0, 5, 3, 4, 6].map((c, w) => ({ w, c }))
    const { container } = render(<Sparkline data={data} color="#a855f7" />)
    // Recharts ResponsiveContainer 0x0 jsdom'da SVG cizmiyor ama wrapper var
    const wrapper = container.querySelector('.recharts-responsive-container')
    expect(wrapper).toBeInTheDocument()
    // Placeholder '─' GORUNMEMELI (veri var)
    expect(container.textContent).not.toBe('─')
  })

  it('width/height props uygulanir', () => {
    const data = Array.from({ length: 8 }, (_, i) => ({ w: i, c: i }))
    const { container } = render(<Sparkline data={data} color="#c8923a" width={100} height={40} />)
    const wrapper = container.firstChild
    expect(wrapper.style.width).toBe('100px')
    expect(wrapper.style.height).toBe('40px')
  })
})

describe('weeklyTrend helper', () => {
  it('null/empty input bos array doner', () => {
    const result = weeklyTrend([])
    expect(result).toHaveLength(8)
    expect(result.every(r => r.c === 0)).toBe(true)
  })

  it('createdAt null itemleri atlar', () => {
    const items = [{ createdAt: null }, { createdAt: undefined }]
    const result = weeklyTrend(items)
    expect(result.every(r => r.c === 0)).toBe(true)
  })

  it('bu hafta yaratilan item son bucket icine duser', () => {
    const now = new Date()
    const result = weeklyTrend([{ createdAt: now.toISOString() }])
    expect(result[7].c).toBe(1)  // index 7 = bu hafta
    expect(result.slice(0, 7).every(r => r.c === 0)).toBe(true)
  })

  it('filterFn ile statu filtrelenir', () => {
    const items = [
      { createdAt: new Date().toISOString(), status: 'PENDING' },
      { createdAt: new Date().toISOString(), status: 'ACCEPTED' },
    ]
    const result = weeklyTrend(items, a => a.status === 'PENDING')
    expect(result[7].c).toBe(1)
  })
})
