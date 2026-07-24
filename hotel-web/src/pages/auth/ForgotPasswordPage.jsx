import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import BackButton from '../../components/BackButton'

/**
 * #80 — Şifremi unuttum. FAZ A.2: acik+teal.
 * Enumeration korumasi: bilinmeyen email'de de "gonderildi" mesaji.
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting }, getValues } = useForm()

  async function onSubmit(data) {
    try {
      await hotelApi.requestPasswordReset(data.email)
      setSent(true)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="min-h-screen ah-surface flex flex-col"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      {/* Ust bar */}
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
              <span className="text-[11px] font-semibold" style={{ color: 'var(--ah-brand)' }}>
                Şifre Sıfırlama
              </span>
            </div>
            <h1 style={{
              fontSize: 'clamp(24px, 3.5vw, 30px)', lineHeight: 1.15, fontWeight: 800,
              letterSpacing: '-0.02em', color: 'var(--ah-ink)',
            }}>
              Şifreni unuttun mu?
            </h1>
            <p className="text-[13.5px] mt-3" style={{ color: 'var(--ah-ink-3)' }}>
              E-posta adresini gir, sıfırlama linki gönderelim.
            </p>
          </div>

          {sent ? (
            <div className="card text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                   style={{ background: 'var(--ah-ok-soft)', border: '1px solid var(--ah-ok)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2.2} stroke="var(--ah-ok)" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ah-ink)' }}>Email gönderildi</h2>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ah-ink-3)' }}>
                Eğer <span className="font-mono" style={{ color: 'var(--ah-brand)' }}>{getValues('email')}</span> kayıtlı
                bir hesabaysa, birkaç dakika içinde inbox'una <strong style={{ color: 'var(--ah-ink)' }}>"AjansHotel — Şifre Sıfırlama"</strong>
                {' '}başlıklı bir mail gelecek. Spam klasörünü de kontrol et.
              </p>
              <p className="text-[11px] italic" style={{ color: 'var(--ah-ink-4)' }}>
                Bağlantı 1 saat geçerli.
              </p>
              <Link to="/login" className="btn-secondary !w-auto inline-flex mt-2">
                Giriş Sayfasına Dön
              </Link>
            </div>
          ) : (
            <div className="card">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label className="label">E-posta</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="ornek@email.com"
                    autoFocus
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

                <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
                  {isSubmitting ? 'Gönderiliyor...' : 'Sıfırlama Linki Gönder'}
                </button>
              </form>

              <p className="text-[12.5px] text-center mt-6" style={{ color: 'var(--ah-ink-3)' }}>
                Şifreni hatırladın mı?{' '}
                <Link to="/login" className="font-bold hover:underline" style={{ color: 'var(--ah-brand)' }}>
                  Giriş yap
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
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
