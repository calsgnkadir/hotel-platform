import { useEffect, useId, useState } from 'react'
import { motion, useAnimation, useReducedMotion } from 'framer-motion'

/**
 * SparklesBackground — global arka plan parıltıları (kar/yıldız efekti).
 *
 * Pragmatik kararlar:
 *  - Lazy load: ilk render'da bundle yüklemesin, mount sonrası dynamic import
 *    (ayrı 'particles' chunk — vite.config manualChunks)
 *  - prefers-reduced-motion → render etmez (a11y zorunlu)
 *  - position: fixed inset-0 + zIndex 0 + pointer-events:none → sayfa
 *    içeriğiyle çakışmaz
 *  - Palet altın (#d4a853) — Hospitality Night temasıyla uyum
 *  - density 70 default (daha yüksek mobil pil tüketir)
 *  - opacity 0 → fade-in (motion controls.start)
 */
export default function SparklesBackground({
  className = '',
  background = 'transparent',
  particleColor = '#d4a853',
  minSize = 0.6,
  maxSize = 1.8,
  particleDensity = 70,
  speed = 1.4,
}) {
  const reduced = useReducedMotion()
  const [Particles, setParticlesComp] = useState(null)
  const [initEngine, setInitEngine] = useState(null)
  const [loadSlim, setLoadSlim] = useState(null)
  const [ready, setReady] = useState(false)
  const controls = useAnimation()
  const id = useId()

  useEffect(() => {
    if (reduced) return
    let cancelled = false
    Promise.all([
      import('@tsparticles/react'),
      import('@tsparticles/slim'),
    ]).then(([reactMod, slimMod]) => {
      if (cancelled) return
      setParticlesComp(() => reactMod.default)
      setInitEngine(() => reactMod.initParticlesEngine)
      setLoadSlim(() => slimMod.loadSlim)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [reduced])

  useEffect(() => {
    if (!initEngine || !loadSlim || ready) return
    initEngine(async (engine) => { await loadSlim(engine) })
      .then(() => setReady(true))
      .catch(() => {})
  }, [initEngine, loadSlim, ready])

  async function onLoaded(container) {
    if (container) {
      controls.start({ opacity: 1, transition: { duration: 1.2 } })
    }
  }

  if (reduced || !ready || !Particles) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={controls}
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}>
      <Particles
        id={`sparkles-${id}`}
        className="h-full w-full"
        particlesLoaded={onLoaded}
        options={{
          background: { color: { value: background } },
          fullScreen: { enable: false, zIndex: 0 },
          fpsLimit: 60,
          interactivity: {
            events: {
              onClick: { enable: false },
              onHover: { enable: false },
              resize: true,
            },
          },
          particles: {
            color: { value: particleColor },
            move: {
              angle: { offset: 0, value: 90 },
              direction: 'none',
              enable: true,
              outModes: { default: 'out' },
              random: false,
              speed: { min: 0.1, max: 1 },
              straight: false,
            },
            number: {
              density: { enable: true, width: 400, height: 400 },
              value: particleDensity,
            },
            opacity: {
              value: { min: 0.1, max: 1 },
              animation: {
                enable: true,
                speed: speed,
                sync: false,
                startValue: 'random',
              },
            },
            shape: { type: 'circle' },
            size: {
              value: { min: minSize, max: maxSize },
            },
          },
          detectRetina: true,
        }}
      />
    </motion.div>
  )
}
