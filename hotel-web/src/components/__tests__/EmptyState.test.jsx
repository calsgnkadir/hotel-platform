import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import EmptyState from '../EmptyState'

describe('EmptyState (FAZ 0/#4d smoke)', () => {
  it('basic render: title + description', () => {
    render(<EmptyState type="applications" title="Yok" description="Bos durum" />)
    expect(screen.getByText('Yok')).toBeInTheDocument()
    expect(screen.getByText('Bos durum')).toBeInTheDocument()
  })

  it('steps prop varken numarali liste cizilir (FAZ 5.7)', () => {
    render(
      <EmptyState
        type="applications"
        title="3 adim"
        steps={[
          { label: 'Birinci adim', hint: 'Ipucu A' },
          { label: 'Ikinci adim' },
          { label: 'Ucuncu adim' },
        ]}
      />
    )
    expect(screen.getByText('Birinci adim')).toBeInTheDocument()
    expect(screen.getByText('Ipucu A')).toBeInTheDocument()
    expect(screen.getByText('Ikinci adim')).toBeInTheDocument()
    // Numaralandirma: 01, 02, 03
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
    expect(screen.getByText('03')).toBeInTheDocument()
  })

  it('ctaLabel + onCta tiklayinca callback', () => {
    const onCta = vi.fn()
    render(
      <EmptyState
        type="applications"
        title="Bos"
        ctaLabel="Devam Et"
        onCta={onCta}
      />
    )
    const btn = screen.getByRole('button', { name: 'Devam Et' })
    fireEvent.click(btn)
    expect(onCta).toHaveBeenCalledOnce()
  })

  it('steps yoksa step listesi yok', () => {
    render(<EmptyState type="generic" title="Test" />)
    expect(screen.queryByText('01')).not.toBeInTheDocument()
  })
})
