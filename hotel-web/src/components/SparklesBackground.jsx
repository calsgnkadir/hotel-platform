import { useId } from 'react'
import { motion } from 'framer-motion'
import Particles, { useParticlesProvider } from '@tsparticles/react'

/**
 * SparklesBackground — global arka plan parıltıları.
 *
 * @tsparticles v4 API'si: ParticlesProvider App root'unda wrap eder ve
 * engine'i init eder. Burada sadece `useParticlesProvider().loaded`
 * kontrol edip `<Particles>` render ederiz.
 */
export default function SparklesBackground({
  className = '',
  background = 'transparent',
  particleColor = '#fbd768',
  minSize = 0.4,
  maxSize = 1.2,
  particleDensity = 25,
  speed = 1.0,
}) {
  const { loaded } = useParticlesProvider()
  const id = useId()

  if (!loaded) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2 }}
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
      }}>
      <Particles
        id={`sparkles-${id}`}
        className="h-full w-full"
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
              value: { min: 0.15, max: 0.55 },
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
