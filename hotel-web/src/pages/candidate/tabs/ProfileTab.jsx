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
import { SkeletonForm } from '../../../components/Skeleton'
import { Alert } from '../../../components/ui/Alert'
import AvailabilityBlocksEditor from '../../../components/AvailabilityBlocksEditor'
import { validateTurkeyPhone, formatTurkeyPhoneInput, validateAdultAge, birthDateBounds } from '../../../utils/validation'
import DistrictNeighborhoodSelect from '../../../components/DistrictNeighborhoodSelect'
import { ISTANBUL_DISTRICTS } from '../../../data/istanbul'
import DocumentsTab from './DocumentsTab'   // Belgelerim Profilim'e tasindi
import {
  GENDER_LABELS, EDUCATION_LABELS, AVAILABILITY_LABELS, POSITION_LABELS
} from '../../../utils/labels'

export default function ProfileTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)  // Dalga G3 — Alert success goster
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
          isAvailable:        data.isAvailable ?? true,  // Dalga H2
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
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Dalga G3 — shadcn Alert uyarlamasi: kaydet sonrasi inline geri bildirim */}
      {savedAt && (
        <Alert variant="success" title="Profil güncellendi">
          Değişiklikler kaydedildi — işverenler artık güncel bilgilerinizi görür.
        </Alert>
      )}

      {/* Dalga H2 — Is ariyorum toggle (LinkedIn Open to Work).
          Form disinda inline kaydeder — toggle->API->state */}
      <div className="card p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
               style={{
                 background: form.isAvailable
                   ? 'rgba(122, 159, 122, 0.12)'
                   : 'rgba(205, 183, 143, 0.06)',
                 border: `1px solid ${form.isAvailable ? 'rgba(122, 159, 122, 0.35)' : 'rgba(205, 183, 143, 0.10)'}`,
               }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke={form.isAvailable ? '#a8c8a8' : '#6b6358'}
                 strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-base tracking-[0.15em] uppercase"
               style={{ color: form.isAvailable ? '#a8c8a8' : '#c9bdaa' }}>
              {form.isAvailable ? 'İş Arıyorum' : 'Şu anda iş aramıyorum'}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: '#6b6358' }}>
              {form.isAvailable
                ? 'İşletmeler profilinde yeşil rozet görür — daha fazla teklif almak için açık tutun.'
                : 'Aktif olduğunda işletmeler size daha fazla teklif gönderebilir.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.isAvailable}
          onClick={() => setForm(prev => ({ ...prev, isAvailable: !prev.isAvailable }))}
          className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors shrink-0"
          style={{
            background: form.isAvailable ? '#7a9f7a' : 'rgba(205, 183, 143, 0.10)',
            border: `1px solid ${form.isAvailable ? '#16a34a' : 'rgba(205, 183, 143, 0.18)'}`,
          }}>
          <span className="inline-block h-5 w-5 transform rounded-full bg-white transition-transform"
                style={{ transform: form.isAvailable ? 'translateX(22px)' : 'translateX(3px)' }} />
        </button>
      </div>
      {/* UST: 3 esit sutun — Identity | Doluluk | Email durumu */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Identity card */}
        <div className="card p-6 flex flex-col items-center text-center">
          <div className="w-28 h-28 rounded-full flex items-center justify-center overflow-hidden mb-4 relative"
               style={{ background: 'rgba(205, 183, 143, 0.08)', border: '2px solid rgba(205, 183, 143, 0.22)' }}>
            {profile?.avatarUrl ? (
              <img src={cldImg(profile.avatarUrl, { w: ImgSize.avatarLg })} alt="Avatar"
                   loading="lazy" decoding="async"
                   className="w-full h-full object-cover" />
            ) : (
              <span className="text-5xl tracking-wider"
                    style={{ color: '#cdb78f', textShadow: '0 0 16px rgba(205, 183, 143, 0.32)' }}>
                {(profile?.fullName || 'A').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="text-2xl tracking-wider uppercase text-white mb-1">
            {profile?.fullName || 'Aday'}
          </h2>
          <p className="text-xs mb-3" style={{ color: '#928678' }}>
            {profile?.email || ''}
          </p>
          <div className="w-full pt-3 mt-1 border-t" style={{ borderColor: 'rgba(205, 183, 143, 0.12)' }}>
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: '#928678' }}>ÜYE OLDU</span>
              <span className="font-semibold" style={{ color: '#ede4d3' }}>
                {profile?.createdAt
                  ? new Date(profile.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Profil tamamlama */}
        <ProfileCompletenessCard data={completeness} />

        {/* Email durum kartı */}
        <div className="card p-5 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#928678' }}>
                Email Doğrulama
              </p>
              <p className="text-xl tracking-wider mt-1 uppercase"
                 style={{ color: profile?.emailVerifiedAt ? '#cdb78f' : '#c8923a' }}>
                {profile?.emailVerifiedAt ? 'Doğrulandı' : 'Beklemede'}
              </p>
            </div>
            <span className="w-3 h-3 rounded-full"
                  style={{
                    background: profile?.emailVerifiedAt ? '#d4a853' : '#c8923a',
                    boxShadow: `0 0 12px ${profile?.emailVerifiedAt ? 'rgba(205, 183, 143, 0.50)' : 'rgba(251,191,36,0.6)'}`,
                  }} />
        </div>
      </div>

      {/* ANA 2-SUTUN: tum form ve yan widget'lar yan yana */}
      <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* === SOL SUTUN === */}
        <div className="space-y-4">
          {reliability && <ReliabilityCard data={reliability} />}
          <div className="card p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: '#ede4d3' }}>Profil Fotoğrafı</h3>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
               style={{ background: 'rgba(205, 183, 143, 0.06)', border: '2px solid rgba(205, 183, 143, 0.20)' }}>
            {profile?.avatarUrl ? (
              <img src={cldImg(profile.avatarUrl, { w: ImgSize.avatarLg })} alt="Avatar"
                   loading="lazy" decoding="async"
                   className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl tracking-wider" style={{ color: '#cdb78f' }}>
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
        <div className="card p-5 space-y-4">
          <h3 className="text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#cdb78f', borderColor: 'rgba(205, 183, 143, 0.10)' }}>Temel Bilgiler</h3>

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

        {/* SOL: Ilgilendigin Ilceler (uzayan otomatik tamamlama) */}
        <div className="card p-5 space-y-3">
          <h3 className="text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#cdb78f', borderColor: 'rgba(205, 183, 143, 0.10)' }}>İlgilendiğin İlçeler</h3>
          <p className="text-xs" style={{ color: '#928678' }}>
            Bu ilçelerde yeni ilan açıldığında otomatik bildirim alırsın.
          </p>
          <DistrictAutocomplete
            selected={form.preferredDistricts}
            onToggle={(d) => toggleSetField('preferredDistricts', d)}
          />
          <p className="text-xs text-ink-400">{form.preferredDistricts.length} ilçe seçili</p>
        </div>
        </div>  {/* SOL SUTUN kapanis */}

        {/* === SAG SUTUN === */}
        <div className="space-y-4">
          <AvailabilityBlocksEditor />

          {/* Egitim + Ehliyet */}
        <div className="card p-5 space-y-4">
          <h3 className="text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#cdb78f', borderColor: 'rgba(205, 183, 143, 0.10)' }}>Eğitim & Ek</h3>
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

        <div className="card p-5 space-y-4">
          <h3 className="text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#cdb78f', borderColor: 'rgba(205, 183, 143, 0.10)' }}>İş Tercihleri</h3>

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

        {/* SAG: Ilgilendigin Pozisyonlar */}
        <div className="card p-5 space-y-3">
          <h3 className="text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#cdb78f', borderColor: 'rgba(205, 183, 143, 0.10)' }}>İlgilendiğin Pozisyonlar</h3>
          <p className="text-xs" style={{ color: '#928678' }}>
            Bu pozisyonlarda yeni ilan acildiginda otomatik bildirim alirsin.
          </p>
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
          <p className="text-xs text-ink-400">{form.preferredPositions.length} pozisyon seçili</p>
        </div>
        </div>  {/* SAG SUTUN kapanis */}
      </div>  {/* 2-SUTUN GRID kapanis */}

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)', color: '#1a1208', boxShadow: '0 12px 28px rgba(205, 183, 143, 0.25), inset 0 1px 0 rgba(255,255,255,0.22)' }}>
            {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
          </button>
        </div>
      </form>

      {/* Belgelerim sol, Sifre+GDPR sag — yatay full dolu */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <DocumentsTab />
        <div className="space-y-4">
          <ChangePasswordCard />
          <GdprCard />
        </div>
      </div>
    </div>
  )
}

/* Aranabilir ilce secimi — "ba" yazinca Bagcilar/Basaksehir filtrelenir
   diakritik-insensitive arama, checkbox-style multi-select chip listesi */
function DistrictAutocomplete({ selected, onToggle }) {
  const [query, setQuery] = useState('')
  // Turkce karakterleri normalize et (ı→i, ö→o, ü→u, ç→c, ş→s, ğ→g)
  function norm(s) {
    return (s || '').toLowerCase()
      .replaceAll('ı', 'i').replaceAll('ö', 'o').replaceAll('ü', 'u')
      .replaceAll('ç', 'c').replaceAll('ş', 's').replaceAll('ğ', 'g')
  }
  const nq = norm(query.trim())
  const matches = nq
    ? ISTANBUL_DISTRICTS.filter(d => norm(d).includes(nq))
    : ISTANBUL_DISTRICTS

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
             width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="İlçe ara (örn. ba → Bağcılar, Başakşehir)"
          className="input text-sm"
          style={{ paddingLeft: 36 }} />
        {query && (
          <button type="button" onClick={() => setQuery('')}
            aria-label="Aramayı temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Secili ilceler — chip seti (var ise) */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(d => (
            <button key={d} type="button" onClick={() => onToggle(d)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                background: 'rgba(205, 183, 143, 0.10)',
                color: '#cdb78f',
                border: '1px solid rgba(205, 183, 143, 0.35)',
              }}>
              {d}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Eslesen ilce listesi */}
      <div className="max-h-44 overflow-y-auto border rounded-lg p-1.5"
           style={{ borderColor: 'rgba(205, 183, 143, 0.10)' }}>
        {matches.length === 0 ? (
          <p className="text-xs text-center py-3" style={{ color: '#6b6358' }}>
            "{query}" ile eşleşen ilçe yok
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
            {matches.map(d => {
              const active = selected.includes(d)
              return (
                <button key={d} type="button" onClick={() => onToggle(d)}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs transition-colors text-left"
                  style={{
                    background: active ? 'rgba(205, 183, 143, 0.10)' : 'transparent',
                    color: active ? '#cdb78f' : '#c9bdaa',
                    border: active ? '1px solid rgba(205, 183, 143, 0.25)' : '1px solid transparent',
                    fontWeight: active ? 600 : 500,
                  }}>
                  <span className="truncate">{d}</span>
                  {active && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
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
  if (score >= 80)      { band = 'Yüksek';   color = '#a8c8a8'; bg = 'linear-gradient(90deg, #16a34a, #4ade80)' }
  else if (score >= 60) { band = 'Ortalama'; color = '#fcd34d'; bg = 'linear-gradient(90deg, #d97706, #c8923a)' }
  else if (score >= 40) { band = 'Dikkat';   color = '#fdba74'; bg = 'linear-gradient(90deg, #ea580c, #fb923c)' }
  else                  { band = 'Düşük';    color = '#d39481'; bg = 'linear-gradient(90deg, #b91c1c, #b46a55)' }

  return (
    <div className="card p-5"
         style={{
           background: '#1b1815',
           border: 'none',
           boxShadow: '0 14px 36px rgba(0,0,0,0.30), inset 0 1px 0 rgba(245,239,226,0.03)',
         }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#928678' }}>
            Güvenilirlik Skoru
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl tracking-wider" style={{ color: '#ffffff' }}>{score}</span>
            <span className="text-xs" style={{ color: '#928678' }}>/ 100</span>
            <span className="ml-2 text-[11px] font-bold uppercase tracking-wider" style={{ color }}>{band}</span>
          </div>
        </div>
        <p className="text-[11px] max-w-xs text-right" style={{ color: '#928678' }}>
          İşletmeler aday seçerken bu skoru görür. Yüksek tutmak seni öne çıkarır.
        </p>
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(205, 183, 143, 0.12)' }}>
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
           background: bad ? 'rgba(180, 106, 85, 0.10)' : 'rgba(205, 183, 143, 0.08)',
           border: `1px solid ${bad ? 'rgba(180, 106, 85, 0.28)' : 'rgba(205, 183, 143, 0.14)'}`,
         }}>
      <p className="text-[9px] uppercase tracking-wider font-bold" style={{ color: '#928678' }}>{label}</p>
      <p className="text-xs font-semibold mt-0.5" style={{ color: bad ? '#d39481' : '#ede4d3' }}>
        {value}{hint && <span className="ml-1 font-normal opacity-70">· {hint}</span>}
      </p>
    </div>
  )
}
