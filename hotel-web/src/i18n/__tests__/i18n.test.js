import { describe, it, expect } from 'vitest'
import i18n from '../index'

/**
 * Dil varsayılanı: her zaman Türkçe. Tarayıcı dili (navigator) dikkate ALINMAZ —
 * İngilizce tarayıcılı kullanıcı karışık arayüz görmesin. İngilizce yalnızca
 * kullanıcı dil seçiciden elle seçerse (localStorage 'lang') gelir.
 *
 * Bu test, biri detection order'a tekrar 'navigator' eklerse kırmızı verir:
 * jsdom'da navigator.language genelde 'en-US' olduğu halde dil 'tr' olmalı.
 */
describe('i18n varsayılan dil', () => {
  it('localStorage boşken çözülen dil Türkçe (navigator yok sayılır)', () => {
    expect(i18n.resolvedLanguage || i18n.language).toBe('tr')
  })

  it('nav etiketleri Türkçe döner', () => {
    expect(i18n.t('nav.listings')).toBe('İlanlar')
    expect(i18n.t('nav.applications')).toBe('Başvurularım')
  })

  it('manuel İngilizce seçilince etiketler İngilizce döner (seçenek korunuyor)', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('nav.listings')).toBe('Listings')
    await i18n.changeLanguage('tr')  // diğer testleri etkilemesin
  })
})
