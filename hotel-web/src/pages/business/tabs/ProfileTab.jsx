import { useState, useEffect } from 'react'
import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import ChangePasswordCard from '../../../components/ChangePasswordCard'
import PhoneVerifyCard from '../../../components/PhoneVerifyCard'
import GdprCard from '../../../components/GdprCard'
import NotificationSettings from '../../../components/NotificationSettings'
import { SkeletonForm } from '../../../components/Skeleton'
import { validateTurkeyPhone, formatTurkeyPhoneInput } from '../../../utils/validation'
import { useConfirm } from '../../../lib/useConfirm'
import DistrictNeighborhoodSelect from '../../../components/DistrictNeighborhoodSelect'
import GalleryEditor from '../../../components/GalleryEditor'
import { BUSINESS_TYPE_LABELS } from '../lib/constants'
import { parseWorkingHours } from '../lib/helpers'
import BusinessLocationEditor from '../components/BusinessLocationEditor'
import WorkingHoursEditor from '../components/WorkingHoursEditor'
import MediaBlock from '../components/MediaBlock'
import ProfileCompletenessCard from '../../../components/ProfileCompletenessCard'
import { calculateBusinessCompleteness } from '../../../lib/profileCompleteness'

/* ── Profile Tab ── */
// Sunucudaki WebsiteUrlPolicy ile aynı kural (yardımcıdır; asıl kontrol backend'de):
// boş serbest; doluysa boşluksuz, en çok 255 karakter, http/https şeması, kullanıcı bilgisi yok, host var.
export const WEBSITE_MESSAGE = 'Web sitesi adresi http:// veya https:// ile başlamalı (örn: https://www.isletmem.com).'
export function websiteError(raw) {
  const v = (raw || '').trim()
  if (!v) return false
  if (v.length > 255 || /\s/.test(v)) return true
  try {
    const u = new URL(v)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return true
    if (u.username || u.password) return true
    return !u.hostname
  } catch {
    return true
  }
}

