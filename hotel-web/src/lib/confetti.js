import confetti from 'canvas-confetti'

/**
 * FAZ 5.11 — Tema renkleriyle confetti burst'leri.
 * canvas-confetti: ~5 kB, GPU-accel.
 */

const PURPLE_PALETTE = ['#d4a853', '#d4a853', '#f7c43c', '#f7c43c', '#234a82', '#fbbf24']

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/** Bir noktada (default ekran ortası) coskulu patlama. */
export function celebrate({ x = 0.5, y = 0.55 } = {}) {
  if (prefersReducedMotion()) return
  confetti({
    particleCount: 90,
    startVelocity: 38,
    spread: 70,
    angle: 90,
    origin: { x, y },
    colors: PURPLE_PALETTE,
    ticks: 180,
    scalar: 0.95,
    gravity: 0.9,
    decay: 0.92,
  })
  // 2. ikinci kucuk dalga 200ms sonra
  setTimeout(() => {
    confetti({
      particleCount: 45,
      startVelocity: 28,
      spread: 100,
      angle: 90,
      origin: { x, y: y + 0.02 },
      colors: PURPLE_PALETTE,
      ticks: 140,
      scalar: 0.75,
    })
  }, 200)
}

/** Sol+sag kenardan yatay patlama (buyuk an). */
export function sideBursts() {
  if (prefersReducedMotion()) return
  const opts = {
    particleCount: 60,
    spread: 55,
    ticks: 220,
    colors: PURPLE_PALETTE,
    gravity: 0.85,
  }
  confetti({ ...opts, angle: 60,  origin: { x: 0, y: 0.7 } })
  confetti({ ...opts, angle: 120, origin: { x: 1, y: 0.7 } })
}
