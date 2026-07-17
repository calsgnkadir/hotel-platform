import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import useMessageSend from '../useMessageSend'
import * as hotelApi from '../../../api/hotel'
import { keys } from '../../../lib/queryClient'

vi.mock('../../../api/hotel', () => ({
  sendMessage: vi.fn(),
  sendMessageAttachment: vi.fn(),
}))
vi.mock('../../../api/client', () => ({ extractErrorMessage: (e) => e?.message || 'hata' }))
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}))

// WS bagli varsayilir; testler gerektiginde override eder
let wsConnected = true
vi.mock('../../../lib/useWsConnected', () => ({ default: () => wsConnected }))

/**
 * FAZ 20 — Gonderim motoru.
 *
 * Kritik sozlesme: AG HATASINDA mesaj kaybolmaz, sessionStorage kuyruguna
 * yazilir ve baglanti gelince otomatik gonderilir. Sunucu hatasi (400/500)
 * ise kuyruga ALINMAZ — tekrar denemek ayni hatayi verir.
 */
const CONV = { id: 7 }
const QUEUE_KEY = 'ajanshotel.offline-queue.7'

function setup({ conversation = CONV, onSent = vi.fn(), onMessageSent = vi.fn() } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  const hook = renderHook(
    () => useMessageSend({ conversation, onSent, onMessageSent }), { wrapper }
  )
  return { ...hook, qc, onSent, onMessageSent }
}

const readQueue = () => JSON.parse(sessionStorage.getItem(QUEUE_KEY) || '[]')
const networkError = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
const serverError = () => Object.assign(new Error('Yasakli icerik'), { response: { status: 400 } })

describe('useMessageSend (FAZ 20)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    wsConnected = true
  })

  it('basarili gonderimde "sent" doner, cache e eklenir, callback ler tetiklenir', async () => {
    const msg = { id: 101, content: 'Merhaba' }
    hotelApi.sendMessage.mockResolvedValue(msg)
    const { result, qc, onSent, onMessageSent } = setup()

    let out
    await act(async () => { out = await result.current.sendText('Merhaba', null) })

    expect(out).toBe('sent')
    expect(onSent).toHaveBeenCalledWith(msg)
    expect(onMessageSent).toHaveBeenCalled()
    // Optimistic cache: yeni mesaj basa eklenmis olmali
    expect(qc.getQueryData(keys.conversations.messages(7))).toEqual({ content: [msg] })
    expect(readQueue()).toEqual([])
  })

  it('AG hatasinda "queued" doner ve mesaj kuyruga yazilir — kaybolmaz', async () => {
    hotelApi.sendMessage.mockRejectedValue(networkError())
    const { result, onMessageSent } = setup()

    let out
    await act(async () => { out = await result.current.sendText('Offline mesaj', 42) })

    expect(out).toBe('queued')
    expect(readQueue()).toEqual([
      expect.objectContaining({ content: 'Offline mesaj', parentMessageId: 42 }),
    ])
    // Kuyruktaki mesaj icin sohbet listesi tazelenmez — henuz gitmedi
    expect(onMessageSent).not.toHaveBeenCalled()
  })

  it('SUNUCU hatasinda "failed" doner ve kuyruga ALINMAZ — retry ayni hatayi verir', async () => {
    hotelApi.sendMessage.mockRejectedValue(serverError())
    const { result } = setup()

    let out
    await act(async () => { out = await result.current.sendText('Yasakli', null) })

    expect(out).toBe('failed')
    expect(readQueue()).toEqual([])
  })

  it('baglanti gelince kuyruk otomatik bosaltilir ve temizlenir', async () => {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify([
      { content: 'birinci', parentMessageId: null, at: 1 },
      { content: 'ikinci', parentMessageId: null, at: 2 },
    ]))
    hotelApi.sendMessage
      .mockResolvedValueOnce({ id: 1, content: 'birinci' })
      .mockResolvedValueOnce({ id: 2, content: 'ikinci' })

    const { onSent, onMessageSent } = setup()

    await waitFor(() => expect(hotelApi.sendMessage).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onMessageSent).toHaveBeenCalled())
    expect(onSent).toHaveBeenCalledTimes(2)
    expect(readQueue()).toEqual([])
  })

  it('drain sirasinda tekrar koparsa gonderilemeyen mesaj kuyrukta kalir', async () => {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify([
      { content: 'gider', parentMessageId: null, at: 1 },
      { content: 'kalir', parentMessageId: null, at: 2 },
    ]))
    hotelApi.sendMessage
      .mockResolvedValueOnce({ id: 1, content: 'gider' })
      .mockRejectedValueOnce(networkError())

    setup()

    await waitFor(() => expect(readQueue()).toEqual([
      expect.objectContaining({ content: 'kalir' }),
    ]))
  })

  it('WS kopukken kuyruk bosaltilmaz', async () => {
    wsConnected = false
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify([{ content: 'bekle', at: 1 }]))
    setup()

    await new Promise(r => setTimeout(r, 30))
    expect(hotelApi.sendMessage).not.toHaveBeenCalled()
    expect(readQueue()).toHaveLength(1)
  })

  it('15 MB ustu dosya gonderilmez', async () => {
    const { result } = setup()
    const big = new File(['x'], 'buyuk.pdf')
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })

    let out
    await act(async () => { out = await result.current.sendFile(big) })

    expect(out).toBe(false)
    expect(hotelApi.sendMessageAttachment).not.toHaveBeenCalled()
  })

  it('coklu dosyada buyuk olan atlanir, digerleri gonderilir', async () => {
    hotelApi.sendMessageAttachment.mockResolvedValue({ id: 5 })
    const { result, onMessageSent } = setup()

    const ok = new File(['x'], 'ok.pdf')
    const big = new File(['x'], 'buyuk.pdf')
    Object.defineProperty(big, 'size', { value: 16 * 1024 * 1024 })

    await act(async () => { await result.current.sendFiles([ok, big]) })

    expect(hotelApi.sendMessageAttachment).toHaveBeenCalledTimes(1)
    expect(hotelApi.sendMessageAttachment).toHaveBeenCalledWith(7, ok, '')
    // Coklu gonderimde sohbet listesi TEK kez tazelenir
    expect(onMessageSent).toHaveBeenCalledTimes(1)
  })

  it('arama daveti [CALL:type] formatinda gonderilir', async () => {
    hotelApi.sendMessage.mockResolvedValue({ id: 9 })
    window.open = vi.fn()
    const { result } = setup()

    await act(async () => { await result.current.sendCall('audio') })

    const [, content] = hotelApi.sendMessage.mock.calls[0]
    expect(content).toMatch(/^\[CALL:audio\]https:\/\/meet\.jit\.si\/ajanshotel-7-/)
    expect(content).toContain('startWithVideoMuted=true')
    expect(window.open).toHaveBeenCalled()
  })

  it('goruntulu aramada video muted YOK', async () => {
    hotelApi.sendMessage.mockResolvedValue({ id: 9 })
    window.open = vi.fn()
    const { result } = setup()

    await act(async () => { await result.current.sendCall('video') })

    const [, content] = hotelApi.sendMessage.mock.calls[0]
    expect(content).toMatch(/^\[CALL:video\]/)
    expect(content).not.toContain('startWithVideoMuted')
  })
})
