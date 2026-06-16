import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import BackButton from '../../components/BackButton'
import GoogleSignInButton from '../../components/GoogleSignInButton'
import HeroHeading from '../../components/HeroHeading'

/**
 * Login v3 — Hospitality Concierge dili:
 *  - Krem zemin + beyaz card
 *  - Fraunces "giriş yap" başlığı
 *  - Terracotta CTA
 */
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
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#0c1726' }}>
      {/* Calm radial halo arka plan */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{
             background:
               'radial-gradient(ellipse 700px 500px at 15% 25%, rgba(30, 58, 95, 0.20) 0%, transparent 60%),' +
               'radial-gradient(ellipse 600px 500px at 85% 75%, rgba(212, 168, 83, 0.10) 0%, transparent 60%)',
           }} />

      {/* Geri butonu — sol üst, sabit */}
      <div className="absolute top-4 left-4 z-30">
        <BackButton to="/" label="Geri" />
      </div>

      {/* 2-sutun split-screen */}
      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* SOL — Form */}
        <main className="flex items-center justify-center px-4 sm:px-10 py-16">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <Link to="/" className="inline-flex items-baseline gap-2 mb-10">
                <span className="font-bebas font-bold text-2xl tracking-wider text-white">AJANSHOTEL</span>
                <span className="text-[9px] uppercase tracking-[0.18em]" style={{ color: '#fde9a5' }}>istanbul</span>
              </Link>
              <HeroHeading size="sm" align="left" className="hero-glow !leading-none">
                <span className="text-white">Giriş Yap</span>
              </HeroHeading>
              <p className="text-sm mt-3" style={{ color: '#8ba9d2' }}>
                Kaldığın yerden devam et.
              </p>
            </div>

            <div className="space-y-5">
            <GoogleSignInButton label="Google ile Devam Et" />

            <div className="flex items-center gap-3 my-5">
              <span className="flex-1 h-px" style={{ background: 'rgba(212, 168, 83, 0.2)' }} />
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#8ba9d2' }}>veya</span>
              <span className="flex-1 h-px" style={{ background: 'rgba(212, 168, 83, 0.2)' }} />
            </div>

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
                  <p className="error-text">{errors.email.message}</p>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="label !mb-0">Şifre</label>
                  <Link to="/forgot-password"
                    className="text-[11px] font-semibold text-brand-700 hover:text-brand-800 transition-colors">
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
                  <p className="error-text">{errors.password.message}</p>
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

            <p className="text-[12px] text-center mt-6" style={{ color: '#fde9a5' }}>
              Hesabın yok mu?{' '}
              <Link to="/register" className="font-bold transition-colors hover:underline"
                    style={{ color: '#f7c43c' }}>
                Ücretsiz kayıt ol
              </Link>
            </p>
          </div>

          <div className="mt-8 rounded-xl p-4 border"
               style={{ background: 'rgba(212, 168, 83, 0.05)', borderColor: 'rgba(212, 168, 83, 0.12)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: '#fde9a5' }}>
              Demo Hesaplar
            </p>
            <div className="space-y-1.5 text-[12px] font-mono">
              <DemoRow k="Aday"     v="demo-aday1@test.com" />
              <DemoRow k="İşletme"  v="demo-isletme1@test.com" />
              <DemoRow k="Şifre"    v="Demo1234!" />
            </div>
          </div>
          </div>
        </main>

        {/* SAĞ — Hospitality value-prop paneli (kendi orijinal kompozisyon) */}
        <aside className="hidden lg:flex relative items-center justify-center px-12 py-16 border-l"
               style={{ borderColor: 'rgba(212, 168, 83, 0.10)' }}>
          {/* Sag panel'e ozel halo */}
          <div aria-hidden className="absolute inset-0 pointer-events-none"
               style={{
                 background:
                   'radial-gradient(circle 500px at 60% 40%, rgba(212, 168, 83, 0.14) 0%, transparent 60%),' +
                   'radial-gradient(circle 400px at 30% 80%, rgba(212, 168, 83, 0.10) 0%, transparent 60%)',
               }} />

          <div className="relative z-10 max-w-md">
            {/* Canli rozet */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8"
                 style={{ background: 'rgba(212, 168, 83, 0.10)', border: '1px solid rgba(212, 168, 83, 0.25)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f7c43c' }} />
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#fde9a5' }}>
                İstanbul Canlı
              </span>
            </div>

            {/* Buyuk Bebas baslik */}
            <HeroHeading size="lg" align="left" className="!leading-[0.92]">
              <span className="block text-white">Şehrin</span>
              <span className="block hero-glow" style={{
                background: 'linear-gradient(135deg, #f7c43c 0%, #d4a853 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Vardiyası</span>
              <span className="block text-white">Hiç Durmuyor</span>
            </HeroHeading>

            <p className="mt-6 mb-10 text-sm leading-relaxed" style={{ color: '#fde9a5' }}>
              Otel, restoran, kafe — sabah müsait olduğun saatler birinin
              akşam doldurmaya çalıştığı bir vardiya. Aradaki köprü AjansHotel.
            </p>

            {/* 3 stat row — Bebas + ince mor cizgi */}
            <div className="space-y-5">
              {[
                { num: '127',   label: 'Aday bu hafta vardiyaya çıktı' },
                { num: '8 sa',  label: 'Ortalama ilk eşleşme süresi' },
                { num: '%94',   label: 'Başvuru sonrası memnuniyet (son 30 gün)' },
              ].map((s, i) => (
                <div key={i} className="flex items-baseline gap-4 pb-4"
                     style={{ borderBottom: i < 2 ? '1px solid rgba(212, 168, 83, 0.12)' : 'none' }}>
                  <span className="font-bebas text-4xl tracking-wider"
                        style={{
                          color: '#ffffff',
                          textShadow: '0 0 18px rgba(212, 168, 83, 0.35)',
                          minWidth: '90px',
                        }}>
                    {s.num}
                  </span>
                  <span className="text-xs uppercase tracking-wider" style={{ color: '#8ba9d2' }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Imza */}
            <p className="mt-12 text-[10px] uppercase tracking-[0.3em]" style={{ color: '#234a82' }}>
              AjansHotel · İstanbul Hospitality Network
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function DemoRow({ k, v }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-400 uppercase tracking-wider text-[10px]">{k}</span>
      <code className="text-ink-800">{v}</code>
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
