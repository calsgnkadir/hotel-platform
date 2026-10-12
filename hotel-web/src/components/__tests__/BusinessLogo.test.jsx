import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import BusinessLogo, { businessInitial } from '../BusinessLogo'

describe('BusinessLogo', () => {
  it('gerçek logo varsa görseli gösterir', () => {
    render(<BusinessLogo name="Deniz Otel" logoUrl="https://cdn.example.com/logo.png" />)
    const img = screen.getByTestId('business-logo-img')
    expect(img).toHaveAttribute('src', expect.stringContaining('logo.png'))
    expect(screen.queryByTestId('business-logo-initial')).not.toBeInTheDocument()
  })

  it('logo yoksa grafit zeminde baş harf', () => {
    render(<BusinessLogo name="deniz otel" />)
    const box = screen.getByTestId('business-logo-initial')
    expect(box).toHaveTextContent('D')
    expect(box.style.background).toBe('var(--ah-brand)')
    expect(box.className).toContain('ah-logo')
  })

  it('görsel yüklenemezse baş harfe düşer', () => {
    render(<BusinessLogo name="Mavi Kafe" logoUrl="https://cdn.example.com/kirik.png" />)
    fireEvent.error(screen.getByTestId('business-logo-img'))
    expect(screen.getByTestId('business-logo-initial')).toHaveTextContent('M')
  })

  it('Türkçe büyük harf ve boş isim', () => {
    expect(businessInitial('istanbul kafe')).toBe('İ')
    expect(businessInitial('  ')).toBe('?')
    expect(businessInitial(null)).toBe('?')
  })

  it('boyutlar: sm 40, md 46, lg 96 piksel', () => {
    const { rerender } = render(<BusinessLogo name="A" size="sm" />)
    expect(screen.getByTestId('business-logo-initial').style.width).toBe('40px')
    rerender(<BusinessLogo name="A" />)
    expect(screen.getByTestId('business-logo-initial').style.width).toBe('46px')
    rerender(<BusinessLogo name="A" size="lg" />)
    expect(screen.getByTestId('business-logo-initial').style.width).toBe('96px')
  })

  it('alt verilirse erişilebilir görsel adı olur, verilmezse dekoratif', () => {
    const { rerender } = render(<BusinessLogo name="Deniz Otel" alt="Deniz Otel logosu" />)
    expect(screen.getByRole('img', { name: 'Deniz Otel logosu' })).toBeInTheDocument()
    rerender(<BusinessLogo name="Deniz Otel" />)
    expect(screen.getByTestId('business-logo-initial')).toHaveAttribute('aria-hidden', 'true')
  })
})
