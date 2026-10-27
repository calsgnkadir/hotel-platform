import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const transport = vi.hoisted(() => ({ clients: [] }))

vi.mock('@stomp/stompjs', () => ({
  Client: class {
    constructor(options) {
      this.options = options
      this.connected = false
      this.active = false
      this.frames = []
      this.subscribe = vi.fn((destination, callback) => {
        const frame = { destination, callback, unsubscribe: vi.fn() }
        this.frames.push(frame)
        return frame
      })
      this.activate = vi.fn(() => { this.active = true })
      this.deactivate = vi.fn(async () => { this.active = false; this.connected = false })
      transport.clients.push(this)
    }
  },
}))
vi.mock('sockjs-client', () => ({ default: class {} }))

let ws
function connect(client = transport.clients.at(-1)) {
  client.connected = true
  client.options.onConnect()
  return client
}
function drop(client) {
  client.connected = false
  client.options.onWebSocketClose()
}
function receive(frame, payload) { frame.callback({ body: JSON.stringify(payload) }) }
async function flushDeactivation() {
  // The replacement connection starts after deactivate().catch().finally().
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(async () => {
  vi.resetModules()
  transport.clients.length = 0
  localStorage.clear()
  localStorage.setItem('token', 'account-A-token')
  ws = await import('../websocket')
})

afterEach(() => {
  ws.wsDisconnect()
  vi.restoreAllMocks()
})

describe('WebSocket subscription lifetime', () => {
  it('queues before connect and restores active listeners on each automatic reconnect', () => {
    const listener = vi.fn()
    ws.wsSubscribe('/user/queue/messages', listener)
    ws.wsConnect()
    const client = connect()
    const original = client.frames.at(-1)
    receive(original, { id: 1 })
    drop(client)
    receive(original, { id: 'offline-stale' })
    connect(client)
    const restored = client.frames.at(-1)
    receive(original, { id: 'old-session' })
    receive(restored, { id: 2 })
    drop(client)
    connect(client)
    receive(restored, { id: 'second-old-session' })
    receive(client.frames.at(-1), { id: 3 })
    expect(listener.mock.calls.map(([payload]) => payload.id)).toEqual([1, 2, 3])
    expect(client.subscribe).toHaveBeenCalledTimes(3)
  })

  it('restores listeners registered after the first connection', () => {
    ws.wsConnect()
    const client = connect()
    const listener = vi.fn()
    ws.wsSubscribe('/user/queue/notifications', listener)
    expect(client.subscribe).toHaveBeenCalledTimes(1)
    drop(client)
    connect(client)
    receive(client.frames.at(-1), { id: 2 })
    expect(listener).toHaveBeenCalledExactlyOnceWith({ id: 2 })
    expect(client.subscribe).toHaveBeenCalledTimes(2)
  })

  it('does not restore consumers that unsubscribe while offline', () => {
    ws.wsConnect()
    const client = connect()
    const removed = vi.fn()
    const active = vi.fn()
    const subscription = ws.wsSubscribe('/user/queue/messages', removed)
    ws.wsSubscribe('/user/queue/notifications', active)
    const removedFrame = client.frames[0]
    drop(client)
    subscription.unsubscribe()
    subscription.unsubscribe()
    connect(client)
    receive(removedFrame, { id: 1 })
    receive(client.frames.at(-1), { id: 2 })
    expect(removed).not.toHaveBeenCalled()
    expect(active).toHaveBeenCalledExactlyOnceWith({ id: 2 })
    expect(client.subscribe).toHaveBeenCalledTimes(3)
    expect(removedFrame.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('does not subscribe consumers canceled before their first connection', () => {
    const subscription = ws.wsSubscribe('/user/queue/messages', vi.fn())
    subscription.unsubscribe()
    ws.wsConnect()
    expect(connect().subscribe).not.toHaveBeenCalled()
  })

  it('preserves mounted listeners through manual reconnect and notifies fallback state', async () => {
    ws.wsConnect()
    const first = connect()
    const listener = vi.fn()
    ws.wsSubscribe('/user/queue/messages', listener)
    const stale = first.frames[0]
    const status = vi.fn()
    ws.wsOnStatusChange(status)
    ws.wsForceReconnect()
    expect(status).toHaveBeenLastCalledWith(false, 'idle')
    await flushDeactivation()
    expect(transport.clients).toHaveLength(2)
    const second = connect()
    receive(stale, { id: 'old-connection' })
    receive(second.frames[0], { id: 2 })
    expect(listener).toHaveBeenCalledExactlyOnceWith({ id: 2 })
    expect(second.subscribe).toHaveBeenCalledTimes(1)
  })

  it('retires both active and queued callbacks at logout before a new account connects', () => {
    ws.wsConnect()
    const first = connect()
    const retired = vi.fn()
    ws.wsSubscribe('/user/queue/messages', retired)
    const stale = first.frames[0]
    drop(first)
    ws.wsSubscribe('/user/queue/notifications', retired)
    ws.wsDisconnect()
    localStorage.setItem('token', 'account-B-token')
    const current = vi.fn()
    ws.wsSubscribe('/user/queue/messages', current)
    ws.wsConnect()
    const second = connect()
    // Late onConnect from the old account must not attach its old listeners.
    first.options.onConnect()
    receive(stale, { id: 'account-A-message' })
    receive(second.frames[0], { id: 'account-B-message' })
    expect(retired).not.toHaveBeenCalled()
    expect(current).toHaveBeenCalledExactlyOnceWith({ id: 'account-B-message' })
    expect(second.subscribe).toHaveBeenCalledTimes(1)
    expect(second.options.connectHeaders.Authorization).toBe('Bearer account-B-token')
  })

  it('does not resurrect a pending manual reconnect after logout', async () => {
    ws.wsConnect()
    connect()
    const listener = vi.fn()
    ws.wsSubscribe('/user/queue/messages', listener)
    ws.wsForceReconnect()
    ws.wsDisconnect()
    localStorage.removeItem('token')
    await flushDeactivation()
    expect(transport.clients).toHaveLength(1)
    expect(ws.wsGetState()).toBe('idle')
  })

  it('does not invoke a consumer twice if its callback throws', () => {
    ws.wsConnect()
    const client = connect()
    const listener = vi.fn(() => { throw new Error('Consumer failed') })
    ws.wsSubscribe('/user/queue/messages', listener)
    expect(() => receive(client.frames[0], { id: 1 })).toThrow('Consumer failed')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
