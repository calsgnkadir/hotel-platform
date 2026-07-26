import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleSignInButton from './GoogleSignInButton'

/**
 * AuthModal — Landing CTA'larindan acilan tek-ekran auth secici.
 * FAZ A.2: acik+teal, animasyon sokuldu (opacity fade CSS).
 *
 * Akis:
 *   1. Rol sec (Aday / Isletme) — opsiyonel
 *   2. Google ile devam et VEYA email gir + "Email ile devam et"
 *   3. Email yolu -> /register, role + email pre-fill (RegisterPage step2'ye atlar)
 */
export default function AuthModal({ open, onClose, defaultRole = null }) {
  const navigate = useNavigate()
  const [role, setRole] = useState(defaultRole)
  const [email, setEmail] = useState('')
  const dialogRef = useRef(null)

  useEffect(() => { if (open) setRole(defaultRole) }, [open, defaultRole])

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    setTimeout(() => dialogRef.current?.focus(), 10)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => { setRole(null); setEmail('') }, 200)
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 fade-in"
      onClick={onClose}
      aria-modal="true" role="dialog" aria-labelledby="auth-modal-title"
      style={{ background: 'rgba(18, 32, 31, 0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        ref={dialogRef} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm focus:outline-none"
        style={{
          borderRadius: '12px',
          background: 'var(--ah-card)',
          border: '1px solid var(--ah-line)',
          boxShadow: 'var(--elev-3)',
          color: 'var(--ah-ink-2)',
        }}
      >
        {/* Kapat butonu */}
        <button type="button" onClick={onClose} aria-label="Kapat"
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: 'var(--ah-ink-3)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ah-page)'; e.currentTarget.style.color = 'var(--ah-ink)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ah-ink-3)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="p-6 space-y-5">
          {/* Baslik */}
          <div className="text-center">
            <div className="text-base font-bold" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>
              AjansHotel
            </div>
            <h2 id="auth-modal-title" className="mt-3"
                style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--ah-ink)' }}>
              Hesap oluştur veya giriş yap
            </h2>
            <p className="mt-1 text-[12px]" style={{ color: 'var(--ah-ink-3)' }}>
              Aday mısın yoksa işletme mi?
            </p>
          </div>

          {/* Rol secimi */}
          <div className="grid grid-cols-2 gap-2">
            <RoleCard active={role === 'CANDIDATE'} onClick={() => setRole('CANDIDATE')}
                      title="Aday" subtitle="İş arıyorum" />
            <RoleCard active={role === 'BUSINESS_OWNER'} onClick={() => setRole('BUSINESS_OWNER')}
                      title="İşletme" subtitle="Eleman arıyorum" />
          </div>

          {/* Google */}
          <GoogleSignInButton label="Google ile devam et" />

          {/* Ayrac */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
            <span className="text-[10px] uppercase tracking-[0.06em] font-semibold" style={{ color: 'var(--ah-ink-4)' }}>veya</span>
            <div className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
          </div>

          {/* Email */}
          <form onSubmit={handleEmailContinue} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="email@adresin.com" required
              className="input"
              autoFocus />
            <button type="submit" className="btn-primary">Email ile devam et</button>
          </form>

          <p className="text-center text-[12.5px]" style={{ color: 'var(--ah-ink-3)' }}>
            Zaten hesabın var mı?{' '}
            <button type="button" onClick={() => { onClose(); navigate('/login') }}
                    className="font-bold hover:underline" style={{ color: 'var(--ah-brand)' }}>
              Giriş yap
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

function RoleCard({ active, onClick, title, subtitle }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="px-3.5 py-3 rounded-lg text-left transition-colors"
      style={active
        ? { background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-brand)' }
        : { background: 'var(--ah-card)', border: '1px solid var(--ah-line-2)' }}>
      <div className="text-[14px] font-semibold" style={{ color: active ? 'var(--ah-brand)' : 'var(--ah-ink)' }}>{title}</div>
      <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>{subtitle}</div>
    </button>
  )
}
