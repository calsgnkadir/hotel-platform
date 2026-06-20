import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * ExpandableTabs — referans pattern (lucide + shadcn) AjansHotel
 * paletine porte edildi.
 *
 * - lucide-react bagimliligi YOK (inline SVG ikonlar)
 * - usehooks-ts bagimliligi YOK (custom useOnClickOutside)
 * - shadcn cn() yerine native template literal
 * - Tema: altin (#d4a853) active, lacivert glass background
 * - aria-pressed + dis tiklamada deselect
 *
 * Kullanim:
 *   import ExpandableTabs, { tabIcons } from './components/ExpandableTabs'
 *   const tabs = [
 *     { title: 'Ana Sayfa',   icon: tabIcons.home },
 *     { title: 'Bildirimler', icon: tabIcons.bell, badge: 3 },
 *     { type: 'separator' },
 *     { title: 'Ayarlar',     icon: tabIcons.settings },
 *   ]
 *   <ExpandableTabs tabs={tabs} onChange={(idx) => ...} />
 */

const transition = { delay: 0.1, type: 'spring', bounce: 0, duration: 0.6 }

const buttonVariants = {
  initial:  { gap: 0, paddingLeft: '.5rem', paddingRight: '.5rem' },
  animate: (isSelected) => ({
    gap: isSelected ? '.5rem' : 0,
    paddingLeft:  isSelected ? '1rem' : '.5rem',
    paddingRight: isSelected ? '1rem' : '.5rem',
  }),
}

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: 'auto', opacity: 1 },
  exit:    { width: 0, opacity: 0 },
}

function useOnClickOutside(ref, handler) {
  useEffect(() => {
    function onDoc(e) {
      if (!ref.current || ref.current.contains(e.target)) return
      handler(e)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [ref, handler])
}

export default function ExpandableTabs({
  tabs,
  className = '',
  activeColor = '#d4a853',  // altın
  onChange,
  initialIndex = null,
}) {
  const [selected, setSelected] = useState(initialIndex)
  const outsideRef = useRef(null)

  useOnClickOutside(outsideRef, () => {
    setSelected(null)
    onChange?.(null)
  })

  function handleSelect(index) {
    setSelected(index)
    onChange?.(index)
  }

  return (
    <div
      ref={outsideRef}
      role="tablist"
      className={`flex flex-wrap items-center gap-2 rounded-2xl p-1 ${className}`}
      style={{
        background: 'rgba(12, 23, 38, 0.55)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(212, 168, 83, 0.22)',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
      }}>
      {tabs.map((tab, index) => {
        if (tab.type === 'separator') {
          return (
            <div key={`sep-${index}`}
                 aria-hidden="true"
                 style={{
                   width: 1, height: 22, margin: '0 4px',
                   background: 'rgba(212, 168, 83, 0.28)',
                 }} />
          )
        }

        const Icon = tab.icon
        const isActive = selected === index
        return (
          <motion.button
            key={tab.title}
            type="button"
            role="tab"
            aria-selected={isActive}
            variants={buttonVariants}
            initial={false}
            animate="animate"
            custom={isActive}
            onClick={() => handleSelect(index)}
            transition={transition}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.01em',
              border: 'none',
              cursor: 'pointer',
              color: isActive ? activeColor : 'rgba(229, 231, 235, 0.65)',
              background: isActive ? 'rgba(212, 168, 83, 0.12)' : 'transparent',
              transition: 'color 220ms, background 220ms',
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#fde9a5' }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'rgba(229, 231, 235, 0.65)' }}>
            <Icon size={20} active={isActive} />
            {tab.badge > 0 && !isActive && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                background: '#ef6461', color: '#fff',
                fontSize: 9, fontWeight: 700,
                padding: '0 4px', minWidth: 14, height: 14,
                lineHeight: '14px', borderRadius: 999,
                textAlign: 'center',
              }}>
                {tab.badge > 9 ? '9+' : tab.badge}
              </span>
            )}
            <AnimatePresence initial={false}>
              {isActive && (
                <motion.span
                  variants={spanVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={transition}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {tab.title}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        )
      })}
    </div>
  )
}

/* ─────────── Inline SVG ikon set (lucide karsiliklari) ─────────── */
function makeIcon(d) {
  return function Icon({ size = 20 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round"
           aria-hidden="true">
        {d}
      </svg>
    )
  }
}

export const tabIcons = {
  home:     makeIcon(<><path d="M3 12 12 3l9 9" /><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" /></>),
  bell:     makeIcon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  settings: makeIcon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>),
  user:     makeIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  message:  makeIcon(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></>),
  search:   makeIcon(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>),
}
