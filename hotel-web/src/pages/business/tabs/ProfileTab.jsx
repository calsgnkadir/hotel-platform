import { useState, useEffect } from 'react'
import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import ChangePasswordCard from '../../../components/ChangePasswordCard'
import GdprCard from '../../../components/GdprCard'
import { SkeletonForm } from '../../../components/Skeleton'
import { validateTurkeyPhone, formatTurkeyPhoneInput } from '../../../utils/validation'
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
export default function ProfileTab() {
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
    if (!confirm('Logo silinsin mi?')) return
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
    if (!confirm('Foto silinsin mi?')) return
    try {
      await hotelApi.deleteBusinessPhoto(photoId)
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      toast.success('Foto silindi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('İşletme adı zorunlu')

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
      toast.error(extractErrorMessage(err))
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
    <div className="grid xl:grid-cols-[1fr_360px] gap-4 items-start max-w-[1400px] mx-auto">
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
        <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
            style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
          Temel Bilgiler
        </h3>

        <div>
          <label className="label">İşletme Adı *</label>
          <input type="text" name="name" value={form.name} onChange={handleChange}
            className="input" placeholder="Test Otel" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Tür *</label>
            <select name="type" value={form.type} onChange={handleChange} className="input">
              {Object.entries(BUSINESS_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Kategori <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
            <input type="text" name="category" value={form.category} onChange={handleChange}
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
          <label className="label">Adres <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
          <input type="text" name="address" value={form.address} onChange={handleChange}
            className="input" placeholder="Sokak, bina no, kat" />
        </div>

        <div>
          <label className="label">Açıklama <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
          <textarea name="description" value={form.description} onChange={handleChange}
            className="input resize-none h-24 text-sm"
            placeholder="İşletmenizi adaylara tanıtın..." />
        </div>
      </div>

      {/* İletişim */}
      <div className="card p-5 space-y-4">
        <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
            style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
          İletişim
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Telefon</label>
            <input type="tel" name="phone" value={form.phone} maxLength={14}
              onChange={e => setForm(prev => ({ ...prev, phone: formatTurkeyPhoneInput(e.target.value) }))}
              className="input" placeholder="0212 555 12 34" />
          </div>
          <div>
            <label className="label">Web Sitesi</label>
            <input type="text" name="website" value={form.website} onChange={handleChange}
              className="input" placeholder="https://..." />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Instagram</label>
            <input type="text" name="instagram" value={form.instagram} onChange={handleChange}
              className="input" placeholder="@kullaniciadi" />
          </div>
          <div>
            <label className="label">Facebook</label>
            <input type="text" name="facebook" value={form.facebook} onChange={handleChange}
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
        <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
            style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
          Çalışma Saatleri
        </h3>
        <WorkingHoursEditor
          value={parseWorkingHours(form.workingHours)}
          onChange={(struct) =>
            setForm(prev => ({ ...prev, workingHours: JSON.stringify(struct) }))
          }
        />
      </div>

      <div className="flex justify-end gap-3">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 font-bebas text-base tracking-wider uppercase text-white rounded-full transition-all disabled:opacity-60 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #1e3a5f, #b8902d)', boxShadow: '0 0 18px rgba(212, 168, 83, 0.40)' }}>
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </form>

    {/* Dalga G3 — Sifre + GDPR yan yana (compact alt satir) */}
    <div className="grid lg:grid-cols-2 gap-4">
      <ChangePasswordCard />
      <GdprCard />
    </div>
    </div>

    {/* === SAG KOLON: Canli Onizleme === */}
    <aside className="xl:sticky xl:top-4 xl:self-start">
      <BusinessPreviewCard form={form} logoUrl={logoUrl} />
    </aside>
    </div>
  )
}

/* Canli Onizleme — form degistikce sag panelde guncellenir
   Kullanici (aday) public sayfayi nasil gorecek? */
function BusinessPreviewCard({ form, logoUrl }) {
  const TYPE_LABELS = { HOTEL: 'Otel', RESTAURANT: 'Restoran', CAFE: 'Kafe', OTHER: 'Diğer' }
  const initial = (form.name || 'A').trim().charAt(0).toUpperCase()
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between"
           style={{ borderColor: 'rgba(212, 168, 83, 0.18)' }}>
        <h3 className="font-bebas text-base tracking-[0.2em] uppercase"
            style={{ color: '#fde9a5' }}>Canlı Önizleme</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(229, 231, 235, 0.45)' }}>aday bu şekilde görür</span>
      </div>
      <div className="p-4">
        {/* Logo + isim */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
               style={{
                 background: 'rgba(212, 168, 83, 0.10)',
                 border: '1px solid rgba(212, 168, 83, 0.30)',
               }}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="font-bebas text-2xl" style={{ color: '#f7c43c' }}>{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bebas text-xl tracking-wider uppercase truncate"
                 style={{ color: '#ffffff' }}>
              {form.name || 'İşletme adınız'}
            </div>
            <div className="text-[11px] uppercase tracking-wider mt-0.5"
                 style={{ color: '#fde9a5' }}>
              {TYPE_LABELS[form.type] || form.type}
              {form.category && ` · ${form.category}`}
            </div>
          </div>
        </div>

        {/* Konum */}
        {(form.district || form.address) && (
          <div className="flex items-start gap-2 text-[12px] mb-3"
               style={{ color: 'rgba(229, 231, 235, 0.75)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                 className="flex-shrink-0 mt-0.5" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <div className="min-w-0">
              {form.district && <div className="font-medium">{form.district}{form.neighborhood && ` / ${form.neighborhood}`}</div>}
              {form.address && <div className="text-[11px] mt-0.5 line-clamp-2"
                                     style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
                {form.address}
              </div>}
            </div>
          </div>
        )}

        {/* Telefon */}
        {form.phone && (
          <div className="flex items-center gap-2 text-[12px] mb-3"
               style={{ color: 'rgba(229, 231, 235, 0.75)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>{form.phone}</span>
          </div>
        )}

        {/* Aciklama */}
        {form.description && (
          <p className="text-[12px] leading-relaxed mb-3 line-clamp-4"
             style={{ color: 'rgba(229, 231, 235, 0.65)' }}>
            {form.description}
          </p>
        )}

        {/* Sosyal */}
        {(form.website || form.instagram || form.facebook) && (
          <div className="pt-3 border-t flex items-center gap-2 flex-wrap"
               style={{ borderColor: 'rgba(212, 168, 83, 0.12)' }}>
            {form.website && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded"
                    style={{ background: 'rgba(212, 168, 83, 0.12)', color: '#fde9a5' }}>
                Web
              </span>
            )}
            {form.instagram && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded"
                    style={{ background: 'rgba(212, 168, 83, 0.12)', color: '#fde9a5' }}>
                Instagram
              </span>
            )}
            {form.facebook && (
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded"
                    style={{ background: 'rgba(212, 168, 83, 0.12)', color: '#fde9a5' }}>
                Facebook
              </span>
            )}
          </div>
        )}

        {/* Bos durumu */}
        {!form.name && !form.district && !form.description && (
          <p className="text-center text-[11px] italic py-4"
             style={{ color: 'rgba(229, 231, 235, 0.40)' }}>
            Form alanlarını doldurdukça burada güncellenir.
          </p>
        )}
      </div>
    </div>
  )
}
