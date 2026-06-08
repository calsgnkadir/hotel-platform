import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import ThemeToggle from '../../components/ThemeToggle'

/**
 * #80: Reset link'inden geldikten sonra yeni şifre formu.
 * URL: /reset-password?token=ABC123
 */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()

  const [validating, setValidating] = useState(true)
  const [error, setError] = useState(null)
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm()
  const newPassword = watch('newPassword', '')

  useEffect(() => {
    if (!token) {
      setError('Token eksik — link bozulmuş olabilir.')
      setValidating(false)
      return
    }
    hotelApi.validatePasswordResetToken(token)
      .then(res => {
        setEmail(res.email)
        setValidating(false)
      })
      .catch(err => {
        setError(extractErrorMessage(err))
        setValidating(false)
      })
  }, [token])

  async function onSubmit(data) {
    try {
      await hotelApi.confirmPasswordReset(token, data.newPassword)
      setDone(true)
      toast.success('Şifren güncellendi! Giriş yapabilirsin.')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-ink-900 text-slate-100 flex flex-col relative overflow-hidden">
      <div className="neon-strip" />

      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[60%] h-96 rounded-full bg-brand-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      <header className="relative px-6 py-4 flex items-center justify-between border-b border-slate-800/60">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-black text-base tracking-tight">AjansHotel</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-slate-500">istanbul</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-glow-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-slate-300">Yeni Şifre</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              <span className="block">Şifreni</span>
              <span className="block bg-gradient-to-r from-emerald-300 to-brand-500 bg-clip-text text-transparent">Yenile</span>
            </h1>
          </div>

          {validating ? (
            <div className="auth-card text-center py-10">
              <div className="spinner mx-auto" />
              <p className="text-[12px] text-slate-400 mt-4">Bağlantı doğrulanıyor...</p>
            </div>
          ) : error ? (
            <div className="auth-card text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-red-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Bağlantı geçersiz</h2>
              <p className="text-[13px] text-slate-400">{error}</p>
              <Link to="/forgot-password" className="btn-secondary !w-auto inline-flex">
                Yeni Talep Oluştur
              </Link>
            </div>
          ) : done ? (
            <div className="auth-card text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-emerald-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Şifre güncellendi</h2>
              <p className="text-[13px] text-slate-400">Giriş sayfasına yönlendiriliyorsun...</p>
            </div>
          ) : (
            <div className="auth-card">
              <p className="text-[12px] text-slate-400 mb-4 pb-4 border-b border-slate-800">
                Hesap: <span className="font-mono text-brand-400">{email}</span>
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">Yeni Şifre</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="En az 8 karakter"
                    autoFocus
                    {...register('newPassword', {
                      required: 'Şifre zorunlu',
                      minLength: { value: 8, message: 'En az 8 karakter' },
                    })}
                  />
                  {errors.newPassword && <p className="error-text">{errors.newPassword.message}</p>}
                </div>

                <div>
                  <label className="label">Yeni Şifre (tekrar)</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    {...register('confirmPassword', {
                      required: 'Tekrar zorunlu',
                      validate: v => v === newPassword || 'Şifreler eşleşmiyor',
                    })}
                  />
                  {errors.confirmPassword && <p className="error-text">{errors.confirmPassword.message}</p>}
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
                  {isSubmitting ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
