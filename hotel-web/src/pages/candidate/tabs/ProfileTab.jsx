// FAZ 5.2 — CandidateDashboard'dan ayrildi (en buyuk tab — 366 satir)
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import ProfileCompletenessCard from '../../../components/ProfileCompletenessCard'
import { calculateCandidateCompleteness } from '../../../lib/profileCompleteness'
import AvatarCropModal from '../../../components/AvatarCropModal'
import ChangePasswordCard from '../../../components/ChangePasswordCard'
import GdprCard from '../../../components/GdprCard'
import AvailabilityBlocksEditor from '../../../components/AvailabilityBlocksEditor'
import { validateTurkeyPhone, formatTurkeyPhoneInput, validateAdultAge, birthDateBounds } from '../../../utils/validation'
import DistrictNeighborhoodSelect from '../../../components/DistrictNeighborhoodSelect'
import { ISTANBUL_DISTRICTS } from '../../../data/istanbul'
import {
  GENDER_LABELS, EDUCATION_LABELS, AVAILABILITY_LABELS, POSITION_LABELS
} from '../../../utils/labels'

export default function ProfileTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [profile, setProfile] = useState(null)
  const [reliability, setReliability] = useState(null)

  useEffect(() => {
    hotelApi.getMyReliability()
      .then(setReliability)
      .catch(() => {})  // sessiz hata: panel skoru kritik degil
  }, [])

  useEffect(() => {
    hotelApi.getCandidateProfile()
      .then(data => {
        setProfile(data)
        setForm({
          fullName:           data.fullName           || '',
          phone:              data.phone              || '',
          district:           data.district           || '',
          neighborhood:       data.neighborhood       || '',
          birthDate:          data.birthDate          || '',
          gender:             data.gender             || '',
          education:          data.education          || '',
          languages:          data.languages          || [],
          availabilityTypes:  data.availabilityTypes  || [],
          previousExperience: data.previousExperience || '',
          smokes:             data.smokes ?? null,
          hasLicense:         data.hasLicense ?? null,
          preferredDistricts: data.preferredDistricts || [],
          preferredPositions: data.preferredPositions || [],
        })
      })
      .catch(() => toast.error('Profil yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  const [avatarUploading, setAvatarUploading] = useState(false)
  const [cropOpen, setCropOpen] = useState(false)

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
    if (!confirm('Profil fotoğrafı silinsin mi?')) return
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
        district:           form.district || null,
        neighborhood:       form.neighborhood?.trim() || null,
        birthDate:          form.birthDate || null,
        gender:             form.gender || null,
        education:          form.education || null,
        languages:          form.languages,
        availabilityTypes:  form.availabilityTypes,
        previousExperience: form.previousExperience.trim() || null,
        smokes:             form.smokes,
        hasLicense:         form.hasLicense,
        preferredDistricts: form.preferredDistricts,
        preferredPositions: form.preferredPositions,
      }
      const data = await hotelApi.updateCandidateProfile(payload)
      setProfile(data)
      toast.success('Profil güncellendi!')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>
  if (!form) return null

  const completeness = calculateCandidateCompleteness(
    { ...form, avatarUrl: profile?.avatarUrl, about: profile?.about, experienceYears: profile?.experienceYears },
    { hasDocument: (profile?.documents?.length ?? 0) > 0 }
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* FAZ 5.4 — Identity + quick actions: 2-kolon ust bolum */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* SOL — Identity card */}
        <div className="card p-6 lg:col-span-1 flex flex-col items-center text-center">
          <div className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden mb-4 relative"
               style={{ background: 'rgba(212, 168, 83, 0.10)', border: '2px solid rgba(212, 168, 83, 0.25)' }}>
            {profile?.avatarUrl ? (
              <img src={cldImg(profile.avatarUrl, { w: ImgSize.avatarLg })} alt="Avatar"
                   loading="lazy" decoding="async"
                   className="w-full h-full object-cover" />
            ) : (
              <span className="font-bebas text-5xl tracking-wider"
                    style={{ color: '#f7c43c', textShadow: '0 0 16px rgba(212, 168, 83, 0.4)' }}>
                {(profile?.fullName || 'A').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="font-bebas text-2xl tracking-wider uppercase text-white mb-1">
            {profile?.fullName || 'Aday'}
          </h2>
          <p className="text-xs mb-3" style={{ color: '#8ba9d2' }}>
            {profile?.email || ''}
          </p>
          <div className="w-full pt-3 mt-1 border-t" style={{ borderColor: 'rgba(212, 168, 83, 0.15)' }}>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: '#8ba9d2' }}>ÜYE OLDU</span>
              <span className="font-semibold" style={{ color: '#dde7f3' }}>
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* SAĞ — Profil tamamlama + Email durum */}
        <div className="lg:col-span-2 space-y-4">
          <ProfileCompletenessCard data={completeness} />

          {/* Email durum kartı */}
          <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#8ba9d2' }}>
                Email Doğrulama
              </p>
              <p className="font-bebas text-xl tracking-wider mt-1 uppercase"
                 style={{ color: profile?.emailVerifiedAt ? '#fde9a5' : '#fbbf24' }}>
                {profile?.emailVerifiedAt ? 'Doğrulandı' : 'Beklemede'}
              </p>
            </div>
            <span className="w-3 h-3 rounded-full"
                  style={{
                    background: profile?.emailVerifiedAt ? '#d4a853' : '#fbbf24',
                    boxShadow: `0 0 12px ${profile?.emailVerifiedAt ? 'rgba(212, 168, 83,0.6)' : 'rgba(251,191,36,0.6)'}`,
                  }} />
          </div>
        </div>
      </div>

      {reliability && <ReliabilityCard data={reliability} />}

      <AvailabilityBlocksEditor />

      <div className="card p-5">
        <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#dde7f3' }}>Profil Fotoğrafı</h3>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
               style={{ background: 'rgba(212, 168, 83, 0.10)', border: '2px solid rgba(212, 168, 83, 0.20)' }}>
            {profile?.avatarUrl ? (
              <img src={cldImg(profile.avatarUrl, { w: ImgSize.avatarLg })} alt="Avatar"
                   loading="lazy" decoding="async"
                   className="w-full h-full object-cover" />
            ) : (
              <span className="font-bebas text-4xl tracking-wider" style={{ color: '#f7c43c' }}>
                {(profile?.fullName || 'A').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <button type="button" onClick={() => setCropOpen(true)} disabled={avatarUploading}
              className={`block w-full px-4 py-2 text-sm font-medium rounded-lg cursor-pointer text-center transition-colors
                ${avatarUploading
                  ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-500 cursor-wait'
                  : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700 hover:bg-brand-200 dark:hover:bg-brand-900/60'}`}>
              {avatarUploading
                ? 'Yükleniyor...'
                : (profile?.avatarUrl ? 'Fotoyu Değiştir' : 'Foto Yükle')}
            </button>
            <AvatarCropModal open={cropOpen} onClose={() => setCropOpen(false)} onConfirm={handleCroppedAvatar} />
            {profile?.avatarUrl && (
              <button type="button" onClick={handleAvatarDelete}
                className="block w-full px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                Fotoyu Kaldır
              </button>
            )}
            <p className="text-xs text-ink-400">Max 5 MB · JPG/PNG/WEBP/HEIC · Yüze odaklı 400x400 olarak kaydedilir</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card p-5 space-y-4">
          <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>Temel Bilgiler</h3>

          <div>
            <label className="label">Ad Soyad *</label>
            <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className="input" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">E-posta <span className="text-ink-400 font-normal">(değiştirilemez)</span></label>
              <input type="email" value={profile?.email || ''} disabled
                className="input bg-cream-50 text-ink-500 cursor-not-allowed" />
            </div>
            <div>
              <label className="label">Telefon</label>
              <input type="tel" name="phone" value={form.phone} maxLength={14}
                onChange={e => setForm(prev => ({ ...prev, phone: formatTurkeyPhoneInput(e.target.value) }))}
                className="input" placeholder="0555 123 45 67" />
            </div>
          </div>

          <DistrictNeighborhoodSelect
            district={form.district}
            neighborhood={form.neighborhood}
            onChange={({ district, neighborhood }) =>
              setForm(prev => ({ ...prev, district, neighborhood }))
            } />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Doğum Tarihi <span className="text-ink-400 font-normal text-[10px]">(16-65 yaş)</span></label>
              <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange}
                {...birthDateBounds()} className="input" />
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

        <div className="card p-5 space-y-4">
          <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>Eğitim</h3>
          <div>
            <label className="label">Eğitim Durumu <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
            <select name="education" value={form.education} onChange={handleChange} className="input">
              <option value="">Seçin</option>
              {Object.entries(EDUCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>İş Tercihleri</h3>

          <div>
            <label className="label">Müsaitlik Türü <span className="text-ink-400 font-normal">(birden fazla seçebilirsin)</span></label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(AVAILABILITY_LABELS).map(([key, label]) => {
                const active = form.availabilityTypes.includes(key)
                return (
                  <button key={key} type="button" onClick={() => toggleSetField('availabilityTypes', key)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all
                      ${active
                        ? 'border-brand-500 dark:border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 shadow-sm'
                        : 'border-cream-300 dark:border-ink-700 bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:border-brand-400 dark:hover:border-brand-500'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Önceki Deneyim <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
            <textarea name="previousExperience" value={form.previousExperience} onChange={handleChange}
              className="input resize-none h-24 text-sm"
              placeholder="Daha önce çalıştığın yerler, pozisyonlar, kazandığın deneyimler..." />
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>Diğer</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

        <div className="card p-5 space-y-4">
          <div>
            <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>Bildirim Tercihleri</h3>
            <p className="text-xs text-ink-500 mt-1">
              İlgini çekebilecek yeni ilan açıldığında otomatik bildirim al. Hiçbirini seçmezsen bildirim yok.
            </p>
          </div>

          <div>
            <label className="label">İlgilendiğin İlçeler</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-2 border border-cream-300 rounded-lg">
              {ISTANBUL_DISTRICTS.map(d => {
                const active = form.preferredDistricts.includes(d)
                return (
                  <label key={d}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer
                      ${active ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 font-medium' : 'text-ink-600 hover:bg-cream-50'}`}>
                    <input type="checkbox" checked={active}
                      onChange={() => toggleSetField('preferredDistricts', d)}
                      className="w-3.5 h-3.5 accent-brand-700" />
                    {d}
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-ink-400 mt-1">{form.preferredDistricts.length} ilçe seçili</p>
          </div>

          <div>
            <label className="label">İlgilendiğin Pozisyonlar</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(POSITION_LABELS).map(([value, label]) => {
                const active = form.preferredPositions.includes(value)
                return (
                  <label key={value}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm
                      ${active ? 'border-brand-500 dark:border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 font-medium' : 'border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500'}`}>
                    <input type="checkbox" checked={active}
                      onChange={() => toggleSetField('preferredPositions', value)}
                      className="w-4 h-4 accent-brand-700" />
                    {label}
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-ink-400 mt-1">{form.preferredPositions.length} pozisyon seçili</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}>
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </form>

      <ChangePasswordCard />
      <GdprCard />
    </div>
  )
}

/**
 * Faz B/#11 — Adayın kendi güvenilirlik skoru kartı.
 * 0-100 arası, breakdown pill'leri (rating + tamamlanmış iş + no-show) + ilerleme çubuğu.
 */
function ReliabilityCard({ data }) {
  const { score = 0, noShowCount = 0, completedJobsLast90d = 0, completedJobsAllTime = 0,
          averageRating, reviewCount } = data

  let band, color, bg
  if (score >= 80)      { band = 'Yüksek';   color = '#86efac'; bg = 'linear-gradient(90deg, #16a34a, #4ade80)' }
  else if (score >= 60) { band = 'Ortalama'; color = '#fcd34d'; bg = 'linear-gradient(90deg, #d97706, #fbbf24)' }
  else if (score >= 40) { band = 'Dikkat';   color = '#fdba74'; bg = 'linear-gradient(90deg, #ea580c, #fb923c)' }
  else                  { band = 'Düşük';    color = '#fca5a5'; bg = 'linear-gradient(90deg, #b91c1c, #ef4444)' }

  return (
    <div className="card p-5"
         style={{
           background: 'linear-gradient(135deg, rgba(21, 36, 61, 0.85), rgba(15, 23, 38, 0.85))',
           border: '1px solid rgba(212, 168, 83, 0.20)',
         }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#8ba9d2' }}>
            Güvenilirlik Skoru
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-bebas text-4xl tracking-wider" style={{ color: '#ffffff' }}>{score}</span>
            <span className="text-xs" style={{ color: '#8ba9d2' }}>/ 100</span>
            <span className="ml-2 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{band}</span>
          </div>
        </div>
        <p className="text-[11px] max-w-xs text-right" style={{ color: '#8ba9d2' }}>
          İşletmeler aday seçerken bu skoru görür. Yüksek tutmak seni öne çıkarır.
        </p>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(212, 168, 83, 0.15)' }}>
        <div className="h-full rounded-full transition-all"
             style={{ width: `${Math.max(2, score)}%`, background: bg }} />
      </div>

      <div className="flex flex-wrap gap-2">
        <BreakdownPill label="Ortalama puan" value={averageRating != null ? `${averageRating.toFixed(1)} / 5` : 'Henüz yok'}
                       hint={reviewCount ? `${reviewCount} yorum` : null} />
        <BreakdownPill label="Tüm zaman tamamlanan" value={`${completedJobsAllTime} iş`}
                       hint={completedJobsLast90d > 0 ? `${completedJobsLast90d} son 90 gün` : null} />
        <BreakdownPill label="No-show" value={`${noShowCount}`} bad={noShowCount > 0} />
      </div>
    </div>
  )
}

function BreakdownPill({ label, value, hint, bad }) {
  return (
    <div className="rounded-lg px-2.5 py-1.5"
         style={{
           background: bad ? 'rgba(239, 68, 68, 0.10)' : 'rgba(212, 168, 83, 0.10)',
           border: `1px solid ${bad ? 'rgba(239, 68, 68, 0.30)' : 'rgba(212, 168, 83, 0.20)'}`,
         }}>
      <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#8ba9d2' }}>{label}</p>
      <p className="text-xs font-semibold mt-0.5" style={{ color: bad ? '#fca5a5' : '#dde7f3' }}>
        {value}{hint && <span className="ml-1 font-normal opacity-70">· {hint}</span>}
      </p>
    </div>
  )
}
