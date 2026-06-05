import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import ThemeToggle from '../../components/ThemeToggle'

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
      toast.success(`Hoş geldiniz, ${result.fullName}!`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col">
      {/* Üst bar */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-700 flex items-center justify-center">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="font-semibold text-sm">AjansHotel</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* İçerik */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-7">
            <h1 className="text-2xl font-bold tracking-tight">Hoş geldin</h1>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1.5">
              Aday veya işletme hesabınla giriş yap.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                E-posta
              </label>
              <input
                type="email"
                className="w-full px-3.5 py-2.5 text-[13px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 transition-all"
                placeholder="ornek@email.com"
                {...register('email', {
                  required: 'E-posta zorunlu',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
                })}
              />
              {errors.email && <p className="text-[11px] text-red-500 mt-1">⚠ {errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-[12px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Şifre
              </label>
              <input
                type="password"
                className="w-full px-3.5 py-2.5 text-[13px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900 transition-all"
                placeholder="••••••••"
                {...register('password', {
                  required: 'Şifre zorunlu',
                  minLength: { value: 8, message: 'En az 8 karakter' },
                })}
              />
              {errors.password && <p className="text-[11px] text-red-500 mt-1">⚠ {errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting}
              className="w-full mt-2 px-4 py-2.5 rounded-lg bg-brand-700 hover:bg-brand-800 text-white text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm flex items-center justify-center gap-2">
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
                       strokeWidth={2.2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <p className="text-[12px] text-center text-slate-500 dark:text-slate-400 mt-7">
            Hesabın yok mu?{' '}
            <Link to="/register" className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">
              Ücretsiz kayıt ol
            </Link>
          </p>

          {/* Demo bilgisi */}
          <div className="mt-8 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-400 mb-2">
              Demo Hesaplar
            </p>
            <div className="space-y-1.5 text-[11px] font-mono text-slate-600 dark:text-slate-400">
              <div>Aday:     <code className="text-slate-800 dark:text-slate-200">demo-aday1@test.com</code></div>
              <div>İşletme:  <code className="text-slate-800 dark:text-slate-200">demo-isletme1@test.com</code></div>
              <div>Şifre:    <code className="text-slate-800 dark:text-slate-200">Demo1234!</code></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
