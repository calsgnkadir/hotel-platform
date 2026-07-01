// FAZ 5.4 — WordPlay benchmark: Framer Motion ile karakter karakter rotate eden text.
// Landing hero'da "Garson / Resepsiyon / Bellboy" gibi donen vurgu icin.
import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './RotatingText.css'

/**
 * RotatingText
 *
 * Props:
 *   texts          — string[] (donecek metinler)
 *   rotationInterval — ms (default 2200)
 *   transition     — framer-motion transition
 *   staggerDuration — character delay
 *   staggerFrom    — 'first' | 'last' | 'center'
 *   splitBy        — 'characters' | 'words'
 *   className      — wrapper class
 *
 * Kullanim:
 *   <RotatingText texts={['Garson','Resepsiyon','Bellboy']} className="text-7xl" />
 */
export default function RotatingText({
  texts,
  rotationInterval = 2200,
  transition = { type: 'spring', damping: 25, stiffness: 300 },
  staggerDuration = 0.03,
  staggerFrom = 'first',
  splitBy = 'characters',
  className = '',
}) {
  const [idx, setIdx] = useState(0)

  // Auto rotate
  useEffect(() => {
    if (!texts || texts.length < 2) return
    const id = setInterval(() => setIdx(i => (i + 1) % texts.length), rotationInterval)
    return () => clearInterval(id)
  }, [texts, rotationInterval])

  const elements = useMemo(() => {
    const current = texts?.[idx] ?? ''
    if (splitBy === 'words') {
      return current.split(' ').map((w, i, arr) => ({
        chars: [w],
        needsSpace: i !== arr.length - 1,
      }))
    }
    // characters (default)
    const words = current.split(' ')
    return words.map((w, i) => ({
      chars: Array.from(w),
      needsSpace: i !== words.length - 1,
    }))
  }, [texts, idx, splitBy])

  const totalChars = elements.reduce((sum, w) => sum + w.chars.length, 0)

  const getDelay = useCallback((i) => {
    if (staggerFrom === 'last') return (totalChars - 1 - i) * staggerDuration
    if (staggerFrom === 'center') {
      const c = Math.floor(totalChars / 2)
      return Math.abs(c - i) * staggerDuration
    }
    return i * staggerDuration  // first
  }, [staggerDuration, staggerFrom, totalChars])

  if (!texts || texts.length === 0) return null

  return (
    <span className={`rotating-text ${className}`}>
      {/* SR-only — assistive technology icin gercek metin */}
      <span className="sr-only">{texts[idx]}</span>

      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={idx} className="rotating-text-inner" aria-hidden="true">
          {elements.map((wordObj, wi, arr) => {
            const prevCount = arr.slice(0, wi).reduce((s, w) => s + w.chars.length, 0)
            return (
              <span key={wi} className="rotating-text-word">
                {wordObj.chars.map((ch, ci) => (
                  <motion.span
                    key={ci}
                    className="rotating-text-element"
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '-120%', opacity: 0 }}
                    transition={{ ...transition, delay: getDelay(prevCount + ci) }}
                  >
                    {ch}
                  </motion.span>
                ))}
                {wordObj.needsSpace && <span>&nbsp;</span>}
              </span>
            )
          })}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
