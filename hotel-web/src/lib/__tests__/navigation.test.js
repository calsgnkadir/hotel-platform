import { describe, it, expect } from 'vitest'
import {
  ROLE, topNavFor, mobileBarFor, menuNavFor, validTabsFor, resolveTab, tabLabel, tabForShortcut,
  defaultTabFor, panelPathFor,
} from '../navigation'

describe('navigation — tek kaynak', () => {
  it('işletme üst nav: Genel bakış · İlanlarım · Başvurular · Ekibim · Abonelik', () => {
    expect(topNavFor(ROLE.BUSINESS).map(i => i.label))
      .toEqual(['Genel bakış', 'İlanlarım', 'Başvurular', 'Ekibim', 'Abonelik'])
    expect(menuNavFor(ROLE.BUSINESS).map(i => i.label)).toEqual(['İşletme profili'])
  })

  it('aday üst nav: İlanlar · Başvurularım · Kaydettiklerim; geçmiş işler menüde', () => {
    expect(topNavFor(ROLE.CANDIDATE).map(i => i.label)).toEqual(['İlanlar', 'Başvurularım', 'Kaydettiklerim'])
    expect(menuNavFor(ROLE.CANDIDATE).map(i => i.id)).toEqual(['profile', 'history', 'relations'])
    expect(validTabsFor(ROLE.CANDIDATE)).toContain('history')
  })

  it('backend bildirim sekmeleri geçerli kalır', () => {
    for (const t of ['applications', 'messages', 'billing']) {
      expect(resolveTab(ROLE.BUSINESS, t)?.tab).toBe(t)
    }
    expect(resolveTab(ROLE.CANDIDATE, 'applications')?.tab).toBe('applications')
    expect(resolveTab(ROLE.CANDIDATE, 'messages')?.tab).toBe('messages')
  })

  it('eski işletme sekmeleri yeni karşılığına çözülür', () => {
    expect(resolveTab(ROLE.BUSINESS, 'listings')).toMatchObject({ tab: 'mylistings', aliased: true })
    expect(resolveTab(ROLE.BUSINESS, 'workers')).toMatchObject({ tab: 'team', params: { view: 'workers' } })
    expect(resolveTab(ROLE.BUSINESS, 'favorites')).toMatchObject({ tab: 'team', params: { view: 'favorites' } })
  })

  it('bilinmeyen sekme ve adres null döner', () => {
    expect(resolveTab(ROLE.BUSINESS, '/listings/42')).toBeNull()
    expect(resolveTab(ROLE.CANDIDATE, 'yok')).toBeNull()
    expect(resolveTab(ROLE.CANDIDATE, null)).toBeNull()
  })

  it('"Talent Pool" ve tutarsız adlar yok', () => {
    const all = [ROLE.BUSINESS, ROLE.CANDIDATE, ROLE.ADMIN]
      .flatMap(r => validTabsFor(r).map(id => tabLabel(r, id)))
    expect(all.join(' ')).not.toMatch(/Talent/)
    // Cümle düzeni: ilk kelimeden sonra büyük harfle başlayan kelime yok
    for (const label of all) {
      expect(label.split(' ').slice(1).some(w => /^[A-ZÇĞİÖŞÜ]/.test(w))).toBe(false)
    }
    expect(tabLabel(ROLE.BUSINESS, 'profile')).toBe('İşletme profili')
    expect(tabLabel(ROLE.CANDIDATE, 'profile')).toBe('Profilim')
  })

  it('kısayollar rol bazında çözülür', () => {
    expect(tabForShortcut(ROLE.BUSINESS, 'l')).toBe('mylistings')
    expect(tabForShortcut(ROLE.CANDIDATE, 'l')).toBe('listings')
    expect(tabForShortcut(ROLE.CANDIDATE, 'o')).toBeNull()
    expect(tabForShortcut(ROLE.BUSINESS, 'E')).toBe('team')
  })

  it('mobil alt çubuk: aday 3, işletme 5, admin 4 öğe; admin kalanları menüde (yalnız mobil)', () => {
    expect(mobileBarFor(ROLE.CANDIDATE)).toHaveLength(3)
    expect(mobileBarFor(ROLE.BUSINESS)).toHaveLength(5)
    expect(mobileBarFor(ROLE.ADMIN)).toHaveLength(4)
    expect(menuNavFor(ROLE.ADMIN).every(i => i.mobileOnly)).toBe(true)
  })

  it('varsayılan sekme ve panel yolu', () => {
    expect(defaultTabFor(ROLE.CANDIDATE)).toBe('listings')
    expect(defaultTabFor(ROLE.BUSINESS)).toBe('overview')
    expect(panelPathFor(ROLE.BUSINESS)).toBe('/business')
    expect(panelPathFor(undefined)).toBe('/')
  })
})
