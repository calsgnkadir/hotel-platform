import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import { validateTurkeyPhone, formatTurkeyPhoneInput } from '../../utils/validation'
import DistrictNeighborhoodSelect from '../../components/DistrictNeighborhoodSelect'
import BackButton from '../../components/BackButton'
import ThemeToggle from '../../components/ThemeToggle'
import GoogleSignInButton from '../../components/GoogleSignInButton'
import DarkVeil from '../../components/DarkVeil'

const ROLE_OPTIONS = [
  {
    value: 'CANDIDATE',
    icon: '',
    title: 'İş Arıyorum',
    desc: 'İstanbul\'daki otellerde, restoranlarda ve kafelerde iş bul',
  },
  {
    value: 'BUSINESS_OWNER',
    icon: '',
    title: 'İşletmem için eleman arıyorum',
    desc: 'Oteliniz, restoranınız veya kafeniz için aday bulun',
  },
]

const BUSINESS_TYPES = [
  { value: 'HOTEL',      label: 'Otel' },
  { value: 'RESTAURANT', label: 'Restoran' },
  { value: 'CAFE',       label: 'Kafe' },
]

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [selectedRole, setSelectedRole] = useState(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm()

  function goToStep2(role) {
    setSelectedRole(role)
    setStep(2)
  }

  async function onSubmit(data) {
    const payload = { ...data, role: selectedRole }
    try {
      const result = await registerUser(payload)
      toast.success('Hesabınız başarıyla oluşturuldu!')
      navigate(result.role === 'CANDIDATE' ? '/candidate' : '/business', { replace: true })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className="auth-bg relative overflow-hidden" style={{ background: '#0c1726' }}>
      {/* FAZ 5.4 — DarkVeil arka plan + vinyet */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <DarkVeil hueShift={285} noiseIntensity={0.02} speed={0.4} warpAmount={0.3} />
      </div>
      <div aria-hidden className="fixed inset-0 z-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse at center, transparent 0%, rgba(10,6,24,0.7) 90%)' }} />

      {/* Neon üst hat */}
      <div className="fixed top-0 left-0 right-0 z-50 neon-strip pointer-events-none" />

      {/* Geri butonu + tema toggle — sabit üst köşeler */}
      <div className="fixed top-3 left-4 z-40">
        <BackButton to="/login" label="Girişe Dön" />
      </div>
      <div className="fixed top-3 right-4 z-40">
        <ThemeToggle />
      </div>

      <div className="auth-card relative z-10" style={{ maxWidth: '520px' }}>
        {/* Header — logosuz */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 bg-white border border-cream-300 rounded-full px-3 py-1 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-terra-400 animate-glow-pulse" />
            <span className="text-[10px] uppercase tracking-widest text-ink-700">Ücretsiz Kayıt</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase text-white">
            <span className="block">AjansHotel'e</span>
            <span className="block bg-gradient-to-r from-brand-700 to-terra-500 bg-clip-text text-transparent">Katıl</span>
          </h1>
          <p className="text-[12px] text-ink-500 mt-3">İstanbul'un iş platformu</p>
        </div>

        {/* Step indicator — pill stili */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(n => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all
                ${step >= n
                  ? 'text-white shadow-glow-sm'
                  : 'bg-cream-200 text-ink-400 border border-cream-300'}`}
                style={step >= n ? { background: 'linear-gradient(135deg, #047857, #10b981)' } : {}}>
                {n}
              </div>
              {n < 2 && <div className={`flex-1 h-0.5 rounded transition-colors ${step > n ? 'bg-emerald-500' : 'bg-slate-700'}`} />}
            </div>
          ))}
          <span className="text-[10px] uppercase tracking-widest text-ink-400 ml-1 font-bold">
            {step === 1 ? 'Tür' : 'Bilgi'}
          </span>
        </div>

        {/* ── STEP 1: Role selection — pill kartlar ── */}
        {step === 1 && (
          <div className="space-y-3">
            {/* #92: Google ile kayıt — direkt aday rolüyle açar */}
            <GoogleSignInButton label="Google ile Aday Olarak Kayıt" />

            <div className="flex items-center gap-3 py-1">
              <span className="flex-1 h-px bg-slate-700" />
              <span className="text-[10px] uppercase tracking-widest text-ink-400 font-semibold">veya rol seç</span>
              <span className="flex-1 h-px bg-slate-700" />
            </div>

            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => goToStep2(opt.value)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border border-cream-300
                           bg-white/40 hover:bg-white hover:border-brand-600/60
                           transition-all duration-200 text-left group"
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0
                                bg-cream-200 text-ink-400 group-hover:text-brand-700 transition-colors">
                  {opt.value === 'CANDIDATE' ? '01' : '02'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-white truncate">{opt.title}</div>
                  <div className="text-[11px] text-ink-400 mt-0.5 truncate">{opt.desc}</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-3.5 h-3.5 text-ink-600 group-hover:text-brand-700 group-hover:translate-x-1 transition-all"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>
              </button>
            ))}

            <p className="text-[12px] text-center text-ink-500 mt-5">
              Zaten hesabın var mı?{' '}
              <Link to="/login" className="font-bold text-brand-700 hover:text-brand-700 transition-colors">
                Giriş yap
              </Link>
            </p>
          </div>
        )}

        {/* ── STEP 2: Form fields ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Back button + role badge */}
            <div className="flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setStep(1)}
                className="text-[12px] font-semibold text-ink-500 hover:text-white flex items-center gap-1 transition-colors">
                Geri
              </button>
              <span className="ml-auto text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full text-emerald-300 bg-emerald-950/40 border border-emerald-900/60">
                {selectedRole === 'CANDIDATE' ? 'Aday' : 'İşletme Sahibi'}
              </span>
            </div>

            {/* Common fields */}
            <div>
              <label className="label">Ad Soyad</label>
              <input type="text" className="input" placeholder="Adınız Soyadınız"
                {...register('fullName', { required: 'Ad soyad zorunlu' })} />
              {errors.fullName && <p className="error-text">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="label">E-posta</label>
              <input type="email" className="input" placeholder="ornek@email.com"
                {...register('email', {
                  required: 'E-posta zorunlu',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
                })} />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Şifre</label>
              <input type="password" className="input" placeholder="En az 8 karakter"
                {...register('password', {
                  required: 'Şifre zorunlu',
                  minLength: { value: 8, message: 'En az 8 karakter olmalı' },
                })} />
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>

            <div>
              <label className="label">Telefon <span className="text-ink-500 font-normal">(opsiyonel)</span></label>
              <input type="tel" className="input" placeholder="0555 123 45 67" maxLength={14}
                {...register('phone', {
                  validate: v => validateTurkeyPhone(v, { mobileOnly: true }) || true,
                  onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                })} />
              {errors.phone && <p className="error-text">{errors.phone.message}</p>}
            </div>

            {/* ── CANDIDATE extra fields ── */}
            {selectedRole === 'CANDIDATE' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider pt-1">Aday Bilgileri</p>

                <div>
                  <label className="label">Şehir</label>
                  <select className="input" {...register('city')}>
                    <option value="Istanbul">İstanbul</option>
                  </select>
                  <p className="text-xs text-ink-500 mt-1">Platform şu an İstanbul'a özeldir</p>
                </div>

              </div>
            )}

            {/* ── BUSINESS_OWNER extra fields ── */}
            {selectedRole === 'BUSINESS_OWNER' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wider pt-1">İşletme Bilgileri</p>

                <div>
                  <label className="label">İşletme Adı</label>
                  <input type="text" className="input" placeholder="Grand Hotel İstanbul"
                    {...register('businessName', { required: 'İşletme adı zorunlu' })} />
                  {errors.businessName && <p className="error-text">{errors.businessName.message}</p>}
                </div>

                <div>
                  <label className="label">İşletme Türü</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BUSINESS_TYPES.map(({ value, label }) => (
                      <label key={value}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer text-center transition-all
                          ${watch('businessType') === value
                            ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                            : 'border-slate-200 dark:border-cream-300 hover:border-brand-400'}`}
                      >
                        <input type="radio" value={value}
                          {...register('businessType', { required: 'İşletme türü seçin' })}
                          className="sr-only" />
                        <span className="text-lg">
                          {value === 'HOTEL' ? '' : value === 'RESTAURANT' ? '' : ''}
                        </span>
                        <span className={`text-xs font-semibold ${watch('businessType') === value ? 'text-brand-700' : 'text-ink-600 dark:text-ink-700'}`}>
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.businessType && <p className="error-text">{errors.businessType.message}</p>}
                </div>

                <input type="hidden" {...register('district', { required: 'İlçe seçin' })} />
                <input type="hidden" {...register('neighborhood')} />
                <DistrictNeighborhoodSelect
                  district={watch('district') || ''}
                  neighborhood={watch('neighborhood') || ''}
                  onChange={({ district, neighborhood }) => {
                    setValue('district', district, { shouldValidate: true })
                    setValue('neighborhood', neighborhood)
                  }}
                  districtRequired />
                {errors.district && <p className="error-text">{errors.district.message}</p>}

                <div>
                  <label className="label">Adres</label>
                  <input type="text" className="input" placeholder="Cadde, sokak, bina no..."
                    {...register('address', { required: 'Adres zorunlu' })} />
                  {errors.address && <p className="error-text">{errors.address.message}</p>}
                </div>

                <div>
                  <label className="label">İşletme Telefonu <span className="text-ink-500 font-normal">(opsiyonel)</span></label>
                  <input type="tel" className="input" placeholder="0212 555 12 34" maxLength={14}
                    {...register('businessPhone', {
                      validate: v => validateTurkeyPhone(v) || true,
                      onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                    })} />
                  {errors.businessPhone && <p className="error-text">{errors.businessPhone.message}</p>}
                </div>

                <div>
                  <label className="label">Website <span className="text-ink-500 font-normal">(opsiyonel)</span></label>
                  <input type="url" className="input" placeholder="https://www.isletmem.com" {...register('website')} />
                </div>

                <div>
                  <label className="label">Açıklama <span className="text-ink-500 font-normal">(opsiyonel)</span></label>
                  <textarea className="input resize-none h-20 text-sm"
                    placeholder="İşletmenizi kısaca tanıtın..."
                    {...register('description')} />
                </div>
              </div>
            )}

            {/* FAZ I.4 — Kullanım Şartları + KVKK onay (zorunlu) */}
            <label className="flex items-start gap-2.5 text-[12px] text-ink-500 leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5 accent-brand-700"
                {...register('acceptedTerms', { required: 'Devam etmek için onaylamalısın' })}
              />
              <span>
                <Link to="/terms" target="_blank" rel="noopener noreferrer"
                      className="font-semibold text-brand-700 hover:underline">Kullanım Şartları</Link>
                {' '}ve{' '}
                <Link to="/kvkk" target="_blank" rel="noopener noreferrer"
                      className="font-semibold text-brand-700 hover:underline">KVKK Aydınlatma Metni</Link>
                'ni okudum, kabul ediyorum.
              </span>
            </label>
            {errors.acceptedTerms && (
              <p className="text-[11px] text-red-500 -mt-2">{errors.acceptedTerms.message}</p>
            )}

            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Kaydediliyor...
                </span>
              ) : 'Hesap Oluştur'}
            </button>

            <p className="text-sm text-center text-ink-400">
              Zaten hesabın var mı?{' '}
              <Link to="/login" className="font-semibold text-brand-700 dark:text-brand-700 hover:underline">
                Giriş yap
              </Link>
            </p>
            <p className="text-xs text-center text-ink-500 mt-2">
              Kayıt olarak{' '}
              <Link to="/kvkk" className="underline hover:text-brand-700 dark:hover:text-brand-700">
                KVKK Aydınlatma Metni
              </Link>
              'ni okuduğunu kabul edersin.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
