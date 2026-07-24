import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import GoogleSignInButton from '../../components/GoogleSignInButton'

/**
 * LoginPage — FAZ A.2 acik+teal yeniden yazim.
 * Eski v3 "editorial dark luxe" (AmbientBackdrop + framer parallax + altin
 * gradient + neon particle + shimmer) BIRAKILDI. Form davranisi ve
 * validasyon korundu; goze goze animasyon yok.
 */
export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const [showPwd, setShowPwd] = useState(false)

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
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen ah-surface flex flex-col"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      {/* Ust bar */}
      <header className="border-b" style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="font-bold text-base" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>AjansHotel</span>
            <span className="text-[9px] uppercase tracking-[0.06em]" style={{ color: 'var(--ah-ink-4)' }}>istanbul</span>
          </Link>
          <Link to="/register" className="text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors"
                style={{ color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line-2)', background: 'var(--ah-card)' }}>
            Kayıt Ol
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 style={{
              fontSize: 'clamp(24px, 3.5vw, 30px)', lineHeight: 1.15, fontWeight: 800,
              letterSpacing: '-0.02em', color: 'var(--ah-ink)',
            }}>
              Tekrar hoş geldin.
            </h1>
            <p className="text-[13.5px] mt-2" style={{ color: 'var(--ah-ink-3)' }}>
              Hesabına giriş yap, kaldığın yerden devam et.
            </p>
          </div>

          <div className="card">
            {/* Google */}
            <GoogleSignInButton label="Google ile devam et" />

            <div className="flex items-center gap-3 my-6">
              <span className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
              <span className="text-[10px] uppercase tracking-[0.06em] font-semibold" style={{ color: 'var(--ah-ink-4)' }}>
                veya
              </span>
              <span className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">E-posta</label>
                <input type="email" className="input" placeholder="ornek@email.com"
                  autoComplete="email" autoFocus
                  {...register('email', {
                    required: 'E-posta zorunlu',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
                  })} />
                {errors.email && <p className="error-text">{errors.email.message}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label !mb-0">Şifre</label>
                  <Link to="/forgot-password" className="text-[11px] font-semibold hover:underline" style={{ color: 'var(--ah-brand)' }}>
                    Şifremi Unuttum
                  </Link>
                </div>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} className="input pr-10" placeholder="••••••••"
                    autoComplete="current-password"
                    {...register('password', {
                      required: 'Şifre zorunlu',
                      minLength: { value: 8, message: 'En az 8 karakter' },
                    })} />
                  <button type="button" tabIndex={-1} onClick={() => setShowPwd(s => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-md"
                    aria-label={showPwd ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    style={{ color: 'var(--ah-ink-3)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                      {showPwd ? (
                        <path strokeLinecap="round" strokeLinejoin="round"
                              d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L9.88 9.88" />
                      ) : (
                        <>
                          <path strokeLinecap="round" strokeLinejoin="round"
                                d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
                {errors.password && <p className="error-text">{errors.password.message}</p>}
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
                {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş yap'}
              </button>
            </form>

            <p className="text-[12.5px] text-center mt-6" style={{ color: 'var(--ah-ink-3)' }}>
              Hesabın yok mu?{' '}
              <Link to="/register" className="font-bold hover:underline" style={{ color: 'var(--ah-brand)' }}>
                Ücretsiz oluştur
              </Link>
            </p>

            {/* Demo hesaplar — sade details/summary */}
            <details className="mt-6 pt-4" style={{ borderTop: '1px solid var(--ah-line)' }}>
              <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.06em] select-none inline-flex items-center gap-1.5"
                       style={{ color: 'var(--ah-ink-4)' }}>
                Demo hesaplar
              </summary>
              <div className="mt-3 space-y-1.5 text-[12.5px]">
                <DemoRow k="Aday"    v="aday1@test.com" />
                <DemoRow k="İşletme" v="isletme1@test.com" />
                <DemoRow k="Şifre"   v="Password123!" />
              </div>
            </details>
          </div>
        </div>
      </main>
    </div>
  )
}

function DemoRow({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-1.5 rounded-md"
         style={{ background: 'var(--ah-page)' }}>
      <span className="text-[10px] uppercase tracking-[0.06em] font-semibold" style={{ color: 'var(--ah-ink-4)' }}>{k}</span>
      <code style={{ color: 'var(--ah-brand)' }}>{v}</code>
    </div>
  )
}
