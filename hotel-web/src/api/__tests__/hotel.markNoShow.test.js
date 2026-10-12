import { describe, it, expect, vi, beforeEach } from 'vitest'

const put = vi.fn()
vi.mock('../client', () => ({ default: { put: (...a) => put(...a) } }))

import { markNoShow } from '../hotel'

describe('markNoShow (vardiya bazlı gelmedi)', () => {
  beforeEach(() => { put.mockReset(); put.mockResolvedValue({ data: { candidateStrikesRemaining: 2 } }) })

  it('slotId sorgu parametresi olarak gider', async () => {
    const res = await markNoShow(7, 31)
    expect(put).toHaveBeenCalledWith('/api/business/applications/7/no-show', null, { params: { slotId: 31 } })
    expect(res).toEqual({ candidateStrikesRemaining: 2 })
  })

  it('slotId yoksa parametre eklenmez', async () => {
    await markNoShow(7)
    expect(put).toHaveBeenCalledWith('/api/business/applications/7/no-show', null, { params: {} })
  })
})
