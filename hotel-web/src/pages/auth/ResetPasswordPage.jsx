import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import ThemeToggle from '../../components/ThemeToggle'
import BackButton from '../../components/BackButton'
import DarkVeil from '../../components/DarkVeil'

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
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#0a0618' }}>
      {/* FAZ 5.4 — DarkVeil */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <DarkVeil hueShift={285} noiseIntensity={0.02} speed={0.4} warpAmount={0.3} />
      </div>
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10,6,24,0.7) 90%)' }} />

      <div className="relative z-10 neon-strip" />

      <header className="relative px-6 py-4 flex items-center justify-between border-b border-cream-300">
        <div className="flex items-center gap-3">
          <BackButton to="/login" label="Girişe Dön" />
          <span className="hidden sm:block w-px h-5 bg-slate-700" />
          <Link to="/" className="hidden sm:flex items-baseline gap-2">
            <span className="font-black text-base tracking-tight">AjansHotel</span>
            <span className="text-[9px] uppercase tracking-[0.18em] text-ink-400">istanbul</span>
          </Link>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white border border-cream-300 rounded-full px-3 py-1 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-terra-400 animate-glow-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-ink-700">Yeni Şifre</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              <span className="block">Şifreni</span>
              <span className="block bg-gradient-to-r from-brand-700 to-terra-500 bg-clip-text text-transparent">Yenile</span>
            </h1>
          </div>

          {validating ? (
            <div className="auth-card text-center py-10">
              <div className="spinner mx-auto" />
              <p className="text-[12px] text-ink-500 mt-4">Bağlantı doğrulanıyor...</p>
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
              <p className="text-[13px] text-ink-500">{error}</p>
              <Link to="/forgot-password" className="btn-secondary !w-auto inline-flex">
                Yeni Talep Oluştur
              </Link>
            </div>
          ) : done ? (
            <div className="auth-card text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-brand-700">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Şifre güncellendi</h2>
              <p className="text-[13px] text-ink-500">Giriş sayfasına yönlendiriliyorsun...</p>
            </div>
          ) : (
            <div className="auth-card">
              <p className="text-[12px] text-ink-500 mb-4 pb-4 border-b border-cream-300">
                Hesap: <span className="font-mono text-brand-700">{email}</span>
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
