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
import TermsConsent from '../../components/TermsConsent'
import { useGoogleSignIn } from '../../lib/authProviders'
import { consentPayload, rememberOAuthConsent } from '../../lib/legal'
import { homeForRole, rememberReturn, returnPathOf } from '../../lib/authReturn'

// Sunucudaki kurallarla aynı: şifre 8+ karakter, 1 harf + 1 rakam; web sitesi yalnız http(s)
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/
const WEBSITE_RULE = /^https?:\/\/[^\s/@]+\S*$/i

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
  // Paylaşılan ilandan / korumalı sayfadan gelindiyse kayıttan sonra oraya dönülür
  const from = location.state?.from
  const [step, setStep] = useState(preselectedRole ? 2 : 1)
  const [selectedRole, setSelectedRole] = useState(preselectedRole || null)
  const google = useGoogleSignIn()  // Google ayarlı değilse buton + ayraç gizli
  // Kullanım Şartları onayı — adım 1 (Google) ve adım 2 (form) aynı durumu paylaşır.
  // Giriş penceresinde (AuthModal) işaretlendiyse buraya taşınır.
  const [termsAccepted, setTermsAccepted] = useState(!!location.state?.termsAccepted)
  const [termsError, setTermsError] = useState('')

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: prefillEmail ? { email: prefillEmail } : {} })

  function goToStep2(role) { setSelectedRole(role); setStep(2) }

  function onTermsChange(v) {
    setTermsAccepted(v)
    if (v) setTermsError('')
  }

  // Google'a gitmeden önce: onay + dönüş yolu sekmede saklanır (/oauth-success okur)
  function beforeGoogle() {
    rememberOAuthConsent()
    rememberReturn(from)
  }

  async function onSubmit(data) {
    if (!termsAccepted) return  // hata submitWithTerms'te gösterildi
    const payload = { ...data, role: selectedRole, ...consentPayload() }
    try {
      const result = await registerUser(payload)
      toast.success('Hesabın oluşturuldu.')
      navigate(returnPathOf(from) || homeForRole(result.role), { replace: true })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  // Onay kutusu alan hatalarıyla birlikte doğrulanır (hepsi aynı anda görünsün)
  function submitWithTerms(e) {
    if (!termsAccepted) setTermsError('Devam etmek için Kullanım Şartları\'nı kabul etmelisin.')
    return handleSubmit(onSubmit)(e)
  }

  return (
    <div className="min-h-screen ah-surface flex flex-col"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <header className="border-b" style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <BackButton to="/login" label="Girişe dön" />
          <span className="hidden sm:block w-px h-5" style={{ background: 'var(--ah-line-2)' }} />
          <Link to="/" className="hidden sm:flex items-baseline gap-2">
            <span className="font-bold text-base" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>Kadrom</span>
            <span className="type-caption" style={{ color: 'var(--ah-ink-3)' }}>İstanbul</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5"
                 style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)' }}>
              <span className="type-badge" style={{ color: 'var(--ah-brand)' }}>Ücretsiz kayıt</span>
            </div>
            <h1 style={{
              fontSize: 'clamp(24px, 3.5vw, 30px)', lineHeight: 1.15, fontWeight: 800,
              letterSpacing: '-0.02em', color: 'var(--ah-ink)',
            }}>
              Kadrom'a katıl
            </h1>
            <p className="text-[13.5px] mt-2" style={{ color: 'var(--ah-ink-3)' }}>
              İstanbul'da otel, restoran ve kafelerde vardiyalı iş
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6 max-w-md mx-auto" aria-label={`Adım ${step} / 2`}>
            {[1, 2].map(n => (
              <div key={n} className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  aria-hidden="true"
                  style={step >= n
                    ? { background: 'var(--ah-brand)', color: 'var(--ah-card)' }
                    : { background: 'var(--ah-card)', color: 'var(--ah-ink-3)', border: '1px solid var(--ah-line-2)' }}>
                  {n}
                </div>
                {n < 2 && (
                  <div className="flex-1 h-px" style={{ background: step > n ? 'var(--ah-brand)' : 'var(--ah-line)' }} />
                )}
              </div>
            ))}
            <span className="type-label ml-1" style={{ color: 'var(--ah-ink-3)' }}>
              {step === 1 ? 'Hesap türü' : 'Bilgiler'}
            </span>
          </div>

          <div className="card">
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <div className="space-y-3">
                {/* Google + ayrac — yalnızca Google girişi gerçekten ayarlıysa.
                    Google ile kayıt yalnız ADAY hesabı açar (işletme e-postayla kayıt olur).
                    Kullanım Şartları işaretlenmeden düğme pasif: e-postalı kayıttaki
                    açık onayla aynı standart ("devam ederek kabul" sayılmaz). */}
                {google && (
                  <>
                    <div className="rounded-lg p-4 space-y-3"
                         style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)' }}>
                      <div>
                        <p className="type-subhead" style={{ color: 'var(--ah-ink)' }}>İş arıyorsan en hızlısı</p>
                        <p className="type-caption mt-0.5">Google hesabınla aday olarak saniyeler içinde kayıt ol.</p>
                      </div>
                      <TermsConsent id="register-terms-google" checked={termsAccepted} onChange={onTermsChange} compact />
                      <GoogleSignInButton label="Google ile aday olarak kayıt ol"
                        disabled={!termsAccepted}
                        disabledHint="Önce Kullanım Şartları'nı kabul et"
                        onBeforeRedirect={beforeGoogle} />
                    </div>
                    <div className="flex items-center gap-3 py-1">
                      <span className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
                      <span className="type-caption" style={{ color: 'var(--ah-ink-3)' }}>
                        veya hesap türünü seç
                      </span>
                      <span className="flex-1 h-px" style={{ background: 'var(--ah-line)' }} />
                    </div>
                  </>
                )}

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
                  <Link to="/login" state={from ? { from } : undefined} className="font-bold hover:underline" style={{ color: 'var(--ah-brand)' }}>
                    Giriş yap
                  </Link>
                </p>
              </div>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <form onSubmit={submitWithTerms} className="space-y-4" noValidate>
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setStep(1)}
                    className="btn-ghost !w-auto !px-2 -ml-2">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2}
                         stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    Hesap türü
                  </button>
                  <span className="ml-auto type-badge px-2.5 py-1 rounded-full"
                        style={{ background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)', border: '1px solid var(--ah-line)' }}>
                    {selectedRole === 'CANDIDATE' ? 'Aday' : 'İşletme sahibi'}
                  </span>
                </div>

                <div>
                  <label htmlFor="register-fullName" className="label">Ad Soyad</label>
                  <input id="register-fullName" type="text" className="input" placeholder="Adınız Soyadınız"
                    {...register('fullName', { required: 'Ad soyad zorunlu' })} />
                  {errors.fullName && <p className="error-text">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label htmlFor="register-email" className="label">E-posta</label>
                  <input id="register-email" type="email" className="input" placeholder="ornek@email.com"
                    {...register('email', {
                      required: 'E-posta zorunlu',
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
                    })} />
                  {errors.email && <p className="error-text">{errors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="register-password" className="label">Şifre</label>
                  <input id="register-password" type="password" className="input" placeholder="En az 8 karakter"
                    {...register('password', {
                      required: 'Şifre zorunlu',
                      minLength: { value: 8, message: 'En az 8 karakter olmalı' },
                      pattern: { value: PASSWORD_RULE, message: 'En az 1 harf ve 1 rakam içermeli' },
                    })} />
                  {errors.password && <p className="error-text">{errors.password.message}</p>}
                </div>

                <div>
                  <label htmlFor="register-phone" className="label">Telefon <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                  <input id="register-phone" type="tel" className="input" placeholder="0555 123 45 67" maxLength={14}
                    {...register('phone', {
                      validate: v => validateTurkeyPhone(v, { mobileOnly: true }) || true,
                      onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                    })} />
                  {errors.phone && <p className="error-text">{errors.phone.message}</p>}
                </div>

                {/* CANDIDATE extra */}
                {selectedRole === 'CANDIDATE' && (
                  <div className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--ah-line)' }}>
                    <p className="type-label" style={{ color: 'var(--ah-ink)' }}>
                      Aday bilgileri
                    </p>
                    <div>
                      <label htmlFor="register-city" className="label">Şehir</label>
                      <select id="register-city" className="input" {...register('city')}>
                        <option value="Istanbul">İstanbul</option>
                      </select>
                      <p className="text-[11.5px] mt-1" style={{ color: 'var(--ah-ink-4)' }}>Platform şu an İstanbul'a özeldir</p>
                    </div>
                  </div>
                )}

                {/* BUSINESS_OWNER extra */}
                {selectedRole === 'BUSINESS_OWNER' && (
                  <div className="space-y-4 pt-4" style={{ borderTop: '1px solid var(--ah-line)' }}>
                    <p className="type-label" style={{ color: 'var(--ah-ink)' }}>
                      İşletme bilgileri
                    </p>

                    <div>
                      <label htmlFor="register-businessName" className="label">İşletme adı</label>
                      <input id="register-businessName" type="text" className="input" placeholder="Grand Hotel İstanbul"
                        {...register('businessName', { required: 'İşletme adı zorunlu' })} />
                      {errors.businessName && <p className="error-text">{errors.businessName.message}</p>}
                    </div>

                    <div>
                      <span id="register-businessType-label" className="label">İşletme türü</span>
                      <div role="group" aria-labelledby="register-businessType-label" className="grid grid-cols-3 gap-2">
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
                      <label htmlFor="register-address" className="label">Adres</label>
                      <input id="register-address" type="text" className="input" placeholder="Cadde, sokak, bina no..."
                        {...register('address', { required: 'Adres zorunlu' })} />
                      {errors.address && <p className="error-text">{errors.address.message}</p>}
                    </div>

                    <div>
                      <label htmlFor="register-businessPhone" className="label">İşletme telefonu <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                      <input id="register-businessPhone" type="tel" className="input" placeholder="0212 555 12 34" maxLength={14}
                        {...register('businessPhone', {
                          validate: v => validateTurkeyPhone(v) || true,
                          onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                        })} />
                      {errors.businessPhone && <p className="error-text">{errors.businessPhone.message}</p>}
                    </div>

                    <div>
                      <label htmlFor="register-website" className="label">Web sitesi <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                      <input id="register-website" type="url" className="input" placeholder="https://www.isletmem.com"
                        {...register('website', {
                          pattern: { value: WEBSITE_RULE, message: 'Adres http:// veya https:// ile başlamalı' },
                        })} />
                      {errors.website && <p className="error-text">{errors.website.message}</p>}
                    </div>

                    <div>
                      <label htmlFor="register-description" className="label">Açıklama <span className="font-normal" style={{ color: 'var(--ah-ink-4)' }}>(opsiyonel)</span></label>
                      <textarea id="register-description" className="input resize-none h-20 text-sm"
                        placeholder="İşletmenizi kısaca tanıtın..."
                        {...register('description')} />
                    </div>
                  </div>
                )}

                {/* Kullanım Şartları: zorunlu onay kutusu. KVKK: yalnız bilgilendirme. */}
                <div className="pt-4" style={{ borderTop: '1px solid var(--ah-line)' }}>
                  <TermsConsent id="register-terms" checked={termsAccepted} onChange={onTermsChange} error={termsError} />
                </div>

                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Hesap oluşturuluyor...' : 'Hesap oluştur'}
                </button>

                <p className="text-[12.5px] text-center" style={{ color: 'var(--ah-ink-3)' }}>
                  Zaten hesabın var mı?{' '}
                  <Link to="/login" state={from ? { from } : undefined} className="font-bold hover:underline" style={{ color: 'var(--ah-brand)' }}>

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
