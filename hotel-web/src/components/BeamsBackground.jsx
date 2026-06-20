import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * BeamsBackground — yatay-eğik altın ışın huzmeleri (canvas + blur).
 *
 * Kullanıcı referans snippet'i (mavi-yeşil hue 190-260) altın
 * paletine porte edildi (hue 35-55 = warm gold spektrumu).
 *
 * Global mount: App.jsx ROOT'unda fixed inset-0, pointer-events:none,
 * z-index 0 — tüm sayfaların ARKA katmanı. Üst katmanlarda
 * SparklesBackground (z-40 altın yıldız tozu) ve sayfa içeriği var.
 *
 * Performans: requestAnimationFrame, devicePixelRatio honor, 30 beam.
 */
function createBeam(width, height) {
  const angle = -35 + Math.random() * 10
  return {
    x: Math.random() * width * 1.5 - width * 0.25,
    y: Math.random() * height * 1.5 - height * 0.25,
    width: 30 + Math.random() * 60,
    length: height * 2.5,
    angle: angle,
    speed: 0.6 + Math.random() * 1.2,
    opacity: 0.12 + Math.random() * 0.16,
    hue: 35 + Math.random() * 20,                    // altın range (35-55)
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
  }
}

export default function BeamsBackground({
  className = '',
  intensity = 'subtle',                              // subtle: kullanıcı abartı sevmiyor
}) {
  const canvasRef = useRef(null)
  const beamsRef = useRef([])
  const rafRef = useRef(0)
  const MINIMUM_BEAMS = 20

  const opacityMap = { subtle: 0.7, medium: 0.85, strong: 1 }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function updateCanvasSize() {
      const dpr = window.devicePixelRatio || 1
      canvas.width  = window.innerWidth  * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width  = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
      const totalBeams = MINIMUM_BEAMS * 1.5
      beamsRef.current = Array.from({ length: totalBeams },
        () => createBeam(canvas.width, canvas.height))
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)

    function resetBeam(beam, index, totalBeams) {
      const column = index % 3
      const spacing = canvas.width / 3
      beam.y = canvas.height + 100
      beam.x = column * spacing + spacing / 2
             + (Math.random() - 0.5) * spacing * 0.5
      beam.width   = 100 + Math.random() * 100
      beam.speed   = 0.5 + Math.random() * 0.4
      beam.hue     = 35 + (index * 20) / totalBeams   // altın band
      beam.opacity = 0.2 + Math.random() * 0.1
      return beam
    }

    function drawBeam(ctx, beam) {
      ctx.save()
      ctx.translate(beam.x, beam.y)
      ctx.rotate((beam.angle * Math.PI) / 180)
      const pulsingOpacity = beam.opacity
        * (0.8 + Math.sin(beam.pulse) * 0.2)
        * opacityMap[intensity]
      const g = ctx.createLinearGradient(0, 0, 0, beam.length)
      g.addColorStop(0,   `hsla(${beam.hue}, 85%, 65%, 0)`)
      g.addColorStop(0.1, `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity * 0.5})`)
      g.addColorStop(0.4, `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity})`)
      g.addColorStop(0.6, `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity})`)
      g.addColorStop(0.9, `hsla(${beam.hue}, 85%, 65%, ${pulsingOpacity * 0.5})`)
      g.addColorStop(1,   `hsla(${beam.hue}, 85%, 65%, 0)`)
      ctx.fillStyle = g
      ctx.fillRect(-beam.width / 2, 0, beam.width, beam.length)
      ctx.restore()
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.filter = 'blur(35px)'
      const total = beamsRef.current.length
      beamsRef.current.forEach((beam, i) => {
        beam.y -= beam.speed
        beam.pulse += beam.pulseSpeed
        if (beam.y + beam.length < -100) resetBeam(beam, i, total)
        drawBeam(ctx, beam)
      })
      rafRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => {
      window.removeEventListener('resize', updateCanvasSize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [intensity])

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 0,                                   // en alt katman
        pointerEvents: 'none',
        overflow: 'hidden',
        background: '#0a0a0a',                       // neutral-950 ana zemin
      }}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute', inset: 0,
          filter: 'blur(15px)',
        }}
      />
      <motion.div
        animate={{ opacity: [0.05, 0.15, 0.05] }}
        transition={{ duration: 10, ease: 'easeInOut', repeat: Infinity }}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(10, 10, 10, 0.05)',
          backdropFilter: 'blur(50px)',
          WebkitBackdropFilter: 'blur(50px)',
        }}
      />
    </div>
  )
}
