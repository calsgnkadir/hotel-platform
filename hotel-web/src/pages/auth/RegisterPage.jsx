import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import { validateTurkeyPhone, formatTurkeyPhoneInput } from '../../utils/validation'
import DistrictNeighborhoodSelect from '../../components/DistrictNeighborhoodSelect'
import BackButton from '../../components/BackButton'
import GoogleSignInButton from '../../components/GoogleSignInButton'

/** RegisterPage — FAZ A.2 acik+teal yeniden yazim (DarkVeil ve tum altin
 *  gradientler kaldirildi; form logic + validasyon + step akisi aynen korundu). */

const ROLE_OPTIONS = [
  { value: 'CANDIDATE',      title: 'İş Arıyorum',                       desc: 'İstanbul\'daki otel, restoran ve kafelerde iş bul.' },
  { value: 'BUSINESS_OWNER', title: 'İşletmem için eleman arıyorum',      desc: 'Oteliniz, restoranınız veya kafeniz için aday bulun.' },
]

const BUSINESS_TYPES = [
  { value: 'HOTEL',      label: 'Otel' },
  { value: 'RESTAURANT', label: 'Restoran' },
  { value: 'CAFE',       label: 'Kafe' },
]

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedRole = location.state?.preselectedRole
  const prefillEmail = location.state?.prefillEmail
  const [step, setStep] = useState(preselectedRole ? 2 : 1)
  const [selectedRole, setSelectedRole] = useState(preselectedRole || null)

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: prefillEmail ? { email: prefillEmail } : {} })

  function goToStep2(role) { setSelectedRole(role); setStep(2) }

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
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5"
                 style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)' }}>
              <span className="text-[11px] font-semibold" style={{ color: 'var(--ah-brand)' }}>Ücretsiz Kayıt</span>
            </div>
            <h1 style={{
              fontSize: 'clamp(24px, 3.5vw, 30px)', lineHeight: 1.15, fontWeight: 800,
              letterSpacing: '-0.02em', color: 'var(--ah-ink)',
            }}>
              AjansHotel'e katıl
            </h1>
            <p className="text-[13.5px] mt-2" style={{ color: 'var(--ah-ink-3)' }}>
              İstanbul'un iş platformu
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6 max-w-md mx-auto">
            {[1, 2].map(n => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={step >= n
                    ? { background: 'var(--ah-brand)', color: '#ffffff' }
                    : { background: 'var(--ah-card)', color: 'var(--ah-ink-4)', border: '1px solid var(--ah-line-2)' }}>
                  {n}
                </div>
                {n < 2 && (
                  <div className="flex-1 h-px" style={{ background: step > n ? 'var(--ah-brand)' : 'var(--ah-line)' }} />
                )}
              </div>
            ))}
            <span className="text-[10px] uppercase tracking-[0.06em] ml-1 font-semibold"
                  style={{ color: 'var(--ah-ink-4)' }}>
              {step === 1 ? 'Tür' : 'Bilgi'}
            </span>
          </div>

          <div className="card">
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="space-y-3">
                <GoogleSignInButton label="Google ile Aday Olarak Kayıt" />

                <div className="flex items-center gap-3 py-1">
                  <span className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
                  <span className="text-[10px] uppercase tracking-[0.06em] font-semibold" style={{ color: 'var(--ah-ink-4)' }}>
                    veya rol seç
                  </span>
                  <span className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
                </div>

                {ROLE_OPTIONS.map((opt, i) => (
                  <button key={opt.value} type="button" onClick={() => goToStep2(opt.value)}
                    className="w-full flex items-center gap-3 p-4 rounded-lg transition-colors text-left group"
                    style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--ah-brand)'; e.currentTarget.style.background = 'var(--ah-brand-soft)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--ah-line)'; e.currentTarget.style.background = 'var(--ah-page)' }}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                         style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line-2)', color: 'var(--ah-brand)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[14.5px] truncate" style={{ color: 'var(--ah-ink)' }}>{opt.title}</div>
                      <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>{opt.desc}</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="var(--ah-ink-4)" strokeWidth={2.2} className="w-4 h-4 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                ))}

                <p className="text-[12.5px] text-center mt-5" style={{ color: 'var(--ah-ink-3)' }}>
                  Zaten hesabın var mı?{' '}
                  <Link to="/login" className="font-bold hover:underline" style={{ color: 'var(--ah-brand)' }}>
                    Giriş yap
                  </Link>
                </p>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="text-[12.5px] font-semibold hover:underline flex items-center gap-1"
                    style={{ color: 'var(--ah-ink-3)' }}>
                    ← Geri
                  </button>
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)', border: '1px solid var(--ah-line)' }}>
                    {selectedRole === 'CANDIDATE' ? 'Aday' : 'İşletme Sahibi'}
                  </span>
                </div>

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
                  <label className="label">Telefon <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                  <input type="tel" className="input" placeholder="0555 123 45 67" maxLength={14}
                    {...register('phone', {
                      validate: v => validateTurkeyPhone(v, { mobileOnly: true }) || true,
                      onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                    })} />
                  {errors.phone && <p className="error-text">{errors.phone.message}</p>}
                </div>

                {/* CANDIDATE extra */}
                {selectedRole === 'CANDIDATE' && (
                  <div className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--ah-line)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--ah-brand)' }}>
                      Aday Bilgileri
                    </p>
                    <div>
                      <label className="label">Şehir</label>
                      <select className="input" {...register('city')}>
                        <option value="Istanbul">İstanbul</option>
                      </select>
                      <p className="text-[11.5px] mt-1" style={{ color: 'var(--ah-ink-4)' }}>Platform şu an İstanbul'a özeldir</p>
                    </div>
                  </div>
                )}

                {/* BUSINESS_OWNER extra */}
                {selectedRole === 'BUSINESS_OWNER' && (
                  <div className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--ah-line)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--ah-brand)' }}>
                      İşletme Bilgileri
                    </p>

                    <div>
                      <label className="label">İşletme Adı</label>
                      <input type="text" className="input" placeholder="Grand Hotel İstanbul"
                        {...register('businessName', { required: 'İşletme adı zorunlu' })} />
                      {errors.businessName && <p className="error-text">{errors.businessName.message}</p>}
                    </div>

                    <div>
                      <label className="label">İşletme Türü</label>
                      <div className="grid grid-cols-3 gap-2">
                        {BUSINESS_TYPES.map(({ value, label }) => {
                          const active = watch('businessType') === value
                          return (
                            <label key={value} className="cursor-pointer text-center p-3 rounded-lg transition-colors"
                              style={active
                                ? { background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-brand)', color: 'var(--ah-brand)' }
                                : { background: 'var(--ah-card)', border: '1px solid var(--ah-line-2)', color: 'var(--ah-ink-2)' }}>
                              <input type="radio" value={value}
                                {...register('businessType', { required: 'İşletme türü seçin' })}
                                className="sr-only" />
                              <span className="text-[13px] font-semibold">{label}</span>
                            </label>
                          )
                        })}
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
                      <label className="label">İşletme Telefonu <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                      <input type="tel" className="input" placeholder="0212 555 12 34" maxLength={14}
                        {...register('businessPhone', {
                          validate: v => validateTurkeyPhone(v) || true,
                          onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                        })} />
                      {errors.businessPhone && <p className="error-text">{errors.businessPhone.message}</p>}
                    </div>

                    <div>
                      <label className="label">Website <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                      <input type="url" className="input" placeholder="https://www.isletmem.com" {...register('website')} />
                    </div>

                    <div>
                      <label className="label">Açıklama <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                      <textarea className="input resize-none h-20 text-sm"
                        placeholder="İşletmenizi kısaca tanıtın..."
                        {...register('description')} />
                    </div>
                  </div>
                )}

                {/* KVKK + Terms onay */}
                <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed pt-2"
                       style={{ color: 'var(--ah-ink-3)' }}>
                  <input type="checkbox" className="mt-0.5" style={{ accentColor: 'var(--ah-brand)' }}
                    {...register('acceptedTerms', { required: 'Devam etmek için onaylamalısın' })} />
                  <span>
                    <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: 'var(--ah-brand)' }}>Kullanım Şartları</Link>
                    {' '}ve{' '}
                    <Link to="/kvkk" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline" style={{ color: 'var(--ah-brand)' }}>KVKK Aydınlatma Metni</Link>
                    'ni okudum, kabul ediyorum.
                  </span>
                </label>
                {errors.acceptedTerms && (
                  <p className="text-[11px] -mt-2" style={{ color: 'var(--ah-danger)' }}>{errors.acceptedTerms.message}</p>
                )}

                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Kaydediliyor...' : 'Hesap Oluştur'}
                </button>

                <p className="text-[12.5px] text-center" style={{ color: 'var(--ah-ink-3)' }}>
                  Zaten hesabın var mı?{' '}
                  <Link to="/login" className="font-bold hover:underline" style={{ color: 'var(--ah-brand)' }}>
                    Giriş yap
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