export default function ProfileTab() {
  const confirm = useConfirm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [logoUrl, setLogoUrl] = useState(null)
  const [logoVersion, setLogoVersion] = useState(0)  // cache buster
  const [photos, setPhotos] = useState([])

  useEffect(() => {
    Promise.all([
      hotelApi.getBusinessProfile(),
      hotelApi.getMyBusinessPhotos(),
    ])
      .then(([profile, gallery]) => {
        setForm({
          name:         profile.name         || '',
          type:         profile.type         || 'HOTEL',
          district:     profile.district     || '',
          neighborhood: profile.neighborhood || '',
          address:      profile.address      || '',
          latitude:     profile.latitude     ?? null,
          longitude:    profile.longitude    ?? null,
          description:  profile.description  || '',
          phone:        profile.phone        || '',
          website:      profile.website      || '',
          category:     profile.category     || '',
          instagram:    profile.instagram    || '',
          facebook:     profile.facebook     || '',
          workingHours: profile.workingHours || '',
        })
        setLogoUrl(profile.logoUrl)
        setPhotos(gallery)
      })
      .catch(() => toast.error('Profil yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  async function handleLogoUpload(file) {
    try {
      const updated = await hotelApi.uploadBusinessLogo(file)
      setLogoUrl(updated.logoUrl)
      setLogoVersion(v => v + 1)
      toast.success('Logo yüklendi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  async function handleLogoDelete() {
    const ok = await confirm({
      title: 'Logoyu sil',
      description: 'İşletme logosu kaldırılacak. Yenisini istediğin zaman yükleyebilirsin.',
      confirmLabel: 'Evet, sil',
      destructive: true,
    })
    if (!ok) return
    try {
      await hotelApi.deleteBusinessLogo()
      setLogoUrl(null)
      toast.success('Logo silindi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  async function handlePhotoUpload(file) {
    try {
      const newPhoto = await hotelApi.uploadBusinessPhoto(file)
      setPhotos(prev => [newPhoto, ...prev])
      toast.success('Foto eklendi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  async function handlePhotoDelete(photoId) {
    const ok = await confirm({
      title: 'Fotoğrafı sil',
      description: 'Bu fotoğraf galeriden kaldırılacak.',
      confirmLabel: 'Evet, sil',
      destructive: true,
    })
    if (!ok) return
    try {
      await hotelApi.deleteBusinessPhoto(photoId)
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      toast.success('Foto silindi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  const [websiteTouched, setWebsiteTouched] = useState(false)
  const [websiteServerError, setWebsiteServerError] = useState(null)
  const websiteHelp = websiteServerError || (websiteTouched && websiteError(form?.website) ? WEBSITE_MESSAGE : null)

  function handleChange(e) {
    if (e.target.name === 'website') setWebsiteServerError(null)
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('İşletme adı zorunlu')
    if (websiteError(form.website)) {
      setWebsiteTouched(true)
      document.getElementById('biz-profile-website')?.focus()
      return toast.error(WEBSITE_MESSAGE)
    }

    const phoneError = validateTurkeyPhone(form.phone)
    if (phoneError) return toast.error(phoneError)

    setSaving(true)
    try {
      // Tum string trim'lerini null'a guvenli yap — backend null donerse setForm spread
      // sonrasi field null olur, bir sonraki kaydet'te ".trim()" patlardi.
      const s = (v) => (v || '').trim()
      const payload = {
        name:         s(form.name),
        type:         form.type,
        district:     form.district || null,
        neighborhood: s(form.neighborhood) || null,
        address:      s(form.address) || null,
        latitude:     form.latitude  ?? null,
        longitude:    form.longitude ?? null,
        description:  s(form.description) || null,
        phone:        s(form.phone) || null,
        website:      s(form.website) || null,
        category:     s(form.category) || null,
        instagram:    s(form.instagram) || null,
        facebook:     s(form.facebook) || null,
        workingHours: s(form.workingHours) || null,
      }
      const data = await hotelApi.updateBusinessProfile(payload)
      // Backend'in null donen string field'larini bos string'e normalize et —
      // controlled input'lar uncontrolled'a duser yoksa, ".trim()" crash eder.
      setForm(prev => ({
        ...prev,
        ...data,
        name:         data.name ?? '',
        neighborhood: data.neighborhood ?? '',
        address:      data.address ?? '',
        description:  data.description ?? '',
        phone:        data.phone ?? '',
        website:      data.website ?? '',
        category:     data.category ?? '',
        instagram:    data.instagram ?? '',
        facebook:     data.facebook ?? '',
        workingHours: data.workingHours ?? '',
      }))
      toast.success('Profil güncellendi!')
    } catch (err) {
      const msg = extractErrorMessage(err)
      // Sunucu (WebsiteUrlPolicy) 422 ile reddederse mesaj alanın altında da görünsün
      if (err?.response?.status === 422 && /web sitesi|website/i.test(msg)) setWebsiteServerError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <SkeletonForm fields={6} />
  if (!form) return null

  // FAZ 1/#34 — Profil doluluk hesaplama (anlık, form state'inden)
  const completeness = calculateBusinessCompleteness(
    { ...form, logoUrl },
    { hasPhoto: photos.length > 0 }
  )

  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-4 items-start">
    <div className="space-y-5 min-w-0">
    <ProfileCompletenessCard data={completeness} />
    <form onSubmit={handleSubmit} className="space-y-4">
      <MediaBlock
        logoUrl={logoUrl}
        logoVersion={logoVersion}
        photos={photos}
        onLogoUpload={handleLogoUpload}
        onLogoDelete={handleLogoDelete}
        onPhotoUpload={handlePhotoUpload}
        onPhotoDelete={handlePhotoDelete}
      />

      <GalleryEditor />

      {/* Dalga G3 — Temel + Iletisim yan yana (uzun sayfa kompakt) */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">

      {/* Temel bilgiler */}
      <div className="card p-5 space-y-4">
        <h3 className="type-card pb-3 border-b" style={{ borderColor: 'var(--ah-line)' }}>
          Temel bilgiler
        </h3>

        <div>
          <label htmlFor="biz-profile-name" className="label">İşletme adı *</label>
          <input id="biz-profile-name" type="text" name="name" value={form.name} onChange={handleChange}
            className="input" placeholder="Test Otel" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="biz-profile-type" className="label">Tür *</label>
            <select id="biz-profile-type" name="type" value={form.type} onChange={handleChange} className="input">
              {Object.entries(BUSINESS_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="biz-profile-category" className="label">Kategori <span className="text-ink-400 font-normal">(isteğe bağlı)</span></label>
            <input id="biz-profile-category" type="text" name="category" value={form.category} onChange={handleChange}
              className="input" placeholder="5*, 4*, Boutique vb." />
          </div>
        </div>

        <DistrictNeighborhoodSelect
          district={form.district}
          neighborhood={form.neighborhood}
          onChange={({ district, neighborhood }) =>
            setForm(prev => ({ ...prev, district, neighborhood }))
          } />

        <div>
          <label htmlFor="biz-profile-address" className="label">Adres <span className="text-ink-400 font-normal">(isteğe bağlı)</span></label>
          <input id="biz-profile-address" type="text" name="address" value={form.address} onChange={handleChange}
            className="input" placeholder="Sokak, bina no, kat" />
        </div>

        <div>
          <label htmlFor="biz-profile-description" className="label">Açıklama <span className="text-ink-400 font-normal">(isteğe bağlı)</span></label>
          <textarea id="biz-profile-description" name="description" value={form.description} onChange={handleChange}
            className="input resize-none h-24 text-sm"
            placeholder="İşletmenizi adaylara tanıtın..." />
        </div>
      </div>

      {/* İletişim */}
      <div className="card p-5 space-y-4">
        <h3 className="type-card pb-3 border-b" style={{ borderColor: 'var(--ah-line)' }}>
          İletişim
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="biz-profile-phone" className="label">Telefon</label>
            <input id="biz-profile-phone" type="tel" name="phone" value={form.phone} maxLength={14}
              onChange={e => setForm(prev => ({ ...prev, phone: formatTurkeyPhoneInput(e.target.value) }))}
              className="input" placeholder="0212 555 12 34" />
          </div>
          <div>
            <label htmlFor="biz-profile-website" className="label">Web sitesi</label>
            <input id="biz-profile-website" type="text" inputMode="url" name="website" value={form.website}
              onChange={handleChange} onBlur={() => setWebsiteTouched(true)}
              autoComplete="url" maxLength={255}
              aria-invalid={websiteHelp ? 'true' : undefined}
              aria-describedby="biz-profile-website-help"
              className="input" placeholder="https://www.isletmem.com" />
            <p id="biz-profile-website-help" className="type-caption mt-1"
               style={websiteHelp ? { color: 'var(--ah-danger)' } : undefined}
               role={websiteHelp ? 'alert' : undefined}>
              {websiteHelp || 'http:// veya https:// ile başlayan tam adres.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="biz-profile-instagram" className="label">Instagram</label>
            <input id="biz-profile-instagram" type="text" name="instagram" value={form.instagram} onChange={handleChange}
              className="input" placeholder="@kullaniciadi" />
          </div>
          <div>
            <label htmlFor="biz-profile-facebook" className="label">Facebook</label>
            <input id="biz-profile-facebook" type="text" name="facebook" value={form.facebook} onChange={handleChange}
              className="input" placeholder="sayfa adı veya URL" />
          </div>
        </div>
      </div>

      </div>  {/* 2-col Temel+Iletisim kapanis */}

      {form.district && (
        <BusinessLocationEditor
          district={form.district}
          neighborhood={form.neighborhood}
          businessName={form.businessName}
          address={form.address}
          latitude={form.latitude}
          longitude={form.longitude}
          onChange={(lat, lng) => setForm(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
          }))}
        />
      )}

      <div className="card p-5 space-y-3">
        <h3 className="type-card pb-3 border-b" style={{ borderColor: 'var(--ah-line)' }}>
          Çalışma saatleri
        </h3>
        <WorkingHoursEditor
          value={parseWorkingHours(form.workingHours)}
          onChange={(struct) =>
            setForm(prev => ({ ...prev, workingHours: JSON.stringify(struct) }))
          }
        />
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={saving} className="btn-primary sm:!w-auto">
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri kaydet'}
        </button>
      </div>
    </form>

    </div>

    {/* === SAG KOLON: Canli Onizleme + Sifre + KVKK (alt alta) === */}
    <aside className="xl:sticky xl:top-4 xl:self-start space-y-4">
      <BusinessPreviewCard form={form} logoUrl={logoUrl} />
      <NotificationSettings />
      <PhoneVerifyCard audience="business" />
      <ChangePasswordCard />
      <GdprCard />
    </aside>
    </div>
  )
}

/* Canli Onizleme — form degistikce sag panelde guncellenir
   Kullanici (aday) public sayfayi nasil gorecek? */
function BusinessPreviewCard({ form, logoUrl }) {
  const TYPE_LABELS = BUSINESS_TYPE_LABELS
  const initial = (form.name || 'A').trim().charAt(0).toUpperCase()
  const typeLine = [TYPE_LABELS[form.type] || form.type, form.category].filter(Boolean).join(' · ')
  const links = [
    form.website && 'Web sitesi',
    form.instagram && 'Instagram',
    form.facebook && 'Facebook',
  ].filter(Boolean)
  return (
    <section className="card overflow-hidden" aria-labelledby="biz-preview-title">
      <div className="px-4 py-3 border-b flex items-baseline justify-between gap-3"
           style={{ borderColor: 'var(--ah-line)' }}>
        <h3 id="biz-preview-title" className="type-card">Canlı önizleme</h3>
        <span className="type-label">Aday bu şekilde görür</span>
      </div>
      <div className="p-4">
        {/* Logo + isim — acik logo kutusu (Paket B ile ayni dil) */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
               style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line-2)' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[22px] font-bold" style={{ color: 'var(--ah-ink)' }}>{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="type-section truncate">
              {form.name || 'İşletme adınız'}
            </div>
            {typeLine && <div className="type-meta mt-0.5 truncate">{typeLine}</div>}
          </div>
        </div>

        {/* Konum */}
        {(form.district || form.address) && (
          <div className="flex items-start gap-2 type-meta mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="flex-shrink-0 mt-0.5" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div className="min-w-0">
              {form.district && <div style={{ color: 'var(--ah-ink-2)' }}>{form.district}{form.neighborhood && ` / ${form.neighborhood}`}</div>}
              {form.address && <div className="type-caption mt-0.5 line-clamp-2">{form.address}</div>}
            </div>
          </div>
        )}

        {/* Telefon */}
        {form.phone && (
          <div className="flex items-center gap-2 type-meta mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span className="type-num">{form.phone}</span>
          </div>
        )}

        {/* Aciklama */}
        {form.description && (
          <p className="type-body mb-3 line-clamp-4" style={{ color: 'var(--ah-ink-2)' }}>
            {form.description}
          </p>
        )}

        {/* Sosyal */}
        {links.length > 0 && (
          <div className="pt-3 border-t flex items-center gap-2 flex-wrap"
               style={{ borderColor: 'var(--ah-line)' }}>
            {links.map(l => <span key={l} className="ah-chip">{l}</span>)}
          </div>
        )}

        {/* Bos durumu */}
        {!form.name && !form.district && !form.description && (
          <p className="text-center type-caption py-4">
            Form alanlarını doldurdukça burada güncellenir.
          </p>
        )}
      </div>
    </section>
  )
}
