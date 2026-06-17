import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import GoogleSignInButton from '../../components/GoogleSignInButton'

/**
 * Login Redesign — "Geist + glass + mouse parallax"
 *
 * Sade ama derin: tek merkez cam kart, animasyonlu mesh gradient + altın
 * parçacık zemin, floating label input, spring micro-interactions, parallax tilt.
 * Hero panel YOK — odak tek noktada.
 */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm()
  const [shake, setShake] = useState(0)

  // Mouse parallax — kart hafifçe mouse'a tepki versin
  const cardRef = useRef(null)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [4, -4]),  { stiffness: 150, damping: 30 })
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-4, 4]),  { stiffness: 150, damping: 30 })

  function onMove(e) {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width  - 0.5)
    my.set((e.clientY - r.top)  / r.height - 0.5)
  }
  function onLeave() { mx.set(0); my.set(0) }

  async function onSubmit(data) {
    try {
      const result = await login(data.email, data.password)
      const redirectTo = location.state?.from?.pathname
      if (redirectTo) navigate(redirectTo, { replace: true })
      else if (result.role === 'CANDIDATE')      navigate('/candidate', { replace: true })
      else if (result.role === 'BUSINESS_OWNER') navigate('/business',  { replace: true })
      else if (result.role === 'ADMIN')          navigate('/admin',     { replace: true })
      toast.success(`Hoş geldin, ${result.fullName.split(' ')[0]}.`)
    } catch (err) {
      setShake(n => n + 1)
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-geist" style={{ background: '#0a1220' }}>
      <AmbientBackdrop />

      {/* Merkez kart konteyneri — mouse parallax buradan dinlenir */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12"
           onMouseMove={onMove} onMouseLeave={onLeave}>
        <motion.div
          ref={cardRef}
          key={shake}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{
            opacity: 1, y: 0, scale: 1,
            x: shake > 0 ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
          }}
          transition={{
            opacity: { duration: 0.5 },
            y:       { type: 'spring', stiffness: 110, damping: 16 },
            scale:   { type: 'spring', stiffness: 110, damping: 16 },
            x:       { duration: 0.45 },
          }}
          style={{ rotateX, rotateY, transformPerspective: 1100 }}
          className="w-full max-w-md relative"
        >
          {/* Animasyonlu altın hat gradient border (conic) */}
          <div aria-hidden className="absolute -inset-px rounded-[28px] opacity-90 pointer-events-none"
               style={{
                 background: 'conic-gradient(from 0deg, transparent 0%, rgba(212,168,83,0.45) 12%, transparent 32%, rgba(212,168,83,0.30) 60%, transparent 78%)',
                 animation: 'spin 14s linear infinite',
                 filter: 'blur(0.5px)',
               }} />
          <div className="relative rounded-[27px] p-8 sm:p-10"
               style={{
                 background: 'linear-gradient(180deg, rgba(15, 23, 38, 0.78) 0%, rgba(12, 23, 38, 0.85) 100%)',
                 backdropFilter: 'blur(28px) saturate(140%)',
                 WebkitBackdropFilter: 'blur(28px) saturate(140%)',
                 border: '1px solid rgba(212, 168, 83, 0.14)',
                 boxShadow: '0 24px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)',
               }}>
            <Stagger>
              {/* Brand */}
              <motion.div variants={ITEM} className="flex items-center justify-between mb-10">
                <Link to="/" className="flex items-baseline gap-2">
                  <span className="font-bebas text-2xl tracking-wider text-white">AJANSHOTEL</span>
                  <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: '#fde9a5' }}>istanbul</span>
                </Link>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em]"
                      style={{ color: 'rgba(253, 233, 165, 0.55)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#d4a853' }} />
                  giriş
                </span>
              </motion.div>

              {/* Başlık */}
              <motion.h1 variants={ITEM}
                className="text-3xl sm:text-[34px] leading-[1.05] mb-2"
                style={{ color: '#f8f6f4', fontWeight: 500, letterSpacing: '-0.02em' }}>
                Tekrar <em className="not-italic" style={{
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #f7c43c 0%, #d4a853 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>hoş geldin</em>.
              </motion.h1>
              <motion.p variants={ITEM} className="text-sm mb-8" style={{ color: '#8ba9d2', fontWeight: 400 }}>
                E-posta adresinle devam et.
              </motion.p>

              {/* Google */}
              <motion.div variants={ITEM}>
                <GoogleSignInButton label="Google ile devam et" />
              </motion.div>

              <motion.div variants={ITEM} className="flex items-center gap-3 my-6">
                <span className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.18), transparent)' }} />
                <span className="text-[10px] uppercase tracking-[0.3em]" style={{ color: 'rgba(253, 233, 165, 0.45)' }}>veya</span>
                <span className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(212,168,83,0.18), transparent)' }} />
              </motion.div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <motion.div variants={ITEM}>
                  <FloatingInput
                    label="E-posta"
                    type="email"
                    autoComplete="email"
                    error={errors.email?.message}
                    value={watch('email')}
                    registration={register('email', {
                      required: 'E-posta zorunlu',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
                    })}
                  />
                </motion.div>

                <motion.div variants={ITEM}>
                  <FloatingInput
                    label="Şifre"
                    type="password"
                    autoComplete="current-password"
                    error={errors.password?.message}
                    value={watch('password')}
                    registration={register('password', {
                      required: 'Şifre zorunlu',
                      minLength: { value: 8, message: 'En az 8 karakter' },
                    })}
                    trailing={
                      <Link to="/forgot-password"
                        className="text-[11px] font-medium transition-colors"
                        style={{ color: 'rgba(253, 233, 165, 0.75)' }}>
                        Unuttum?
                      </Link>
                    }
                  />
                </motion.div>

                <motion.div variants={ITEM} className="pt-2">
                  <SubmitButton submitting={isSubmitting}>Giriş yap</SubmitButton>
                </motion.div>
              </form>

              <motion.p variants={ITEM} className="text-[13px] text-center mt-6"
                        style={{ color: 'rgba(253, 233, 165, 0.7)' }}>
                Hesabın yok mu?{' '}
                <Link to="/register" className="relative font-semibold group"
                      style={{ color: '#f7c43c' }}>
                  Ücretsiz oluştur
                  <span aria-hidden className="absolute left-0 -bottom-0.5 h-px w-full origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
                        style={{ background: '#f7c43c' }} />
                </Link>
              </motion.p>

              <motion.details variants={ITEM} className="mt-8 group">
                <summary className="cursor-pointer text-[10px] uppercase tracking-[0.3em] flex items-center gap-2 select-none"
                         style={{ color: 'rgba(139, 169, 210, 0.65)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={1.8} className="w-3 h-3 transition-transform group-open:rotate-90">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                  Demo hesaplar
                </summary>
                <div className="mt-3 space-y-1.5 text-[12px]" style={{ fontFamily: '"Geist Mono", monospace' }}>
                  <DemoRow k="Aday"    v="aday1@test.com" />
                  <DemoRow k="İşletme" v="isletme1@test.com" />
                  <DemoRow k="Şifre"   v="Password123!" />
                </div>
              </motion.details>
            </Stagger>
          </div>
        </motion.div>
      </div>

      {/* Yerel keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes drift-a { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(40px,-30px) scale(1.05) } }
        @keyframes drift-b { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(-30px,40px) scale(0.95) } }
        @keyframes drift-c { 0%,100% { transform: translate(0,0) scale(1) } 50% { transform: translate(20px,30px) scale(1.08) } }
        @keyframes float-particle {
          0%   { transform: translateY(0) translateX(0); opacity: 0 }
          10%  { opacity: 0.9 }
          90%  { opacity: 0.9 }
          100% { transform: translateY(-100vh) translateX(40px); opacity: 0 }
        }
      `}</style>
    </div>
  )
}

/* ───── Stagger orchestrator ───── */
const ITEM = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
}
function Stagger({ children }) {
  return (
    <motion.div
      initial="hidden" animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } } }}>
      {children}
    </motion.div>
  )
}

