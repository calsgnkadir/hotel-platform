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
export default function AuthModal({ open, onClose, defaultRole = null }) {
  const navigate = useNavigate()
  const [role, setRole] = useState(defaultRole)   // null | 'CANDIDATE' | 'BUSINESS_OWNER'
  const [email, setEmail] = useState('')
  const dialogRef = useRef(null)

  // Modal her acildiginda defaultRole degisirse senkronize et
  useEffect(() => { if (open) setRole(defaultRole) }, [open, defaultRole])

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
              background: 'rgba(13, 11, 9, 0.62)',
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
              borderRadius: '28px 12px 28px 12px',
              background: '#1b1815',
              border: 'none',
              boxShadow: '0 32px 72px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(245,239,226,0.04)',
            }}>
            {/* Kapat butonu */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Kapat"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{ color: '#928678' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(205, 183, 143, 0.06)'; e.currentTarget.style.color = '#ede4d3' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#928678' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>

            <div className="p-7 space-y-5">
              {/* Logo + başlık */}
              <div className="text-center">
                <div className="font-bebas text-2xl tracking-wider"
                     style={{ color: '#f5efe2' }}>AJANSHOTEL</div>
                <h2 id="auth-modal-title"
                    className="font-syne mt-4"
                    style={{
                      color: '#f5efe2',
                      fontSize: '18px',
                      fontWeight: 600,
                      letterSpacing: '-0.015em',
                    }}>
                  Hospitality dünyasına katıl
                </h2>
                <p className="mt-1.5 text-[11px] uppercase tracking-[0.22em]" style={{ color: '#928678' }}>
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

              {/* Ayraç — hairline */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(205,183,143,0.18), transparent)' }} />
                <span className="text-[9px] uppercase tracking-[0.32em]" style={{ color: '#6b6358' }}>veya</span>
                <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(205,183,143,0.18), transparent)' }} />
              </div>

              {/* Email + Devam et */}
              <form onSubmit={handleEmailContinue} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@adresin.com"
                  required
                  className="w-full px-4 py-2.5 rounded-2xl text-sm outline-none transition-all"
                  style={{
                    background: 'rgba(13, 11, 9, 0.55)',
                    color: '#ede4d3',
                    border: '1px solid rgba(205, 183, 143, 0.14)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(205, 183, 143, 0.55)'
                    e.currentTarget.style.boxShadow = '0 0 0 4px rgba(205, 183, 143, 0.10)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(205, 183, 143, 0.14)'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl text-[13px] font-semibold uppercase tracking-[0.14em] transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    color: '#1a1208',
                    boxShadow: '0 12px 28px rgba(205, 183, 143, 0.22), inset 0 1px 0 rgba(255,255,255,0.22)',
                  }}>
                  Email ile devam et
                </button>
              </form>

              {/* Giriş yap linki */}
              <p className="text-center text-[12px]" style={{ color: '#928678' }}>
                Zaten hesabın var mı?{' '}
                <button type="button"
                        onClick={() => { onClose(); navigate('/login') }}
                        className="font-semibold underline-sweep"
                        style={{ color: '#cdb78f' }}>
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
      className="relative px-3.5 py-3 rounded-2xl text-left transition-all hover:-translate-y-0.5"
      style={{
        background: active ? 'rgba(205, 183, 143, 0.12)' : 'rgba(34, 31, 27, 0.55)',
        border: active
          ? '1px solid rgba(205, 183, 143, 0.45)'
          : '1px solid rgba(205, 183, 143, 0.10)',
      }}
      aria-pressed={active}>
      <div className="text-sm font-semibold"
           style={{ color: active ? '#f5efe2' : '#ede4d3', letterSpacing: '-0.005em' }}>{title}</div>
      <div className="text-[11px] mt-1"
           style={{ color: '#928678' }}>{subtitle}</div>
      {active && (
        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full"
              style={{ background: '#cdb78f', boxShadow: '0 0 6px rgba(205, 183, 143, 0.55)' }} />
      )}
    </button>
  )
}
