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
      <div className="no-print flex justify-end">
        <button onClick={() => window.print()}
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                     bg-white dark:bg-ink-800 text-ink-700 dark:text-cream-100
                     border border-cream-300 dark:border-ink-700
                     hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-300
                     transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
          </svg>
          CV'mi Yazdır
        </button>
      </div>

      <div className="print-only">
        <h1 style={{ fontSize: '24pt', fontWeight: 700, margin: '0 0 4pt 0' }}>
          {profile?.fullName || 'Aday Profili'}
        </h1>
        <p style={{ fontSize: '10pt', color: '#555', margin: 0 }}>
          AjansHotel CV — {new Date().toLocaleDateString('tr-TR')}
        </p>
        <hr style={{ margin: '8pt 0', border: 0, borderTop: '1px solid #ccc' }} />
      </div>

      <ProfileCompletenessCard data={completeness} />

      <div className="card p-5">
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider mb-4">Profil Fotoğrafı</h3>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-cream-100 dark:bg-ink-700 border-2 border-cream-300 dark:border-ink-700 flex items-center justify-center overflow-hidden flex-shrink-0">
            {profile?.avatarUrl ? (
              <img src={cldImg(profile.avatarUrl, { w: ImgSize.avatarLg })} alt="Avatar"
                   loading="lazy" decoding="async"
                   className="w-full h-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-ink-400 dark:text-ink-500">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
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
          <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Temel Bilgiler</h3>

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
          <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Eğitim</h3>
          <div>
            <label className="label">Eğitim Durumu <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
            <select name="education" value={form.education} onChange={handleChange} className="input">
              <option value="">Seçin</option>
              {Object.entries(EDUCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">İş Tercihleri</h3>

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
          <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Diğer</h3>
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
            <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Bildirim Tercihleri</h3>
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
            style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}>
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </form>

      <ChangePasswordCard />
    </div>
  )
}
