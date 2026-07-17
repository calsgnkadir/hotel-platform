import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MessageComposer, { fmtDuration, QuickReplyChips } from '../MessageComposer'

vi.mock('../../../lib/websocket', () => ({ wsPublish: vi.fn() }))
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

/**
 * FAZ 20 — Composer, MessageThread'den ayrildiktan sonraki sozlesmesi.
 *
 * En kritik davranis: taslak metnin ne zaman temizlendigi. Gonderildi ve
 * kuyruga alindi durumlarinda temizlenir; GERCEK hatada kullanicinin yazdigi
 * metin korunur (yoksa uzun bir mesaj sessizce kaybolur).
 */
const CONV = { id: 7, listingTitle: 'Garson', otherPartyName: 'Ali' }

function setup(overrides = {}) {
  const props = {
    conversation: CONV,
    replyTo: null,
    onClearReply: vi.fn(),
    role: 'CANDIDATE',
    messageCount: 3,
    sending: false,
    sendText: vi.fn().mockResolvedValue('sent'),
    sendFile: vi.fn().mockResolvedValue(true),
    sendCall: vi.fn(),
    onRecordingChange: vi.fn(),
    ...overrides,
  }
  render(<MessageComposer {...props} />)
  return props
}

const input = () => screen.getByPlaceholderText(/Mesaj yaz/i)

describe('MessageComposer (FAZ 20)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gonderilince taslak temizlenir', async () => {
    const p = setup()
    fireEvent.change(input(), { target: { value: 'Merhaba' } })
    fireEvent.click(screen.getByRole('button', { name: /Gönder/i }))

    await waitFor(() => expect(p.sendText).toHaveBeenCalledWith('Merhaba', null))
    await waitFor(() => expect(input().value).toBe(''))
  })

  it('kuyruga alindiysa da taslak temizlenir — mesaj kayip degil', async () => {
    const p = setup({ sendText: vi.fn().mockResolvedValue('queued') })
    fireEvent.change(input(), { target: { value: 'Offline mesaj' } })
    fireEvent.click(screen.getByRole('button', { name: /Gönder/i }))

    await waitFor(() => expect(p.sendText).toHaveBeenCalled())
    await waitFor(() => expect(input().value).toBe(''))
  })

  it('gercek hatada taslak KORUNUR — kullanici yazdigini kaybetmez', async () => {
    const p = setup({ sendText: vi.fn().mockResolvedValue('failed') })
    fireEvent.change(input(), { target: { value: 'Uzun bir mesaj' } })
    fireEvent.click(screen.getByRole('button', { name: /Gönder/i }))

    await waitFor(() => expect(p.sendText).toHaveBeenCalled())
    expect(input().value).toBe('Uzun bir mesaj')
    expect(p.onClearReply).not.toHaveBeenCalled()
  })

  it('bos/whitespace taslak gonderilmez', () => {
    const p = setup()
    fireEvent.change(input(), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /Gönder/i }))
    expect(p.sendText).not.toHaveBeenCalled()
  })

  it('alintili yanit varsa parentId ile gonderilir ve yanit temizlenir', async () => {
    const p = setup({ replyTo: { id: 42, senderName: 'Ali', content: 'Selam' } })
    fireEvent.change(input(), { target: { value: 'Cevap' } })
    fireEvent.click(screen.getByRole('button', { name: /Gönder/i }))

    await waitFor(() => expect(p.sendText).toHaveBeenCalledWith('Cevap', 42))
    await waitFor(() => expect(p.onClearReply).toHaveBeenCalled())
  })

  it('arama butonlari sendCall i tipiyle cagirir', () => {
    const p = setup()
    fireEvent.click(screen.getByTitle(/Sesli arama/i))
    expect(p.sendCall).toHaveBeenCalledWith('audio')
    fireEvent.click(screen.getByTitle(/Görüntülü arama/i))
    expect(p.sendCall).toHaveBeenCalledWith('video')
  })

  it('sending=true iken input disabled ve gonder kilitli', () => {
    setup({ sending: true })
    expect(input()).toBeDisabled()
    expect(screen.getByRole('button', { name: /Gönderiliyor/i })).toBeDisabled()
  })

  it('karakter sayaci 1500 den once gizli, sonra gorunur', () => {
    setup()
    expect(screen.queryByText(/\/ 2000/)).toBeNull()
    fireEvent.change(input(), { target: { value: 'x'.repeat(1500) } })
    expect(screen.getByText('1500 / 2000')).toBeInTheDocument()
  })
})

describe('QuickReplyChips (FAZ 20)', () => {
  it('6 mesajdan sonra gizlenir — uzun sohbette gurultu', () => {
    const { container } = render(
      <QuickReplyChips role="CANDIDATE" onPick={vi.fn()} messageCount={7} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('role a gore farkli set gosterir', () => {
    const { unmount } = render(<QuickReplyChips role="CANDIDATE" onPick={vi.fn()} messageCount={1} />)
    expect(screen.getByText(/Müsaitim, detay verir misiniz/)).toBeInTheDocument()
    unmount()

    render(<QuickReplyChips role="BUSINESS_OWNER" onPick={vi.fn()} messageCount={1} />)
    expect(screen.getByText(/Hafta sonu uygun musun/)).toBeInTheDocument()
  })

  it('cip tiklayinca metin taslaga eklenir (mevcut metnin sonuna)', () => {
    const p = setup({ messageCount: 1 })
    fireEvent.change(input(), { target: { value: 'Merhaba' } })
    fireEvent.click(screen.getByText(/Hangi gün başlıyor/))
    expect(input().value).toBe('Merhaba Hangi gün başlıyor?')
  })
})

describe('fmtDuration', () => {
  it.each([[0, '0:00'], [5, '0:05'], [65, '1:05'], [125, '2:05'], [600, '10:00']])(
    '%i sn -> %s', (input, expected) => expect(fmtDuration(input)).toBe(expected)
  )
})
