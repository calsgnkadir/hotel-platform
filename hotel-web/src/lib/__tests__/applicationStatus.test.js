import { describe, it, expect } from 'vitest'
import {
  APPLICATION_STATUS, STANDBY_OFFER, NO_SHOW, getStatusMeta,
  CAND_FILTER_GROUPS, candGroupForStatus, countCandGroups, BUSINESS_FILTER_LABELS,
} from '../applicationStatus'

/** Durum dili paketi — tek kaynak sözlük. API enum değerleri değişmez. */
const ENUMS = ['PENDING', 'REVIEWING', 'HELD', 'STANDBY', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN']
const TONES = ['neutral', 'attention', 'positive', 'negative']

describe('applicationStatus sözlüğü', () => {
  it('her enum için aday + işletme etiketi ve geçerli ton var', () => {
    expect(Object.keys(APPLICATION_STATUS).sort()).toEqual([...ENUMS].sort())
    for (const e of ENUMS) {
      for (const view of ['candidate', 'business']) {
        const m = APPLICATION_STATUS[e][view]
        expect(m.label).toBeTruthy()
        expect(TONES).toContain(m.tone)
        // 1-2 kelime, cümle düzeni (tamamı büyük harf değil), ham enum değil
        expect(m.label.split(' ').length).toBeLessThanOrEqual(2)
        expect(m.label).not.toBe(m.label.toLocaleUpperCase('tr-TR'))
        expect(m.label).not.toMatch(/HOLD|HELD|PENDING|STANDBY/)
      }
    }
  })

  it('kabul edilen etiketler: HELD ve PENDING bakış açısına göre', () => {
    expect(getStatusMeta('HELD', 'candidate')).toMatchObject({ label: 'Yanıtın bekleniyor', tone: 'attention' })
    expect(getStatusMeta('HELD', 'business')).toMatchObject({ label: 'Aday onayında', tone: 'neutral' })
    expect(getStatusMeta('PENDING', 'candidate')).toMatchObject({ label: 'Gönderildi', tone: 'neutral' })
    expect(getStatusMeta('PENDING', 'business')).toMatchObject({ label: 'Yeni', tone: 'attention' })
    expect(getStatusMeta('HELD', 'candidate').className).toBe('badge badge-attention')
  })

  it('aktif yedek teklifi ayrı etiket alır', () => {
    expect(getStatusMeta('STANDBY', 'candidate', { standbyOfferActive: true }).label).toBe(STANDBY_OFFER.candidate.label)
    expect(getStatusMeta('STANDBY', 'candidate', { standbyOfferActive: true }).tone).toBe('attention')
    expect(getStatusMeta('STANDBY', 'business', { standbyOfferActive: true }).label).toBe('Teklif gönderildi')
    expect(getStatusMeta('STANDBY', 'candidate').label).toBe('Yedeksin')
  })

  it('olumsuz ton yalnız "İşe gelmedi" için (başvuru enumlarında yok)', () => {
    expect(NO_SHOW).toEqual({ label: 'İşe gelmedi', tone: 'negative' })
    for (const e of ENUMS) {
      expect(APPLICATION_STATUS[e].candidate.tone).not.toBe('negative')
      expect(APPLICATION_STATUS[e].business.tone).not.toBe('negative')
    }
  })

  it('bilinmeyen enum ham değeri göstermez', () => {
    const m = getStatusMeta('BILMEM_NE', 'candidate')
    expect(m.label).not.toBe('BILMEM_NE')
    expect(m.tone).toBe('neutral')
  })

  it('"Bekliyor/Beklemede/Bekleyen" etiketleri sözlükte yok', () => {
    const all = [
      ...ENUMS.flatMap(e => [APPLICATION_STATUS[e].candidate.label, APPLICATION_STATUS[e].business.label]),
      ...CAND_FILTER_GROUPS.map(g => g.label),
      ...Object.values(BUSINESS_FILTER_LABELS),
    ]
    for (const l of all) expect(l).not.toMatch(/Bekliyor|Beklemede|Bekleyen/)
  })

  it('işletme filtre etiketleri sözlükten: HELD → "Aday onayında"', () => {
    expect(BUSINESS_FILTER_LABELS).toMatchObject({
      ALL: 'Tümü', PENDING: 'Yeni', HELD: 'Aday onayında', ACCEPTED: 'Kabul edildi', REJECTED: 'Reddedildi',
    })
  })
})

describe('aday filtre grupları', () => {
  it('tam olarak 5 grup, sıra sabit', () => {
    expect(CAND_FILTER_GROUPS.map(g => g.label)).toEqual(['Tümü', 'Yanıtın bekleniyor', 'Süren', 'Kabul edildi', 'Kapanan'])
    expect(CAND_FILTER_GROUPS.find(g => g.key === 'ACTION').hideWhenEmpty).toBe(true)
  })

  it('grup sayıları enum toplamlarına eşit; gruplar ayrık', () => {
    const apps = [
      { status: 'PENDING' }, { status: 'PENDING' }, { status: 'REVIEWING' },
      { status: 'HELD' }, { status: 'STANDBY' }, { status: 'STANDBY', standbyOfferActive: true },
      { status: 'ACCEPTED' }, { status: 'REJECTED' }, { status: 'WITHDRAWN' }, { status: 'WITHDRAWN' }, { status: 'EXPIRED' },
    ]
    const c = countCandGroups(apps)
    const n = (s, extra = () => true) => apps.filter(a => a.status === s && extra(a)).length
    expect(c.ALL).toBe(apps.length)
    expect(c.ACTION).toBe(n('HELD') + n('STANDBY', a => a.standbyOfferActive))
    expect(c.ONGOING).toBe(n('PENDING') + n('REVIEWING') + n('STANDBY', a => !a.standbyOfferActive))
    expect(c.ACCEPTED).toBe(n('ACCEPTED'))
    expect(c.CLOSED).toBe(n('REJECTED') + n('WITHDRAWN') + n('EXPIRED'))
    expect(c.ACTION + c.ONGOING + c.ACCEPTED + c.CLOSED).toBe(c.ALL)
    // her başvuru (Tümü hariç) tam bir grupta
    for (const a of apps) {
      expect(CAND_FILTER_GROUPS.filter(g => g.key !== 'ALL' && g.match(a)).length).toBe(1)
    }
  })

  it('eski enum filtre değeri ilgili gruba eşlenir (derin link uyumu)', () => {
    expect(candGroupForStatus('HELD')).toBe('ACTION')
    expect(candGroupForStatus('PENDING')).toBe('ONGOING')
    expect(candGroupForStatus('REVIEWING')).toBe('ONGOING')
    expect(candGroupForStatus('STANDBY')).toBe('ONGOING')
    expect(candGroupForStatus('ACCEPTED')).toBe('ACCEPTED')
    expect(candGroupForStatus('REJECTED')).toBe('CLOSED')
    expect(candGroupForStatus('WITHDRAWN')).toBe('CLOSED')
    expect(candGroupForStatus('EXPIRED')).toBe('CLOSED')
    expect(candGroupForStatus('')).toBe('ALL')
    expect(candGroupForStatus(undefined)).toBe('ALL')
    expect(candGroupForStatus('XYZ')).toBe('ALL')
    expect(candGroupForStatus('CLOSED')).toBe('CLOSED')
  })
})
