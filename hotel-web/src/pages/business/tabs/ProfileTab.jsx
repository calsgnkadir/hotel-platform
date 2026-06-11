import { useState, useEffect } from 'react'
import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import ChangePasswordCard from '../../../components/ChangePasswordCard'
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
      const payload = {
        name:         form.name.trim(),
        type:         form.type,
        district:     form.district || null,
        neighborhood: form.neighborhood?.trim() || null,
        address:      form.address.trim() || null,
        latitude:     form.latitude  ?? null,
        longitude:    form.longitude ?? null,
        description:  form.description.trim() || null,
        phone:        form.phone.trim() || null,
        website:      form.website.trim() || null,
        category:     form.category.trim() || null,
        instagram:    form.instagram.trim() || null,
        facebook:     form.facebook.trim() || null,
        workingHours: form.workingHours.trim() || null,
      }
      const data = await hotelApi.updateBusinessProfile(payload)
      setForm(prev => ({ ...prev, ...data }))
      toast.success('Profil güncellendi!')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>
  if (!form) return null

  // FAZ 1/#34 — Profil doluluk hesaplama (anlık, form state'inden)
  const completeness = calculateBusinessCompleteness(
    { ...form, logoUrl },
    { hasPhoto: photos.length > 0 }
  )

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
    <ProfileCompletenessCard data={completeness} />
    <form onSubmit={handleSubmit} className="space-y-5">
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

      {/* Temel bilgiler */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Temel Bilgiler</h3>

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
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">İletişim</h3>

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
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Çalışma Saatleri</h3>
        <WorkingHoursEditor
          value={parseWorkingHours(form.workingHours)}
          onChange={(struct) =>
            setForm(prev => ({ ...prev, workingHours: JSON.stringify(struct) }))
          }
        />
      </div>

      <div className="flex justify-end gap-3">
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
