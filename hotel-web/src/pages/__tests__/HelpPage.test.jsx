import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../components/BackButton', () => ({ default: () => null }))

import HelpPage from '../HelpPage'

function renderPage() {
  return render(<MemoryRouter><HelpPage /></MemoryRouter>)
}

describe('HelpPage', () => {
  it('akordeon: düğme aria-expanded/aria-controls ile cevap bölgesini açar', () => {
    renderPage()
    const btn = screen.getByRole('button', { name: /Başvurumu iptal edebilir miyim/ })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    const panel = document.getElementById(btn.getAttribute('aria-controls'))
    expect(panel).not.toBeNull()
    expect(panel).not.toBeVisible()

    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toBeVisible()
    expect(screen.getByRole('region', { name: /Başvurumu iptal edebilir miyim/ })).toBe(panel)
  })

  it('durum ve eylem adları arayüzdekiyle aynı', () => {
    renderPage()
    expect(document.body).toHaveTextContent('"Gönderildi" veya "İnceleniyor" durumdaki')
    expect(document.body).toHaveTextContent('"Gelmedi olarak işaretle" butonu')
    expect(document.body).not.toHaveTextContent('No-Show İşaretle')
    expect(document.body).not.toHaveTextContent('"İncelemede"')
  })

  it('terimler arayüzle aynı: Gelmedi, ceza hakkı, askıya alma, Kabul edildi / Seçilmedi', () => {
    renderPage()
    const text = document.body.textContent
    expect(text).not.toMatch(/no-show/i)
    expect(text).not.toMatch(/strike/i)
    expect(text).not.toMatch(/(^|[^a-zçğıöşü])ban(l[ıa]|$|[^a-zçğıöşüe])/i)
    expect(text).not.toContain('"Kabul"')
    expect(text).not.toContain('"Red"')
    expect(text).not.toMatch(/amber|mercan/i)
    expect(screen.getByRole('button', { name: /"Gelmedi" ne demek\? Cezalandırılır mıyım\?/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bir adayı "Gelmedi" olarak nasıl işaretlerim\?/ })).toBeInTheDocument()
    expect(text).toContain('1 ceza hakkın düşer')
    expect(text).toContain('30 gün askıya alınır')
    expect(text).toContain('"Kabul edildi" durumuna geçer')
    expect(text).toContain('"Seçilmedi" olarak görürsün')
  })

  it('iptal cevabı yedek durumunu anlatır', () => {
    renderPage()
    expect(document.body).toHaveTextContent('Yedek listesindeysen ("Yedeksin") de iptal edebilirsin')
    expect(document.body).toHaveTextContent('"Kabul et" ya da "Gelemem"')
  })

  it('kategori çipi aria-pressed taşır ve listeyi süzer', () => {
    renderPage()
    const kvkk = screen.getByRole('button', { name: 'KVKK' })
    expect(kvkk).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(kvkk)
    expect(kvkk).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('4 sonuç')).toBeInTheDocument()
  })

  it('boş arama sonucunda boş durum ve temizleme düğmesi gösterir', () => {
    renderPage()
    const input = screen.getByRole('searchbox', { name: 'Sorularda ara' })
    fireEvent.change(input, { target: { value: 'zzzz-yok' } })
    expect(screen.getByText('0 sonuç')).toBeInTheDocument()
    expect(screen.getByText('Eşleşen soru bulunamadı')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Aramayı temizle' }))
    expect(input).toHaveValue('')
    expect(screen.getByText('17 sonuç')).toBeInTheDocument()
  })

  it('Türkçe büyük/küçük harf duyarsız arar (İ → i)', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'İŞLETME' } })
    expect(screen.queryByText('0 sonuç')).not.toBeInTheDocument()
  })
})
