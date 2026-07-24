import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import BackButton from '../../components/BackButton'

/** #80 — Reset linkinden gelen yeni sifre formu. FAZ A.2: acik+teal. */
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
      .then(res => { setEmail(res.email); setValidating(false) })
      .catch(err => { setError(extractErrorMessage(err)); setValidating(false) })
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
    <div className="min-h-screen ah-surface flex flex-col"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <header className="border-b" style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <BackButton to="/login" label="Girişe Dön" />
          <span className="hidden sm:block w-px h-5" style={{ background: 'var(--ah-line-2)' }} />
          <Link to="/" className="hidden sm:flex items-baseline gap-2">
            <span className="font-bold text-base" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>AjansHotel</span>
            <span className="text-[9px] uppercase tracking-[0.06em]" style={{ color: 'var(--ah-ink-4)' }}>istanbul</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5"
                 style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)' }}>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--ah-brand)' }}>Yeni Şifre</span>
            </div>
            <h1 style={{
              fontSize: 'clamp(24px, 3.5vw, 30px)', lineHeight: 1.15, fontWeight: 800,
              letterSpacing: '-0.02em', color: 'var(--ah-ink)',
            }}>
              Şifreni yenile
            </h1>
          </div>

          {validating ? (
            <div className="card text-center py-10">
              <div className="spinner mx-auto" />
              <p className="text-[12.5px] mt-4" style={{ color: 'var(--ah-ink-3)' }}>Bağlantı doğrulanıyor...</p>
            </div>
          ) : error ? (
            <div className="card text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                   style={{ background: 'var(--ah-danger-soft)', border: '1px solid var(--ah-danger)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2.2} stroke="var(--ah-danger)" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ah-ink)' }}>Bağlantı geçersiz</h2>
              <p className="text-[13px]" style={{ color: 'var(--ah-ink-3)' }}>{error}</p>
              <Link to="/forgot-password" className="btn-secondary !w-auto inline-flex">
                Yeni Talep Oluştur
              </Link>
            </div>
          ) : done ? (
            <div className="card text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                   style={{ background: 'var(--ah-ok-soft)', border: '1px solid var(--ah-ok)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2.2} stroke="var(--ah-ok)" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ah-ink)' }}>Şifre güncellendi</h2>
              <p className="text-[13px]" style={{ color: 'var(--ah-ink-3)' }}>Giriş sayfasına yönlendiriliyorsun...</p>
            </div>
          ) : (
            <div className="card">
              <p className="text-[12.5px] mb-4 pb-4 border-b" style={{ color: 'var(--ah-ink-3)', borderColor: 'var(--ah-line)' }}>
                Hesap: <span className="font-mono" style={{ color: 'var(--ah-brand)' }}>{email}</span>
              </p>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">Yeni Şifre</label>
                  <input type="password" className="input" placeholder="En az 8 karakter" autoFocus
                    {...register('newPassword', {
                      required: 'Şifre zorunlu',
                      minLength: { value: 8, message: 'En az 8 karakter' },
                    })} />
                  {errors.newPassword && <p className="error-text">{errors.newPassword.message}</p>}
                </div>

                <div>
                  <label className="label">Yeni Şifre (tekrar)</label>
                  <input type="password" className="input" placeholder="••••••••"
                    {...register('confirmPassword', {
                      required: 'Tekrar zorunlu',
                      validate: v => v === newPassword || 'Şifreler eşleşmiyor',
                    })} />
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
