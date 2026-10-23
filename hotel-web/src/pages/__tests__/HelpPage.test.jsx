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
