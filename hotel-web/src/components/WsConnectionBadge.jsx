import { useEffect, useState } from 'react'
import { wsOnStatusChange, wsForceReconnect } from '../lib/websocket'

/**
 * FAZ D.10 — WebSocket bağlantı durumu badge'i.
 * Sadece offline/reconnecting durumunda görünür.
 * Tıklayınca manuel reconnect tetikler.
 */
export default function WsConnectionBadge() {
  const [state, setState] = useState('idle')
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    return wsOnStatusChange((isConnected, st) => {
      setConnected(isConnected)
      setState(st)
    })
  }, [])

  // Bağlıyken hiç gösterme — sessiz UI
  if (connected || state === 'idle' || state === 'connecting') return null

  const isReconnecting = state === 'reconnecting'
  const label = isReconnecting ? 'Yeniden bağlanıyor…' : 'Bağlantı kesildi'
  const color = isReconnecting ? '#d97706' : '#b91c1c'
  const bg = isReconnecting ? 'rgba(217, 119, 6, 0.10)' : 'rgba(185, 28, 28, 0.10)'

  return (
    <button
      type="button"
      title="Tıkla: yeniden bağlan"
      onClick={() => wsForceReconnect()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        border: `1px solid ${color}33`,
        color,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        animation: isReconnecting ? 'ws-pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      {label}
      <style>{`
        @keyframes ws-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </button>
  )
}