/* ───── Floating label input ───── */
function FloatingInput({ label, type = 'text', autoComplete, error, value, registration, trailing }) {
  const [focused, setFocused] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const isPwd = type === 'password'
  const effectiveType = isPwd && showPwd ? 'text' : type
  const filled = !!(value && String(value).length > 0)
  const lifted = focused || filled

  return (
    <div className="relative">
      <motion.div
        animate={{
          borderColor: error
            ? 'rgba(248, 113, 113, 0.55)'
            : focused
              ? 'rgba(212, 168, 83, 0.55)'
              : 'rgba(212, 168, 83, 0.14)',
          boxShadow: focused
            ? '0 0 0 4px rgba(212, 168, 83, 0.10), 0 8px 24px rgba(0,0,0,0.20)'
            : '0 0 0 0px rgba(212, 168, 83, 0)',
        }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl"
        style={{
          background: 'rgba(10, 18, 32, 0.55)',
          border: '1px solid',
        }}
      >
        <input
          {...registration}
          type={effectiveType}
          autoComplete={autoComplete}
          onFocus={(e) => { setFocused(true);  registration.onBlur && null }}
          onBlur={(e)  => { setFocused(false); registration.onBlur(e) }}
          placeholder=" "
          className="peer w-full bg-transparent outline-none text-[15px] px-4 pt-6 pb-2 text-white tracking-normal"
          style={{ caretColor: '#d4a853' }}
        />
        <motion.label
          animate={{
            y:        lifted ? -8  : 4,
            scale:    lifted ? 0.82 : 1,
            color:    error ? '#fca5a5' : (focused ? '#fde9a5' : 'rgba(139, 169, 210, 0.85)'),
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          className="absolute left-4 top-3 text-[13px] origin-left pointer-events-none"
          style={{ letterSpacing: lifted ? '0.18em' : '0', textTransform: lifted ? 'uppercase' : 'none', fontWeight: lifted ? 600 : 400 }}
        >
          {label}
        </motion.label>

        {/* Trailing area: pwd toggle veya custom link */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isPwd && (
            <button type="button" tabIndex={-1}
              onClick={() => setShowPwd(s => !s)}
              className="w-7 h-7 grid place-items-center rounded-full hover:bg-white/5 transition-colors"
              aria-label={showPwd ? 'Şifreyi gizle' : 'Şifreyi göster'}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   stroke="rgba(253, 233, 165, 0.75)" strokeWidth={1.6} className="w-4 h-4">
                {showPwd ? (
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L9.88 9.88" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                )}
                {!showPwd && <circle cx="12" cy="12" r="3" />}
              </svg>
            </button>
          )}
          {trailing}
        </div>
      </motion.div>

      {/* Hata mesajı — yumuşak yükselme */}
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="text-[11px] mt-1.5 ml-1" style={{ color: '#fca5a5' }}>
          {error}
        </motion.p>
      )}
    </div>
  )
}

/* ───── Submit button — spring + loading ───── */
function SubmitButton({ children, submitting }) {
  return (
    <motion.button
      type="submit" disabled={submitting}
      whileHover={{ scale: 1.015, y: -1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="w-full relative rounded-2xl py-3.5 px-6 font-semibold text-[14px] tracking-wide overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      style={{
        background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
        color: '#1a1208',
        boxShadow: '0 8px 24px rgba(212, 168, 83, 0.30), inset 0 1px 0 rgba(255,255,255,0.30)',
      }}
    >
      {/* Sheen sweep */}
      <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.30), transparent)',
              transform: 'skewX(-20deg)',
              animation: 'shimmer 2.6s ease-in-out infinite',
            }} />
      {submitting ? (
        <>
          <Dot delay="0ms" /><Dot delay="120ms" /><Dot delay="240ms" />
        </>
      ) : (
        <>
          <span>{children}</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </>
      )}
    </motion.button>
  )
}
function Dot({ delay }) {
  return (
    <span className="w-1.5 h-1.5 rounded-full" style={{
      background: '#1a1208',
      animation: `bounce 0.9s ease-in-out infinite`,
      animationDelay: delay,
    }} />
  )
}

