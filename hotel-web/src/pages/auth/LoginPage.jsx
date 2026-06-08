import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import ThemeToggle from '../../components/ThemeToggle'
import BackButton from '../../components/BackButton'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()

  async function onSubmit(data) {
    try {
      const result = await login(data.email, data.password)
      const redirectTo = location.state?.from?.pathname
      if (redirectTo) {
        navigate(redirectTo, { replace: true })
      } else if (result.role === 'CANDIDATE') {
        navigate('/candidate', { replace: true })
      } else if (result.role === 'BUSINESS_OWNER') {
        navigate('/business', { replace: true })
      } else if (result.role === 'ADMIN') {
        navigate('/admin', { replace: true })
      }
      toast.success(`Hoş geldin, ${result.fullName}!`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 text-slate-100 flex flex-col relative overflow-hidden">
      {/* Neon üst hat */}
      <div className="neon-strip" />

      {/* Arka plan spotlight */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[60%] h-96 rounded-full bg-brand-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      {/* Üst bar */}
      <header className="relative px-6 py-4 flex items-center justify-between border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <BackButton to="/" label="Ana Sayfa" />
          <span className="hidden sm:block w-px h-5 bg-slate-700" />
          <Link to="/" className="hidden sm:flex items-baseline gap-2">
            <span className="font-black text-base tracking-tight">AjansHotel</span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-slate-500">istanbul</span>
          </Link>
        </div>
        <ThemeToggle />
      </header>

      {/* İçerik */}
      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-glow-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-slate-300">Hoş Geldin</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              <span className="block">Hesabına</span>
              <span className="block bg-gradient-to-r from-emerald-300 to-brand-500 bg-clip-text text-transparent">Giriş Yap</span>
            </h1>
            <p className="text-[13px] text-slate-400 mt-3">
              Aday veya işletme hesabınla devam et.
            </p>
          </div>

          <div className="auth-card">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">E-posta</label>
                <input
                  type="email"
                  className="input"
                  placeholder="ornek@email.com"
                  {...register('email', {
                    required: 'E-posta zorunlu',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
                  })}
                />
                {errors.email && (
                  <p className="error-text">
                    <WarningIcon />
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="label !mb-0">Şifre</label>
                  <Link to="/forgot-password"
                    className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors">
                    Şifremi unuttum
                  </Link>
                </div>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  {...register('password', {
                    required: 'Şifre zorunlu',
                    minLength: { value: 8, message: 'En az 8 karakter' },
                  })}
                />
                {errors.password && (
                  <p className="error-text">
                    <WarningIcon />
                    {errors.password.message}
                  </p>
                )}
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Giriş yapılıyor...
                  </>
                ) : (
                  <>
                    Giriş Yap
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                         strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <p className="text-[12px] text-center text-slate-400 mt-6">
              Hesabın yok mu?{' '}
              <Link to="/register" className="font-bold text-brand-400 hover:text-brand-300 transition-colors">
                Ücretsiz kayıt ol
              </Link>
            </p>
          </div>

          {/* Demo bilgisi */}
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">
              Demo Hesaplar
            </p>
            <div className="space-y-2 text-[12px] font-mono text-slate-400">
              <DemoRow k="Aday"     v="demo-aday1@test.com" />
              <DemoRow k="İşletme"  v="demo-isletme1@test.com" />
              <DemoRow k="Şifre"    v="Demo1234!" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function DemoRow({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500 uppercase tracking-wider text-[10px]">{k}</span>
      <code className="text-slate-200">{v}</code>
    </div>
  )
}

function WarningIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="w-3.5 h-3.5">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  )
}
