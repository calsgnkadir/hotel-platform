/**
 * FAZ 6 — ConfirmDialog dumb component test.
 *
 * ConfirmDialog kendisi state'siz — open/onClose/onConfirm/title/description/
 * confirmLabel/destructive props'lariyla surulur. Icin nasil surulecegi test edilir
 * (useConfirm.test.jsx integration'a benzer, ama burada saf render + click davranisi).
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConfirmDialog } from '../ui/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('open=false iken hicbir sey render etmez', () => {
    const { container } = render(
      <ConfirmDialog open={false} title="X" description="Y" onConfirm={() => {}} onClose={() => {}} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('open=true iken title + description gorunur', () => {
    render(
      <ConfirmDialog open title="Sil" description="Bu islem geri alinamaz" onConfirm={() => {}} onClose={() => {}} />
    )
    expect(screen.getByText('Sil')).toBeInTheDocument()
    expect(screen.getByText('Bu islem geri alinamaz')).toBeInTheDocument()
  })

  it('Onayla butonu onConfirm cagirir', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog open title="X" confirmLabel="Evet" onConfirm={onConfirm} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Evet'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('Vazgec butonu onClose cagirir', () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog open title="X" cancelLabel="Vazgec" onConfirm={onConfirm} onClose={onClose} />
    )
    fireEvent.click(screen.getByText('Vazgec'))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Backdrop click onClose cagirir', () => {
    const onClose = vi.fn()
    render(
      <ConfirmDialog open title="X" onConfirm={() => {}} onClose={onClose} />
    )
    // Backdrop = disardaki dialog wrapper — role="dialog"
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape tusu onClose cagirir', () => {
    const onClose = vi.fn()
    render(
      <ConfirmDialog open title="X" onConfirm={() => {}} onClose={onClose} />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('loading=true iken butonlar disabled ve label İşleniyor…', () => {
    render(
      <ConfirmDialog open loading title="X" confirmLabel="Evet" onConfirm={() => {}} onClose={() => {}} />
    )
    expect(screen.getByText('İşleniyor…')).toBeInTheDocument()
    // Confirm button (Isleniyor... text'i tasir) disabled
    const btn = screen.getByText('İşleniyor…').closest('button')
    expect(btn).toBeDisabled()
  })

  it('loading=true iken Escape kapatmaz', () => {
    const onClose = vi.fn()
    render(
      <ConfirmDialog open loading title="X" onConfirm={() => {}} onClose={onClose} />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('destructive icon (uyari ucgeni) sadece destructive=true iken cizilir', () => {
    const { rerender, container } = render(
      <ConfirmDialog open title="X" onConfirm={() => {}} onClose={() => {}} />
    )
    // Non-destructive: uyari SVG yok (aria-hidden triangle)
    let triangle = container.querySelector('svg path[d^="M10.29"]')
    expect(triangle).toBeNull()

    rerender(
      <ConfirmDialog open destructive title="X" onConfirm={() => {}} onClose={() => {}} />
    )
    triangle = container.querySelector('svg path[d^="M10.29"]')
    expect(triangle).not.toBeNull()
  })

  it('destructive true -> title rengi brick (#d39481)', () => {
    render(
      <ConfirmDialog open destructive title="Sil" onConfirm={() => {}} onClose={() => {}} />
    )
    const h2 = screen.getByText('Sil')
    // Style attr'ında brick color'ı gecmeli
    const style = h2.getAttribute('style')
    // Browser hex -> rgb normalize eder
    expect(style).toContain('rgb(211, 148, 129)')   // #d39481
  })

  it('destructive false -> title rengi champagne (#cdb78f)', () => {
    render(
      <ConfirmDialog open title="Onay" onConfirm={() => {}} onClose={() => {}} />
    )
    const h2 = screen.getByText('Onay')
    const style = h2.getAttribute('style')
    expect(style).toContain('rgb(205, 183, 143)')   // #cdb78f
  })
})
