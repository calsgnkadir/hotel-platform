import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import GoogleSignInButton from './GoogleSignInButton'

/**
 * AuthModal — Landing CTA'larından açılan tek-ekran auth seçici.
 *
 * Akış:
 *   1. Kullanıcı rol seçer (Aday / İşletme) — opsiyonel
 *   2. Google ile devam et veya email gir + "Devam et"
 *   3. Email yolu → /register'a navigate, role + email pre-fill
 *      (RegisterPage location.state'ten okur, step2'ye atlar)
 *   4. Google yolu → mevcut OAuth flow (backend default role atar)
 *
 * Landing arka planda blur'da kalır — sayfa değişikliği olmaz.
 */
export default function AuthModal({ open, onClose }) {
  const navigate = useNavigate()
  const [role, setRole] = useState(null)   // null | 'CANDIDATE' | 'BUSINESS_OWNER'
  const [email, setEmail] = useState('')
  const dialogRef = useRef(null)

  // Esc ile kapat + ilk açılışta odak
  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => dialogRef.current?.focus(), 10)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Modal kapanınca state reset (sonraki açılışta temiz)
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setRole(null); setEmail('') }, 300)
      return () => clearTimeout(t)
    }
  }, [open])

  function handleEmailContinue(e) {
    e.preventDefault()
    onClose()
    navigate('/register', {
      state: { preselectedRole: role, prefillEmail: email.trim() || undefined },
    })
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-labelledby="auth-modal-title">
          {/* Backdrop blur — landing'in arkada kalması */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(10, 6, 24, 0.55)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
            }}
          />
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-sm focus:outline-none"
            style={{
              borderRadius: 24,
              background: 'rgba(10, 6, 24, 0.95)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(212, 168, 83, 0.25)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(212, 168, 83, 0.06)',
            }}>
            {/* Kapat butonu */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/10"
              style={{ color: 'rgba(229, 231, 235, 0.7)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="p-7 space-y-5">
              {/* Logo + başlık */}
              <div className="text-center">
                <div className="font-bebas text-2xl tracking-wider"
                     style={{ color: '#fde9a5' }}>AJANSHOTEL</div>
                <h2 id="auth-modal-title"
                    className="mt-3 text-lg font-bold"
                    style={{ color: '#f8f6f4' }}>
                  Hospitality dünyasına katıl
                </h2>
                <p className="mt-1 text-xs" style={{ color: '#8ba9d2' }}>
                  Aday mısın yoksa işletme mi?
                </p>
              </div>

              {/* Rol seçimi (opsiyonel — Google'a tıklayan kullanıcı atlayabilir) */}
              <div className="grid grid-cols-2 gap-2">
                <RoleCard
                  active={role === 'CANDIDATE'}
                  onClick={() => setRole('CANDIDATE')}
                  title="Aday"
                  subtitle="İş arıyorum"
                />
                <RoleCard
                  active={role === 'BUSINESS_OWNER'}
                  onClick={() => setRole('BUSINESS_OWNER')}
                  title="İşletme"
                  subtitle="Eleman arıyorum"
                />
              </div>

              {/* Google */}
              <div>
                <GoogleSignInButton label="Google ile devam et" />
              </div>

              {/* Ayraç */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'rgba(212, 168, 83, 0.18)' }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]"
                      style={{ color: '#8ba9d2' }}>veya</span>
                <div className="flex-1 h-px" style={{ background: 'rgba(212, 168, 83, 0.18)' }} />
              </div>

              {/* Email + Devam et */}
              <form onSubmit={handleEmailContinue} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@adresin.com"
                  required
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(21, 36, 61, 0.65)',
                    color: '#f8f6f4',
                    border: '1px solid rgba(212, 168, 83, 0.20)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212, 168, 83, 0.50)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(212, 168, 83, 0.20)' }}
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853, #f7c43c)',
                    color: '#0a0612',
                    boxShadow: '0 8px 24px rgba(212, 168, 83, 0.35)',
                  }}>
                  Email ile devam et
                </button>
              </form>

              {/* Giriş yap linki */}
              <p className="text-center text-xs" style={{ color: '#8ba9d2' }}>
                Zaten hesabın var mı?{' '}
                <button type="button"
                        onClick={() => { onClose(); navigate('/login') }}
                        className="font-bold hover:underline"
                        style={{ color: '#fde9a5' }}>
                  Giriş yap
                </button>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function RoleCard({ active, onClick, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative px-3 py-3 rounded-2xl text-left transition-all hover:-translate-y-0.5"
      style={{
        background: active ? 'rgba(212, 168, 83, 0.18)' : 'rgba(21, 36, 61, 0.55)',
        border: active
          ? '1px solid rgba(212, 168, 83, 0.55)'
          : '1px solid rgba(212, 168, 83, 0.15)',
        boxShadow: active ? '0 0 0 2px rgba(212, 168, 83, 0.20)' : 'none',
      }}
      aria-pressed={active}>
      <div className="text-sm font-bold"
           style={{ color: active ? '#fde9a5' : '#f8f6f4' }}>{title}</div>
      <div className="text-[11px] mt-0.5"
           style={{ color: 'rgba(229, 231, 235, 0.55)' }}>{subtitle}</div>
      {active && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full"
              style={{ background: '#d4a853', boxShadow: '0 0 8px #d4a853' }} />
      )}
    </button>
  )
}
