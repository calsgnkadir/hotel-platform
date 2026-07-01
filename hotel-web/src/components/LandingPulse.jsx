import { useEffect, useState, useRef } from 'react'
import api from '../api/client'
import { wsConnect, wsSubscribe } from '../lib/websocket'

/**
 * FAZ G.8 — Landing "Vardiya Nabzı" canlı widget.
 *
 * Manifestodaki en güçlü özgün fikir: rakip iş ilanı siteleri sahte canlı
 * hissi simüle eder; bizim WebSocket altyapımızla bu OTANTİK.
 *
 * Akış:
 *  1. İlk yüklemede GET /api/public/pulse (initial state, herkese açık)
 *  2. Token varsa WS connect + /topic/pulse subscribe (her 30sn server push)
 *  3. Token yoksa 30sn poll fallback
 *
 * UX:
 *  - 4 stat: aktif ilan / açık vardiya / son 1sa başvuru / online
 *  - CountUp animasyon (sayı değişince ease-out)
 *  - Üstte sticky nabız çizgisi (SVG sine wave, sürekli akar)
 *  - Glassmorphism altın border
 */
export default function LandingPulse() {
  const [pulse, setPulse] = useState(null)

  // İlk fetch + fallback poll
  useEffect(() => {
    let cancelled = false
    let pollTimer = null

    async function fetchOnce() {
      try {
        const { data } = await api.get('/api/public/pulse')
        if (!cancelled) setPulse(data)
      } catch {}
    }

    fetchOnce()

    // Eğer token varsa WS deneyelim; yoksa 30sn poll
    const hasToken = !!localStorage.getItem('token')
    let unsub
    if (hasToken) {
      wsConnect()
      unsub = wsSubscribe('/topic/pulse', (data) => {
        if (!cancelled) setPulse(data)
      })
    } else {
      pollTimer = setInterval(fetchOnce, 30_000)
    }

    return () => {
      cancelled = true
      if (unsub) unsub.unsubscribe?.()
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [])

  const stats = [
    { key: 'activeListings',       label: 'Aktif İlan',      value: pulse?.activeListings },
    { key: 'openShifts',           label: 'Açık Vardiya',    value: pulse?.openShifts },
    { key: 'applicationsLastHour', label: 'Son 1sa Başvuru', value: pulse?.applicationsLastHour },
    { key: 'onlineUsers',          label: 'Şu An Aktif',     value: pulse?.onlineUsers },
  ]

  return (
    <div style={{
      position: 'relative',
      borderRadius: 18,
      padding: '20px 22px 18px',
      background: 'rgba(12, 23, 38, 0.55)',
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
      border: '1px solid rgba(212, 168, 83, 0.28)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(205, 183, 143, 0.08) inset',
      overflow: 'hidden',
      minWidth: 320,
    }}>
      <PulseWave />

      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
        }}>
          <PulseDot active={pulse != null} />
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
            textTransform: 'uppercase', color: '#cdb78f',
          }}>
            Vardiya Nabzı · Canlı
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
        }}>
          {stats.map(s => (
            <Stat key={s.key} label={s.label} value={s.value} />
          ))}
        </div>

        {pulse?.generatedAt && (
          <div style={{
            marginTop: 12, paddingTop: 10,
            borderTop: '1px solid rgba(205, 183, 143, 0.10)',
            fontSize: 10, color: '#6b6358',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>Son güncelleme</span>
            <span>{new Date(pulse.generatedAt).toLocaleTimeString('tr-TR', {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            })}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Tek stat (CountUp + altın vurgu) ───────────────────────────── */
function Stat({ label, value }) {
  const display = useCountUp(value ?? 0, 700)
  const loading = value == null
  return (
    <div>
      <div style={{
        fontSize: 32, lineHeight: 1, fontWeight: 700,
        color: loading ? 'rgba(229, 231, 235, 0.25)' : '#fdfbf7',
        letterSpacing: '-0.025em',
        fontVariantNumeric: 'tabular-nums',
        textShadow: loading ? 'none' : '0 0 18px rgba(205, 183, 143, 0.28)',
        transition: 'color 300ms',
      }}>
        {loading ? '—' : display.toLocaleString('tr-TR')}
      </div>
      <div style={{
        marginTop: 4, fontSize: 11, color: 'rgba(254, 247, 215, 0.65)',
        letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  )
}

/* ── Sayı geçişi (requestAnimationFrame ease-out) ────────────────── */
function useCountUp(target, duration = 700) {
  const [v, setV] = useState(target)
  const startRef = useRef(target)
  useEffect(() => {
    const from = startRef.current
    const to = target
    if (from === to) return
    let raf
    const t0 = performance.now()
    function step(now) {
      const p = Math.min(1, (now - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const cur = Math.round(from + (to - from) * eased)
      setV(cur)
      if (p < 1) raf = requestAnimationFrame(step)
      else startRef.current = to
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return v
}

/* ── Canlı nokta (yeşil sinyal, soluk pulse) ────────────────────── */
function PulseDot({ active }) {
  return (
    <span style={{
      position: 'relative',
      display: 'inline-flex', width: 8, height: 8,
    }}>
      <span style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: active ? 'var(--signal-green, #3ddc97)' : '#64748b',
        opacity: 0.6,
        animation: active ? 'pulse-grow 1.8s ease-out infinite' : 'none',
      }} />
      <span style={{
        position: 'relative', width: 8, height: 8, borderRadius: '50%',
        background: active ? 'var(--signal-green, #3ddc97)' : '#64748b',
        boxShadow: active ? '0 0 8px var(--signal-green, #3ddc97)' : 'none',
      }} />
      <style>{`
        @keyframes pulse-grow {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(3);   opacity: 0;   }
        }
      `}</style>
    </span>
  )
}

/* ── Üstte akan sine wave (nabız çizgisi) ─────────────────────────── */
function PulseWave() {
  return (
    <div aria-hidden style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 38,
      pointerEvents: 'none', overflow: 'hidden', opacity: 0.6,
    }}>
      <svg width="200%" height="100%" viewBox="0 0 800 40" preserveAspectRatio="none"
           style={{
             animation: 'wave-shift 6s linear infinite',
             display: 'block',
           }}>
        <defs>
          <linearGradient id="pulse-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="#d4a853" stopOpacity="0" />
            <stop offset="50%"  stopColor="#cdb78f" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#d4a853" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 20 Q 40 4 80 20 T 160 20 T 240 20 T 320 20 T 400 20 T 480 20 T 560 20 T 640 20 T 720 20 T 800 20"
          stroke="url(#pulse-grad)" strokeWidth="1.6" fill="none"
        />
      </svg>
      <style>{`
        @keyframes wave-shift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
