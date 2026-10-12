import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../components/BackButton', () => ({ default: () => null }))

import KvkkPage from '../KvkkPage'

/**
 * Kullanıcı kararı: işletme, kendisine başvuran adayın e-postasını görür.
 * Aydınlatma metni bunu "Veri Paylaşımı" bölümünde açıkça söylemeli; eski
 * "e-posta yalnız kabul eden işletmeye açılır" ifadesi kalmamalı.
 */
describe('KvkkPage veri paylaşımı', () => {
  it('başvuruda ad, e-posta ve profil bilgisinin işletmeyle paylaşıldığını söyler', () => {
    render(<MemoryRouter><KvkkPage /></MemoryRouter>)
    const section = screen.getByRole('heading', { name: '5. Veri Paylaşımı' }).closest('section')
    expect(section).toHaveTextContent('Bir ilana başvurduğunda adın, e-posta adresin ve profil bilgilerin')
    expect(section).toHaveTextContent('o ilanı veren işletmeyle paylaşılır')
    expect(section).not.toHaveTextContent('Telefon ve e-posta gibi iletişim bilgilerin yalnızca')
  })
})
