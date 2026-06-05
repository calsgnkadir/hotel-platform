import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { extractErrorMessage } from '../../api/client'
import { validateTurkeyPhone, formatTurkeyPhoneInput } from '../../utils/validation'
import DistrictNeighborhoodSelect from '../../components/DistrictNeighborhoodSelect'

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
    <div className="auth-bg">
      <div className="auth-card" style={{ maxWidth: '500px' }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3 bg-brand-700">
            <span className="text-white text-xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">AjansHotel'e Katıl</h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">İstanbul'un iş platformu</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2].map(n => (
            <div key={n} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${step >= n ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                {n}
              </div>
              {n < 2 && <div className={`flex-1 h-0.5 rounded transition-colors ${step > n ? 'bg-brand-400' : 'bg-slate-200 dark:bg-slate-700'}`} />}
            </div>
          ))}
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">
            {step === 1 ? 'Hesap türü' : 'Bilgileriniz'}
          </span>
        </div>

        {/* ── STEP 1: Role selection ── */}
        {step === 1 && (
          <div className="space-y-3">
            {ROLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => goToStep2(opt.value)}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200
                           hover:border-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-all duration-200 text-left group"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-slate-100 group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors">
                  {opt.icon}
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{opt.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                </div>
                <span className="ml-auto text-slate-400 group-hover:text-brand-600 transition-colors">→</span>
              </button>
            ))}

            <p className="text-sm text-center text-slate-500 mt-4">
              Zaten hesabın var mı?{' '}
              <Link to="/login" className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">
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
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
                ← Geri
              </button>
              <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#d1fae5', color: '#047857' }}>
                {selectedRole === 'CANDIDATE' ? 'Aday' : 'İşletme Sahibi'}
              </span>
            </div>

            {/* Common fields */}
            <div>
              <label className="label">Ad Soyad</label>
              <input type="text" className="input" placeholder="Adınız Soyadınız"
                {...register('fullName', { required: 'Ad soyad zorunlu' })} />
              {errors.fullName && <p className="error-text">⚠ {errors.fullName.message}</p>}
            </div>

            <div>
              <label className="label">E-posta</label>
              <input type="email" className="input" placeholder="ornek@email.com"
                {...register('email', {
                  required: 'E-posta zorunlu',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Geçerli bir e-posta girin' },
                })} />
              {errors.email && <p className="error-text">⚠ {errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Şifre</label>
              <input type="password" className="input" placeholder="En az 8 karakter"
                {...register('password', {
                  required: 'Şifre zorunlu',
                  minLength: { value: 8, message: 'En az 8 karakter olmalı' },
                })} />
              {errors.password && <p className="error-text">⚠ {errors.password.message}</p>}
            </div>

            <div>
              <label className="label">Telefon <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
              <input type="tel" className="input" placeholder="0555 123 45 67" maxLength={14}
                {...register('phone', {
                  validate: v => validateTurkeyPhone(v, { mobileOnly: true }) || true,
                  onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                })} />
              {errors.phone && <p className="error-text">⚠ {errors.phone.message}</p>}
            </div>

            {/* ── CANDIDATE extra fields ── */}
            {selectedRole === 'CANDIDATE' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">Aday Bilgileri</p>

                <div>
                  <label className="label">Şehir</label>
                  <select className="input" {...register('city')}>
                    <option value="Istanbul">İstanbul</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1">Platform şu an İstanbul'a özeldir</p>
                </div>

              </div>
            )}

            {/* ── BUSINESS_OWNER extra fields ── */}
            {selectedRole === 'BUSINESS_OWNER' && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-1">İşletme Bilgileri</p>

                <div>
                  <label className="label">İşletme Adı</label>
                  <input type="text" className="input" placeholder="Grand Hotel İstanbul"
                    {...register('businessName', { required: 'İşletme adı zorunlu' })} />
                  {errors.businessName && <p className="error-text">⚠ {errors.businessName.message}</p>}
                </div>

                <div>
                  <label className="label">İşletme Türü</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BUSINESS_TYPES.map(({ value, label }) => (
                      <label key={value}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 cursor-pointer text-center transition-all
                          ${watch('businessType') === value
                            ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
                            : 'border-slate-200 dark:border-slate-700 hover:border-brand-400'}`}
                      >
                        <input type="radio" value={value}
                          {...register('businessType', { required: 'İşletme türü seçin' })}
                          className="sr-only" />
                        <span className="text-lg">
                          {value === 'HOTEL' ? '' : value === 'RESTAURANT' ? '' : ''}
                        </span>
                        <span className={`text-xs font-semibold ${watch('businessType') === value ? 'text-brand-700' : 'text-slate-600 dark:text-slate-300'}`}>
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors.businessType && <p className="error-text">⚠ {errors.businessType.message}</p>}
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
                {errors.district && <p className="error-text">⚠ {errors.district.message}</p>}

                <div>
                  <label className="label">Adres</label>
                  <input type="text" className="input" placeholder="Cadde, sokak, bina no..."
                    {...register('address', { required: 'Adres zorunlu' })} />
                  {errors.address && <p className="error-text">⚠ {errors.address.message}</p>}
                </div>

                <div>
                  <label className="label">İşletme Telefonu <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
                  <input type="tel" className="input" placeholder="0212 555 12 34" maxLength={14}
                    {...register('businessPhone', {
                      validate: v => validateTurkeyPhone(v) || true,
                      onChange: e => { e.target.value = formatTurkeyPhoneInput(e.target.value) },
                    })} />
                  {errors.businessPhone && <p className="error-text">⚠ {errors.businessPhone.message}</p>}
                </div>

                <div>
                  <label className="label">Website <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
                  <input type="url" className="input" placeholder="https://www.isletmem.com" {...register('website')} />
                </div>

                <div>
                  <label className="label">Açıklama <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
                  <textarea className="input resize-none h-20 text-sm"
                    placeholder="İşletmenizi kısaca tanıtın..."
                    {...register('description')} />
                </div>
              </div>
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
              ) : 'Hesap Oluştur →'}
            </button>

            <p className="text-sm text-center text-slate-500">
              Zaten hesabın var mı?{' '}
              <Link to="/login" className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">
                Giriş yap
              </Link>
            </p>
            <p className="text-xs text-center text-slate-400 mt-2">
              Kayıt olarak{' '}
              <Link to="/kvkk" className="underline hover:text-brand-700 dark:hover:text-brand-400">
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
