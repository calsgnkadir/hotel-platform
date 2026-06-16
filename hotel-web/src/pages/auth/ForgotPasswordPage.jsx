import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import ThemeToggle from '../../components/ThemeToggle'
import BackButton from '../../components/BackButton'
import DarkVeil from '../../components/DarkVeil'

/**
 * #80: Şifremi unuttum — email girilir, link gönderilir.
 * Bilinmeyen email'de de "başarılı" mesajı gösterilir (enumeration koruması).
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
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: '#0c1726' }}>
      {/* FAZ 5.4 — DarkVeil */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <DarkVeil hueShift={285} noiseIntensity={0.02} speed={0.4} warpAmount={0.3} />
      </div>
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10,6,24,0.7) 90%)' }} />

      {/* Neon üst hat */}
      <div className="relative z-10 neon-strip" />

      {/* Arka plan spotlight */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[60%] h-96 rounded-full bg-brand-600/15 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      {/* Üst bar */}
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

      {/* İçerik */}
      <main className="relative flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white border border-cream-300 rounded-full px-3 py-1 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-terra-400 animate-glow-pulse" />
              <span className="text-[11px] uppercase tracking-widest text-ink-700">Şifre Sıfırlama</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              <span className="block">Şifreni</span>
              <span className="block bg-gradient-to-r from-brand-700 to-terra-500 bg-clip-text text-transparent">Unuttun mu?</span>
            </h1>
            <p className="text-[13px] text-ink-500 mt-3">
              Email adresini gir, sıfırlama linki gönderelim.
            </p>
          </div>

          {sent ? (
            <div className="auth-card text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={2} stroke="currentColor" className="w-7 h-7 text-brand-700">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white">Email gönderildi</h2>
              <p className="text-[13px] text-ink-500 leading-relaxed">
                Eğer <span className="font-mono text-brand-700">{getValues('email')}</span> kayıtlı bir
                hesabaysa, birkaç dakika içinde inbox'una <strong className="text-white">"AjansHotel — Şifre Sıfırlama"</strong> başlıklı bir mail
                gelecek. Spam klasörünü de kontrol et.
              </p>
              <p className="text-[11px] text-ink-400 italic">
                Bağlantı 1 saat geçerli.
              </p>
              <Link to="/login" className="btn-secondary !w-auto inline-flex mt-2">
                Giriş Sayfasına Dön
              </Link>
            </div>
          ) : (
            <div className="auth-card">
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

              <p className="text-[12px] text-center text-ink-500 mt-6">
                Şifreni hatırladın mı?{' '}
                <Link to="/login" className="font-bold text-brand-700 hover:text-brand-700 transition-colors">
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
