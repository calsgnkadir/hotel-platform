/**
 * FAZ 20 — "Sohbet secin" bos durum ekrani.
 *
 * MessageThread'den birebir cikarildi: saf sunum, hicbir state/efekt yok.
 * Thread'in isi mesaj akisi; bu 70 satirlik illustrasyon orada durmasi icin
 * bir sebep yoktu.
 */
import { motion } from 'framer-motion'

const PARTICLES = [
  { left: 28, top: 32, size: 3,   delay: 0 },
  { left: 65, top: 22, size: 2,   delay: 1.2 },
  { left: 78, top: 60, size: 2.5, delay: 2.4 },
  { left: 22, top: 70, size: 2,   delay: 3.6 },
  { left: 50, top: 80, size: 1.8, delay: 0.6 },
]

export default function EmptyThread() {
  return (
    <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient partiküller — yumuşak altın */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        {PARTICLES.map((p, i) => (
          <motion.span key={i}
            animate={{ y: [0, -16, 0], opacity: [0.2, 0.7, 0.2] }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`, top: `${p.top}%`,
              width: p.size, height: p.size,
              background: '#0f766e',
              boxShadow: '0 0 8px #0f766e',
            }} />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 140, damping: 18 }}
        className="text-center max-w-xs relative"
      >
        {/* Floating chat bubble illustrasyonu */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-28 h-28 mx-auto mb-6"
        >
          <div className="absolute inset-0 rounded-full"
               style={{
                 background: 'radial-gradient(circle, rgba(15, 118, 110, 0.22) 0%, transparent 65%)',
                 filter: 'blur(12px)',
               }} />
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="relative w-full h-full">
            <defs>
              <linearGradient id="bubble-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"  stopColor="#0f766e" />
                <stop offset="100%" stopColor="#0b5d57" />
              </linearGradient>
            </defs>
            <path d="M14 12h32a8 8 0 0 1 8 8v18a8 8 0 0 1-8 8H24l-10 8V20a8 8 0 0 1 0-8z"
                  fill="rgba(13, 11, 9, 0.85)"
                  stroke="url(#bubble-grad)" strokeWidth="1.5" />
            <circle cx="24" cy="29" r="2" fill="#0f766e" opacity="0.9" />
            <circle cx="32" cy="29" r="2" fill="#0f766e" opacity="0.9" />
            <circle cx="40" cy="29" r="2" fill="#0f766e" opacity="0.9" />
          </svg>
        </motion.div>
        <h3 className="text-[18px] font-semibold mb-2" style={{ color: '#ffffff', letterSpacing: '-0.015em' }}>
          <em className="not-italic font-semibold" style={{
            background: 'linear-gradient(135deg, #0f766e 0%, #0f766e 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Sohbet</em> seçin
        </h3>
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#6b7574' }}>
          Soldan bir sohbet seç veya yeni bir ilana başvur — her başvuru otomatik bir sohbet açar.
        </p>
      </motion.div>
    </div>
  )
}
