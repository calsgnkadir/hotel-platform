// FAZ 5.2 — CandidateDashboard'dan ayrildi (en buyuk tab — 366 satir)
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import ProfileCompletenessCard from '../../../components/ProfileCompletenessCard'
import { calculateCandidateCompleteness } from '../../../lib/profileCompleteness'
import AvatarCropModal from '../../../components/AvatarCropModal'
import { useConfirm } from '../../../lib/useConfirm'
import ChangePasswordCard from '../../../components/ChangePasswordCard'
import GdprCard from '../../../components/GdprCard'
import { SkeletonForm } from '../../../components/Skeleton'
import { Alert } from '../../../components/ui/Alert'
import AvailabilityBlocksEditor from '../../../components/AvailabilityBlocksEditor'
import { validateTurkeyPhone, formatTurkeyPhoneInput, validateAdultAge, birthDateBounds } from '../../../utils/validation'
import DocumentsTab from './DocumentsTab'   // Belgelerim Profilim'e tasindi
import {
  GENDER_LABELS, EDUCATION_LABELS, AVAILABILITY_LABELS, POSITION_LABELS
} from '../../../utils/labels'

export default function ProfileTab() {
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)  // Dalga G3 — Alert success goster
  const [form, setForm] = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    hotelApi.getCandidateProfile()
      .then(data => {
        setProfile(data)
        setForm({
          fullName:           data.fullName           || '',
          phone:              data.phone              || '',
          birthDate:          data.birthDate          || '',
          gender:             data.gender             || '',
          education:          data.education          || '',
          languages:          data.languages          || [],
          availabilityTypes:  data.availabilityTypes  || [],
          previousExperience: data.previousExperience || '',
          smokes:             data.smokes ?? null,
          hasLicense:         data.hasLicense ?? null,
          preferredPositions: data.preferredPositions || [],
          isAvailable:        data.isAvailable ?? true,  // Dalga H2
        })
      })
      .catch(() => toast.error('Profil yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)
  const [ptab, setPtab] = useState('bilgiler')  // FAZ 23.2 — profil ic sekmeleri

  async function handleCroppedAvatar(file) {
    setAvatarUploading(true)
    try {
      const updated = await hotelApi.uploadCandidateAvatar(file)
      setProfile(updated)
      toast.success('Profil fotoğrafı güncellendi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setAvatarUploading(false) }
  }

  async function handleAvatarDelete() {
    const ok = await confirm({
      title: 'Profil fotoğrafını sil',
      description: 'Fotoğrafın kaldırılır, tekrar yükleyebilirsin.',
      confirmLabel: 'Evet, sil',
      destructive: true,
    })
    if (!ok) return
    try {
      await hotelApi.deleteCandidateAvatar()
      setProfile(prev => ({ ...prev, avatarUrl: null }))
      toast.success('Profil fotoğrafı silindi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleSetField(field, value) {
    setForm(prev => {
      const has = prev[field].includes(value)
      return {
        ...prev,
        [field]: has ? prev[field].filter(x => x !== value) : [...prev[field], value],
      }
    })
  }

  function setTriState(field, raw) {
    setForm(prev => ({
      ...prev,
      [field]: raw === 'unknown' ? null : raw === 'yes',
    }))
  }

  const triValue = (v) => v === null || v === undefined ? 'unknown' : (v ? 'yes' : 'no')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fullName.trim()) return toast.error('Ad soyad zorunlu')

    const phoneError = validateTurkeyPhone(form.phone, { mobileOnly: true })
    if (phoneError) return toast.error(phoneError)
    const ageError = validateAdultAge(form.birthDate)
    if (ageError) return toast.error(ageError)

    setSaving(true)
    try {
      const payload = {
        fullName:           form.fullName.trim(),
        phone:              form.phone.trim() || null,
        birthDate:          form.birthDate || null,
        gender:             form.gender || null,
        education:          form.education || null,
        languages:          form.languages,
        availabilityTypes:  form.availabilityTypes,
        previousExperience: form.previousExperience.trim() || null,
        smokes:             form.smokes,
        hasLicense:         form.hasLicense,
        preferredPositions: form.preferredPositions,
        isAvailable:        form.isAvailable,  // Dalga H2
      }
      const data = await hotelApi.updateCandidateProfile(payload)
      setProfile(data)
      toast.success('Profil güncellendi!')
      setSavedAt(Date.now())  // Alert tetigi
      setTimeout(() => setSavedAt(null), 5000)  // 5sn sonra otomatik kapat
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonForm fields={6} />
  if (!form) return null

  const completeness = calculateCandidateCompleteness(
    { ...form, avatarUrl: profile?.avatarUrl, about: profile?.about, experienceYears: profile?.experienceYears },
    { hasDocument: (profile?.documents?.length ?? 0) > 0 }
  )

  return (
    <div className="ah-surface max-w-[1400px] mx-auto">
      {savedAt && (
        <Alert variant="success" title="Profil güncellendi">
          Değişiklikler kaydedildi — işverenler artık güncel bilgilerinizi görür.
        </Alert>
      )}

      {/* FAZ 23 — Kariyer.net hesabim duzeni: sol profil rayi + sag icerik kartlari */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start mt-4">

        {/* ================= SOL RAIL ================= */}
        <div className="space-y-4 lg:sticky lg:top-4">
          {/* Profil ozeti */}
          <div className="card p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden mb-4 relative"
                 style={{ background: 'rgba(15, 118, 110, 0.08)', border: '2px solid rgba(15, 118, 110, 0.22)' }}>
              {profile?.avatarUrl ? (
                <img src={cldImg(profile.avatarUrl, { w: ImgSize.avatarLg })} alt="Avatar"
                     loading="lazy" decoding="async" className="w-full h-full object-cover" />
              ) : (
                <span className="text-4xl font-semibold" style={{ color: '#0f766e' }}>
                  {(profile?.fullName || 'A').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--ah-ink)' }}>
              {profile?.fullName || 'Aday'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
              {profile?.email || ''}
            </p>
            <div className="w-full pt-3 mt-3 border-t flex items-center justify-between text-[11px]"
                 style={{ borderColor: 'var(--ah-line)' }}>
              <span style={{ color: 'var(--ah-ink-3)' }}>ÜYE OLDU</span>
              <span className="font-semibold" style={{ color: 'var(--ah-ink-2)' }}>
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>

          {/* Is ariyorum toggle */}
          <div className="card p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: form.isAvailable ? '#0a7c42' : 'var(--ah-ink)' }}>
                {form.isAvailable ? 'İş arıyorum' : 'Şu anda aramıyorum'}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--ah-ink-4)' }}>
                {form.isAvailable
                  ? 'İşletmeler seni 3 kat daha hızlı bulsun.'
                  : 'Aktif olduğunda daha çok teklif alırsın.'}
              </p>
            </div>
            <button type="button" role="switch" aria-checked={form.isAvailable}
              onClick={() => setForm(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0"
              style={{ background: form.isAvailable ? '#0a7c42' : 'var(--ah-line-2)' }}>
              <span className="inline-block h-4.5 w-4.5 rounded-full bg-white transition-transform"
                    style={{ width: 18, height: 18, transform: form.isAvailable ? 'translateX(21px)' : 'translateX(3px)' }} />
            </button>
          </div>

          {/* Email durumu */}
          <div className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--ah-ink-3)' }}>
                Email Doğrulama
              </p>
              <p className="text-sm font-semibold mt-1"
                 style={{ color: profile?.emailVerifiedAt ? '#0a7c42' : '#b7791f' }}>
                {profile?.emailVerifiedAt ? 'Doğrulandı' : 'Beklemede'}
              </p>
            </div>
            <span className="w-2.5 h-2.5 rounded-full"
                  style={{ background: profile?.emailVerifiedAt ? '#0a7c42' : '#b7791f' }} />
          </div>

          {/* Profil doluluk — sol alt (guvenilirlik skoru kaldirildi) */}
          <ProfileCompletenessCard data={completeness} />
        </div>

        {/* ================= SAG KOLON ================= */}
        <div className="space-y-4 min-w-0">
          {/* Ic sekme cubugu */}
          <div className="flex gap-5 border-b overflow-x-auto" style={{ borderColor: 'var(--ah-line)' }}>
            {[['bilgiler', 'Bilgilerim'], ['belgeler', 'Belgeler'], ['guvenlik', 'Güvenlik']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setPtab(k)}
                className="text-[13.5px] font-semibold pb-2.5 -mb-px whitespace-nowrap transition-colors"
                style={ptab === k
                  ? { color: 'var(--ah-brand)', borderBottom: '2px solid var(--ah-brand)' }
                  : { color: 'var(--ah-ink-3)', borderBottom: '2px solid transparent' }}>
                {l}
              </button>
            ))}
          </div>

          {/* ===== BİLGİLERİM ===== */}
          {ptab === 'bilgiler' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Fotograf */}
              <div className="card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--ah-ink-2)' }}>Profil Fotoğrafı</h3>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
                       style={{ background: 'rgba(15, 118, 110, 0.06)', border: '2px solid rgba(15, 118, 110, 0.20)' }}>
                    {profile?.avatarUrl ? (
                      <img src={cldImg(profile.avatarUrl, { w: ImgSize.avatarLg })} alt="Avatar" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl tracking-wider" style={{ color: '#0f766e' }}>{(profile?.fullName || 'A').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <button type="button" onClick={() => setCropOpen(true)} disabled={avatarUploading}
                      className="block w-full px-4 py-2.5 text-sm font-semibold rounded-lg cursor-pointer text-center transition-colors disabled:opacity-60 disabled:cursor-wait"
                      style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
                      {avatarUploading ? 'Yükleniyor...' : (profile?.avatarUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle')}
                    </button>
                    <AvatarCropModal open={cropOpen} onClose={() => setCropOpen(false)} onConfirm={handleCroppedAvatar} />
                    {profile?.avatarUrl && (
                      <button type="button" onClick={handleAvatarDelete}
                        className="block w-full px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
                        style={{ background: '#fff', color: '#992d22', border: '1px solid var(--ah-line-2)' }}>Fotoğrafı Kaldır</button>
                    )}
                    <p className="text-xs" style={{ color: 'var(--ah-ink-4)' }}>Max 5 MB · JPG/PNG/WEBP/HEIC · Yüze odaklı 400×400 olarak kaydedilir</p>
                  </div>
                </div>
              </div>

              {/* Temel Bilgiler */}
              <div className="card p-5 space-y-4">
                <h3 className="text-base tracking-[0.2em] uppercase pb-2 border-b" style={{ color: '#0f766e', borderColor: 'rgba(15, 118, 110, 0.10)' }}>Temel Bilgiler</h3>
                <div>
                  <label className="label">Ad Soyad *</label>
                  <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className="input" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">E-posta <span className="text-ink-400 font-normal">(değiştirilemez)</span></label>
                    <input type="email" value={profile?.email || ''} disabled className="input bg-cream-50 text-ink-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="label">Telefon</label>
                    <input type="tel" name="phone" value={form.phone} maxLength={14}
                      onChange={e => setForm(prev => ({ ...prev, phone: formatTurkeyPhoneInput(e.target.value) }))}
                      className="input" placeholder="0555 123 45 67" />
                  </div>
                </div>
                {/* FAZ B.5.2 — Aday ilce/mahalle girisi KALDIRILDI (kullanici karari).
                    Konum artik ilanla aday arasindaki mesafe (km) uzerinden kuruluyor;
                    ilce yalnizca ISLETME kendi adresini girerken yaziliyor. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Doğum Tarihi <span className="text-ink-400 font-normal text-[10px]">(16-65 yaş)</span></label>
                    <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange} {...birthDateBounds()} className="input" />
                  </div>
                  <div>
                    <label className="label">Cinsiyet</label>
                    <select name="gender" value={form.gender} onChange={handleChange} className="input">
                      <option value="">Belirtmedim</option>
                      {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Egitim & Ek */}
              <div className="card p-5 space-y-4">
                <h3 className="text-base tracking-[0.2em] uppercase pb-2 border-b" style={{ color: '#0f766e', borderColor: 'rgba(15, 118, 110, 0.10)' }}>Eğitim & Ek</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Eğitim Durumu</label>
                    <select name="education" value={form.education} onChange={handleChange} className="input">
                      <option value="">Seçin</option>
                      {Object.entries(EDUCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Ehliyet</label>
                    <select value={triValue(form.hasLicense)} onChange={e => setTriState('hasLicense', e.target.value)} className="input">
                      <option value="unknown">Belirtmedim</option>
                      <option value="yes">Var</option>
                      <option value="no">Yok</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={saving}
                  className="px-6 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
                  style={{ background: '#0f766e', color: '#ffffff' }}>
                  {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          )}

          {/* ===== BELGELER ===== */}
          {ptab === 'belgeler' && <DocumentsTab />}

          {/* ===== GÜVENLİK ===== */}
          {ptab === 'guvenlik' && (
            <div className="grid lg:grid-cols-2 gap-4 items-start">
              <ChangePasswordCard />
              <GdprCard />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


