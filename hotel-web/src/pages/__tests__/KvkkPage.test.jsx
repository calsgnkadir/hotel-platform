import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../components/BackButton', () => ({ default: () => null }))

import KvkkPage from '../KvkkPage'

function renderPage() {
  return render(<MemoryRouter><KvkkPage /></MemoryRouter>)
}

/**
 * Kullanıcı kararı: işletme, kendisine başvuran adayın e-postasını görür.
 * Aydınlatma metni bunu "Veri Paylaşımı" bölümünde açıkça söylemeli; eski
 * "e-posta yalnız kabul eden işletmeye açılır" ifadesi kalmamalı.
 */
describe('KvkkPage veri paylaşımı', () => {
  it('başvuruda ad, e-posta ve profil bilgisinin işletmeyle paylaşıldığını söyler', () => {
    renderPage()
    const section = screen.getByRole('heading', { name: '5. Veri Paylaşımı' }).closest('section')
    expect(section).toHaveTextContent('Bir ilana başvurduğunda adın, e-posta adresin ve profil bilgilerin')
    expect(section).toHaveTextContent('o ilanı veren işletmeyle paylaşılır')
    expect(section).not.toHaveTextContent('Telefon ve e-posta gibi iletişim bilgilerin yalnızca')
  })

  it('hizmet sağlayıcılar: Türkiye\'de barındırma, Cloudinary, Google, e-posta sağlayıcısı', () => {
    renderPage()
    const section = screen.getByRole('heading', { name: '5. Veri Paylaşımı' }).closest('section')
    expect(section).toHaveTextContent("Türkiye'de barındırılır")
    expect(section).toHaveTextContent('Cloudinary')
    expect(section).toHaveTextContent('Google')
    expect(section).toHaveTextContent('E-posta gönderim sağlayıcısı')
  })
})

/**
 * Aydınlatma metni hukuken beklenen bölümlerle; sürüm kayıtta gönderilenle aynı.
 * Şirket bilgileri uydurulmaz: yer tutucu olarak görünür.
 */
describe('KvkkPage yapı', () => {
  it('beklenen bölümler sırayla', () => {
    renderPage()
    const titles = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(titles).toEqual([
      '1. Veri Sorumlusu',
      '2. İşlenen Kişisel Veri Kategorileri',
      '3. İşleme Amaçları ve Hukuki Sebepler',
      '4. Toplama Yöntemi',
      '5. Veri Paylaşımı',
      '6. Yurt Dışına Aktarım',
      '7. Saklama Süreleri',
      '8. Çerezler',
      '9. KVKK m.11 Kapsamındaki Hakların',
      '10. Başvuru Yolu',
    ])
  })

  it('sürüm ve tarih legal.js ile aynı', () => {
    renderPage()
    expect(screen.getByTestId('kvkk-version')).toHaveTextContent('Sürüm 2026-10-17 · Son güncelleme: 17 Ekim 2026')
  })

  it('veri sorumlusu bilgileri uydurulmadı: yer tutucular', () => {
    renderPage()
    const section = screen.getByRole('heading', { name: '1. Veri Sorumlusu' }).closest('section')
    expect(section).toHaveTextContent('[Şirket unvanı]')
    expect(section).toHaveTextContent('[Adres]')
    expect(section).toHaveTextContent('[KEP/e-posta]')
  })

  it('aydınlatma "açık rıza" beyanıyla birleştirilmez', () => {
    renderPage()
    expect(document.body).not.toHaveTextContent(/açık rıza verdiğinizi kabul edersiniz/i)
  })

  it('her amaç için hukuki sebep yazılı', () => {
    renderPage()
    const section = screen.getByRole('heading', { name: '3. İşleme Amaçları ve Hukuki Sebepler' }).closest('section')
    const items = section.querySelectorAll('li')
    expect(items.length).toBeGreaterThanOrEqual(5)
    items.forEach(li => expect(li).toHaveTextContent(/Hukuki sebep: .*m\.5\/2/))
  })
})