/* ───── Demo row ───── */
function DemoRow({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1.5 rounded-md"
         style={{ background: 'rgba(212, 168, 83, 0.04)' }}>
      <span className="uppercase tracking-[0.2em] text-[9px]" style={{ color: 'rgba(139, 169, 210, 0.75)' }}>{k}</span>
      <code style={{ color: '#fde9a5' }}>{v}</code>
    </div>
  )
}

/* ───── Ambient backdrop — gradient blobs + particles + grain ───── */
function AmbientBackdrop() {
  // Particles için sabit set (re-render olmasın)
  const particles = useRef(
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 20,
      duration: 14 + Math.random() * 18,
      size: 1 + Math.random() * 2.5,
    }))
  ).current

  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* 3 büyük drift gradient blob */}
      <div className="absolute -top-32 -left-32 w-[640px] h-[640px] rounded-full opacity-60"
           style={{
             background: 'radial-gradient(circle, rgba(35, 74, 130, 0.55) 0%, transparent 60%)',
             animation: 'drift-a 24s ease-in-out infinite',
             filter: 'blur(40px)',
           }} />
      <div className="absolute bottom-[-200px] right-[-180px] w-[640px] h-[640px] rounded-full opacity-50"
           style={{
             background: 'radial-gradient(circle, rgba(212, 168, 83, 0.30) 0%, transparent 60%)',
             animation: 'drift-b 28s ease-in-out infinite',
             filter: 'blur(50px)',
           }} />
      <div className="absolute top-1/3 right-1/4 w-[420px] h-[420px] rounded-full opacity-40"
           style={{
             background: 'radial-gradient(circle, rgba(184, 144, 45, 0.25) 0%, transparent 60%)',
             animation: 'drift-c 32s ease-in-out infinite',
             filter: 'blur(60px)',
           }} />

      {/* Soft floor */}
      <div className="absolute inset-0"
           style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(212, 168, 83, 0.06) 0%, transparent 50%)' }} />

      {/* Altın parçacıklar */}
      <div className="absolute inset-0">
        {particles.map(p => (
          <span key={p.id}
            className="absolute rounded-full"
            style={{
              left:    `${p.left}%`,
              bottom:  '-10px',
              width:   `${p.size}px`,
              height:  `${p.size}px`,
              background: 'rgba(212, 168, 83, 0.55)',
              boxShadow: '0 0 6px rgba(212, 168, 83, 0.55)',
              animation: `float-particle ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }} />
        ))}
      </div>

      {/* SVG grain noise overlay — kart cam dokusuna karakter katar */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.035] mix-blend-overlay" aria-hidden>
        <filter id="auth-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 0.83  0 0 0 0 0.66  0 0 0 0 0.33  0 0 0 0.4 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#auth-noise)" />
      </svg>

      {/* Vignette */}
      <div className="absolute inset-0"
           style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(10, 18, 32, 0.55) 100%)' }} />
    </div>
  )
}
