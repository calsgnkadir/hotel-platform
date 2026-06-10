import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import ChangePasswordCard from '../../components/ChangePasswordCard'
import { validateTurkeyPhone, formatTurkeyPhoneInput } from '../../utils/validation'
import DistrictNeighborhoodSelect from '../../components/DistrictNeighborhoodSelect'
import { ISTANBUL_DISTRICTS } from '../../data/istanbul'
import MessagesPage from '../MessagesPage'
import GalleryEditor from '../../components/GalleryEditor'
import MapView from '../../components/MapView'
// Ayarlar + Yardım header'daki ⚙ SettingsMenu'ye taşındı (sidebar'dan kaldırıldı)
// #89 v2: Grafikler kaldırıldı (StatusDonut + DailyTrendLine + PositionBar) — sade görünüm
// #9 (FAZ 0) — Refactor: sabitler + helpers + Badges artık ayrı dosyalarda

import {
  POSITION_LABELS, JOB_TYPE_LABELS, SHIFT_LABELS, SHIFT_SHORT, STATUS_LABELS,
  SENSITIVE_DOC_TYPES_BIZ, DOC_REQ_STATUS_LABELS, BUSINESS_TYPE_LABELS,
  WEEKDAYS, DEFAULT_HOURS,
} from './lib/constants'
import { parseWorkingHours, shiftHoursBiz } from './lib/helpers'
import { StatusBadge, NoShowBadge } from './components/Badges'
import BusinessLocationEditor from './components/BusinessLocationEditor'
import WorkingHoursEditor from './components/WorkingHoursEditor'
import MediaBlock from './components/MediaBlock'
import ListingFormModal from './modals/ListingFormModal'

/* ── Workers Tab (#78) — Bizde çalışan adaylar ── */
// shiftHoursBiz artık lib/helpers'da

function WorkersTab({ applications, onOpenMessages }) {
  // Aday başına grupla: { candidateId -> { candidate, totalHours, jobCount, lastDate, applications[] } }
  const completed = applications.filter(a => a.status === 'ACCEPTED' && a.workCompleted)

  const grouped = {}
  for (const app of completed) {
    const cid = app.candidate?.id
    if (!cid) continue
    if (!grouped[cid]) {
      grouped[cid] = {
        candidate: app.candidate,
        totalHours: 0,
        jobCount: 0,
        lastDate: null,
        apps: [],
      }
    }
    const g = grouped[cid]
    g.jobCount++
    g.apps.push(app)
    for (const s of app.requestedSlots || []) {
      g.totalHours += shiftHoursBiz(s.startTime, s.endTime)
      if (s.date && (!g.lastDate || s.date > g.lastDate)) g.lastDate = s.date
    }
  }

  const workers = Object.values(grouped).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))

  if (workers.length === 0) {
    return (
      <div className="card">
        <div className="empty-state py-16">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 text-ink-300 mb-3">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <p className="font-medium text-ink-700">Henüz tamamlanmış çalışma yok</p>
          <p className="text-sm text-ink-500 mt-1">
            Kabul ettiğiniz adayların vardiya günü geçince burada toplanır
          </p>
        </div>
      </div>
    )
  }

  const totalHours = workers.reduce((s, w) => s + w.totalHours, 0)

  return (
    <div className="space-y-4">
      {/* Özet */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-ink-900">{workers.length}</div>
          <div className="text-xs text-ink-500 mt-0.5">Farklı Aday Çalıştı</div>
        </div>
        <div className="stat-card">
          <div className="w-10 h-10 rounded-xl bg-brand-700 flex items-center justify-center mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 strokeWidth={1.8} stroke="white" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>
          <div className="text-2xl font-bold text-ink-900">{totalHours.toFixed(0)}<span className="text-base">sa</span></div>
          <div className="text-xs text-ink-500 mt-0.5">Toplam İş Saati</div>
        </div>
      </div>

      {/* Aday listesi */}
      <div className="space-y-3">
        {workers.map(w => (
          <div key={w.candidate.id} className="card">
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {w.candidate?.avatarUrl ? (
                  <img src={w.candidate.avatarUrl} alt={w.candidate.fullName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-cream-300" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                    {w.candidate?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-semibold text-ink-800 dark:text-ink-900 truncate">{w.candidate?.fullName}</div>
                  <div className="text-xs text-ink-500 mt-0.5">{w.candidate?.email}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                    <span className="text-ink-600">{w.totalHours.toFixed(1)} saat</span>
                    <span className="text-ink-600">{w.jobCount} iş</span>
                    {w.lastDate && (
                      <span className="text-ink-600">
                        Son: {new Date(w.lastDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    await hotelApi.startConversation({ otherPartyId: w.candidate.id })
                    onOpenMessages?.()
                  } catch (err) { toast.error(extractErrorMessage(err)) }
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors font-medium flex-shrink-0">
                Mesaj
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Profile Tab ── */
function ProfileTab() {
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
          latitude:     profile.latitude     ?? null,   // #81 v2: tam konum
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

    // #74: Phone validation (mobil veya sabit hat)
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
        latitude:     form.latitude  ?? null,   // #81 v2
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
      setForm(prev => ({ ...prev, ...data }))  // backend'den güncel değerleri al
      toast.success('Profil güncellendi!')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>
  if (!form) return null

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Logo */}
      <MediaBlock
        logoUrl={logoUrl}
        logoVersion={logoVersion}
        photos={photos}
        onLogoUpload={handleLogoUpload}
        onLogoDelete={handleLogoDelete}
        onPhotoUpload={handlePhotoUpload}
        onPhotoDelete={handlePhotoDelete}
      />

      {/* #87: Galeri — drag-drop sıralama + kapak seçme */}
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

        {/* İlçe + Mahalle (cascading) */}
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

      {/* #81 v2: Tam konum — işletme harita üzerinde tıklayıp belirler */}
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

      {/* Çalışma saatleri */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-bold text-ink-800 dark:text-ink-800 uppercase tracking-wider">Çalışma Saatleri</h3>
        <WorkingHoursEditor
          value={parseWorkingHours(form.workingHours)}
          onChange={(struct) =>
            setForm(prev => ({ ...prev, workingHours: JSON.stringify(struct) }))
          }
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)', boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)' }}>
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </form>

    {/* D3: Şifre Değiştir — profil form'unun dışında ayrı kart */}
    <ChangePasswordCard />
    </div>
  )
}

/* ── My Listings Tab ── */
function MyListingsTab() {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [formTarget, setFormTarget] = useState(null)  // null=closed, 'new'=create, object=edit

  const fetchListings = useCallback(async () => {
    try {
      const data = await hotelApi.getMyListings()
      setListings(data)
    } catch {
      toast.error('İlanlar yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchListings() }, [fetchListings])

  async function handleStatusChange(listingId, status) {
    try {
      await hotelApi.updateListingStatus(listingId, status)
      toast.success('İlan durumu güncellendi')
      fetchListings()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"/></div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-ink-500">{listings.length} ilan</p>
        <button onClick={() => setFormTarget('new')}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
          + Yeni İlan
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <p className="font-medium text-ink-700">Henüz ilanınız yok</p>
            <p className="text-sm text-ink-500 mt-1">İlk ilanınızı oluşturun</p>
            <button onClick={() => setFormTarget('new')}
              className="mt-4 px-4 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
              İlan Oluştur
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {listings.map(listing => (
            <div key={listing.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-ink-800 dark:text-ink-900">{listing.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      listing.status === 'ACTIVE' ? 'bg-brand-50 text-brand-700' :
                      listing.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' :
                      'bg-cream-100 text-ink-500'}`}>
                      {STATUS_LABELS[listing.status]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">
                    {POSITION_LABELS[listing.position]} · {JOB_TYPE_LABELS[listing.jobType]}
                    {listing.shift && ` · ${SHIFT_SHORT[listing.shift]}`}
                  </p>
                  {(listing.salaryMin || listing.salaryMax) && (
                    <p className="text-xs text-brand-700 font-medium mt-0.5">
                      {listing.salaryMin?.toLocaleString('tr-TR')}
                      {listing.salaryMax && ` – ${listing.salaryMax.toLocaleString('tr-TR')}`} ₺
                    </p>
                  )}
                  {/* Faz E2: slot özeti */}
                  {listing.shiftSlots?.length > 0 && (() => {
                    const total      = listing.shiftSlots.length
                    const next       = listing.shiftSlots[0]  // backend tarihe göre sıralı dönüyor
                    const totalSeats = listing.shiftSlots.reduce((sum, s) => sum + (s.slotsNeeded || 0), 0)
                    const filled     = listing.shiftSlots.reduce((sum, s) => sum + (s.slotsFilled || 0), 0)
                    const nextStr = next
                      ? `${new Date(next.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${next.startTime?.slice(0, 5)}–${next.endTime?.slice(0, 5)}`
                      : null
                    return (
                      <p className="text-xs text-brand-700 dark:text-brand-700 font-medium mt-0.5">
                        {total} vardiya
                        {nextStr && ` · en yakın: ${nextStr}`}
                        {totalSeats > 0 && ` · ${filled}/${totalSeats} dolu`}
                      </p>
                    )
                  })()}
                  <p className="text-xs text-ink-400 mt-0.5">
                    {new Date(listing.createdAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  {listing.status !== 'CLOSED' && (
                    <button onClick={() => setFormTarget(listing)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors font-medium">
                      Düzenle
                    </button>
                  )}
                  {listing.status === 'ACTIVE' && (
                    <button onClick={() => handleStatusChange(listing.id, 'PAUSED')}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
                      Durdur
                    </button>
                  )}
                  {listing.status === 'PAUSED' && (
                    <button onClick={() => handleStatusChange(listing.id, 'ACTIVE')}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-emerald-100 transition-colors font-medium">
                      Aktifleştir
                    </button>
                  )}
                  {listing.status !== 'CLOSED' && (
                    <button onClick={() => handleStatusChange(listing.id, 'CLOSED')}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-cream-100 text-ink-600 hover:bg-cream-200 transition-colors font-medium">
                      Kapat
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget && (
        <ListingFormModal
          listing={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSuccess={fetchListings}
        />
      )}
    </div>
  )
}

/* ── Applications Tab ── */
const APPS_PAGE_SIZE = 15

function ApplicationsTab({ applications, onRefresh, onOpenMessages }) {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [note, setNote] = useState('')
  const [accessibleDocs, setAccessibleDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)

  // Modal açıldığında veya selected güncellendiğinde, erişilebilir belgeleri yükle
  useEffect(() => {
    if (!selected) { setAccessibleDocs([]); return }
    setDocsLoading(true)
    hotelApi.getApplicationDocuments(selected.id)
      .then(setAccessibleDocs)
      .catch(() => setAccessibleDocs([]))
      .finally(() => setDocsLoading(false))
  }, [selected?.id, selected?.documentRequests?.length])

  async function handleViewDoc(doc) {
    try {
      await hotelApi.viewDocument(doc.id)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  // #84: status filtresi + aday adı araması (client-side; backend de destekler)
  const filtered = applications.filter(a => {
    if (filter !== 'ALL' && a.status !== filter) return false
    if (search.trim()) {
      const name = (a.candidate?.fullName || '').toLowerCase()
      if (!name.includes(search.trim().toLowerCase())) return false
    }
    return true
  })

  // Client-side sayfalama
  const pageCount = Math.max(1, Math.ceil(filtered.length / APPS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * APPS_PAGE_SIZE, safePage * APPS_PAGE_SIZE + APPS_PAGE_SIZE)

  async function handleReview(appId) {
    setActionLoading(true)
    try {
      await hotelApi.startReview(appId)
      toast.success('Başvuru incelemeye alındı')
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleDecision(appId, decision) {
    setActionLoading(true)
    try {
      await hotelApi.reviewApplication(appId, decision, note)
      toast.success(decision === 'ACCEPTED' ? 'Başvuru kabul edildi ' : 'Başvuru reddedildi')
      setSelected(null)
      setNote('')
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleNoShow(appId) {
    if (!confirm('Bu adayı NO-SHOW olarak işaretlemek istediğinize emin misiniz?\n\nBu işlem geri alınamaz. Adayın strike hakkı 1 düşecek, sıfıra inerse 30 gün otomatik banlanacak.')) {
      return
    }
    setActionLoading(true)
    try {
      const result = await hotelApi.markNoShow(appId)
      if (result.autoBanned) {
        const banDate = new Date(result.bannedUntil).toLocaleDateString('tr-TR')
        toast.success(`No-show işaretlendi. Aday otomatik olarak ${banDate} tarihine kadar banlandı.`, { duration: 5000 })
      } else {
        toast.success(`No-show işaretlendi. Adayın kalan strike hakkı: ${result.candidateStrikesRemaining}`)
      }
      setSelected(result.application)
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  const [requestingType, setRequestingType] = useState('')

  async function handleRequestDoc() {
    if (!requestingType || !selected) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.requestDocument(selected.id, requestingType)
      toast.success('Belge talebi gönderildi')
      setRequestingType('')
      setSelected(updated)  // güncel documentRequests listesi ile modal'ı yenile
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Filtre + arama */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED'].map(f => {
            const labels = { ALL: 'Tümü', PENDING: 'Bekleyen', REVIEWING: 'İnceleniyor', ACCEPTED: 'Kabul', REJECTED: 'Red' }
            const count = f === 'ALL' ? applications.length : applications.filter(a => a.status === f).length
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(0) }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
                  ${filter === f
                    ? 'text-white shadow-sm'
                    : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
                style={filter === f ? { background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' } : {}}>
                {labels[f]} ({count})
              </button>
            )
          })}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Aday adı ara..." className="input text-sm" />
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state py-12">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-ink-300 mb-3">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
              </svg>
              <p className="text-ink-500 text-sm">Bu filtreye uyan başvuru yok</p>
            </div>
          </div>
        ) : pageItems.map(app => (
          <div key={app.id} className="card hover:border-brand-300 dark:hover:border-brand-700 cursor-pointer transition-all"
               onClick={() => setSelected(app)}>
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {app.candidate?.avatarUrl ? (
                  <img src={app.candidate.avatarUrl} alt={app.candidate.fullName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-cream-300" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                    {app.candidate?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-ink-800 dark:text-ink-900">{app.candidate?.fullName}</div>
                  <div className="text-xs text-ink-500">{app.candidate?.email}</div>
                  <div className="text-xs text-ink-400 mt-0.5">{app.listing?.title}</div>
                  <div className="text-xs text-ink-400">
                    {new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={app.status} />
                {app.noShow && <NoShowBadge />}
                {/* Chat-v2: 'İncelemeye Al' yerine direkt 'Mesajlaşmaya git' */}
                <button onClick={e => { e.stopPropagation(); onOpenMessages?.(app.conversationId) }}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white transition-all flex items-center gap-1"
                  style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  Mesajlaşma
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* #84: Pagination footer */}
        {filtered.length > APPS_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 pt-2 px-1 text-xs text-ink-500">
            <span>
              {filtered.length} sonuçtan {safePage * APPS_PAGE_SIZE + 1}
              {' – '}
              {Math.min((safePage + 1) * APPS_PAGE_SIZE, filtered.length)}
              {' arası'}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-3 py-1.5 rounded-md bg-white dark:bg-ink-800 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                ← Önceki
              </button>
              <span className="font-semibold text-ink-700">
                {safePage + 1} / {pageCount}
              </span>
              <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="px-3 py-1.5 rounded-md bg-white dark:bg-ink-800 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                Sonraki →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-cream-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selected.candidate?.avatarUrl ? (
                    <img src={selected.candidate.avatarUrl} alt={selected.candidate.fullName}
                      className="w-14 h-14 rounded-full object-cover border border-cream-300 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                         style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                      {selected.candidate?.fullName?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-ink-900">{selected.candidate?.fullName}</h2>
                    <p className="text-sm text-ink-500">{selected.candidate?.email}</p>
                  </div>
                </div>
                <StatusBadge status={selected.status} />
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">İlan</h3>
                <div className="bg-cream-50 rounded-lg p-3 text-sm font-medium text-ink-700">
                  {selected.listing?.title} · {selected.listing?.businessName}
                </div>
              </div>

              {selected.coverLetter && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Ön Yazı</h3>
                  <div className="bg-cream-50 rounded-lg p-4 text-sm text-ink-700 leading-relaxed">
                    {selected.coverLetter}
                  </div>
                </div>
              )}

              {selected.availabilities?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Müsaitlik Saatleri</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.availabilities.map((av, i) => (
                      <span key={i} className="px-3 py-1.5 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 text-xs font-medium rounded-lg border border-brand-200 dark:border-brand-800">
                        {av.dayOfWeek} · {av.startTime}–{av.endTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.note && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Notunuz</h3>
                  <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700 border border-amber-200">
                    {selected.note}
                  </div>
                </div>
              )}

              {/* Görüntülenebilir Belgeler */}
              <div>
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">
                  Görüntülenebilir Belgeler
                </h3>
                {docsLoading ? (
                  <p className="text-xs text-ink-400">Yükleniyor...</p>
                ) : accessibleDocs.length === 0 ? (
                  <p className="text-xs text-ink-400 mb-3">
                    Bu aday henüz belge yüklememiş veya hassas belgeler için izin yok.
                  </p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {accessibleDocs.map(doc => {
                      const typeLabel = (
                        SENSITIVE_DOC_TYPES_BIZ.find(t => t.type === doc.type)?.label
                      ) || doc.type
                      return (
                        <div key={doc.id}
                          className="flex items-center justify-between bg-cream-50 rounded-lg px-3 py-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-ink-700 font-medium truncate">{typeLabel}</div>
                            <div className="text-xs text-ink-400 truncate">{doc.originalFileName}</div>
                          </div>
                          <button onClick={() => handleViewDoc(doc)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700 hover:bg-brand-200 dark:hover:bg-brand-900/60 transition-colors flex-shrink-0">
                            Görüntüle
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Belge Talepleri */}
              <div>
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Belge Talepleri</h3>

                {selected.documentRequests?.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {selected.documentRequests.map(dr => {
                      const meta = SENSITIVE_DOC_TYPES_BIZ.find(t => t.type === dr.documentType)
                      const statusMeta = DOC_REQ_STATUS_LABELS[dr.status] || { cls: 'bg-cream-100 text-ink-600', label: dr.status }
                      return (
                        <div key={dr.id} className="flex items-center justify-between bg-cream-50 rounded-lg px-3 py-2">
                          <span className="text-sm text-ink-700">{meta?.label || dr.documentType}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-ink-400 mb-3">Henüz belge talep edilmemiş</p>
                )}

                {/* Yeni talep — sadece sonuçlanmamış başvurularda */}
                {['PENDING', 'REVIEWING'].includes(selected.status) && (() => {
                  const requestedTypes = new Set(selected.documentRequests?.map(dr => dr.documentType) || [])
                  const availableTypes = SENSITIVE_DOC_TYPES_BIZ.filter(t => !requestedTypes.has(t.type))
                  if (availableTypes.length === 0) {
                    return <p className="text-xs text-ink-400">Tüm hassas belge tipleri zaten talep edilmiş.</p>
                  }
                  return (
                    <div className="flex gap-2">
                      <select value={requestingType} onChange={e => setRequestingType(e.target.value)}
                        className="input text-sm flex-1">
                        <option value="">Belge tipi seç...</option>
                        {availableTypes.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                      <button onClick={handleRequestDoc} disabled={!requestingType || actionLoading}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-all"
                        style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                        Talep Et
                      </button>
                    </div>
                  )
                })()}
              </div>

              {/* Chat-v2: Kabul/Red butonları kaldırıldı.
                  Karar mesajlaşmadan veriliyor — sade bilgi + büyük "Mesajlaşmaya Git" */}
              <div className="border-t border-cream-200 pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">İletişim</h3>
                <p className="text-xs text-ink-500">
                  Bu aday için otomatik mesajlaşma açıldı. Belgeleri inceleyip mülakat
                  ayarlayabilir, karar mesajlaşmadan verilebilir.
                </p>
                <button
                  onClick={() => onOpenMessages?.(selected.conversationId)}
                  className="w-full py-2.5 rounded-lg text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)', boxShadow: '0 3px 12px rgba(4,120,87,0.35)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  Mesajlaşmaya Git
                </button>
              </div>

              {/* No-show işaretleme — sadece ACCEPTED + henüz işaretlenmemiş */}
              {selected.status === 'ACCEPTED' && !selected.noShow && (
                <div className="border-t border-cream-200 pt-4 space-y-2">
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">İşe Gelme Durumu</h3>
                  <p className="text-xs text-ink-500">
                    Aday kabul edilen iş için işe gelmediyse aşağıdaki butonla işaretleyin.
                    Aday 3 kez işe gelmediğinde otomatik olarak 30 gün banlanır.
                  </p>
                  <button onClick={() => handleNoShow(selected.id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                    Aday İşe Gelmedi (No-Show) Olarak İşaretle
                  </button>
                </div>
              )}

              {/* No-show işaretlenmişse uyarı banner */}
              {selected.noShow && (
                <div className="border-t border-cream-200 pt-4">
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <div>
                      <div className="font-semibold">No-show olarak işaretlendi</div>
                      <div className="text-xs text-red-600 mt-0.5">
                        Bu aday kabul edilen iş için işe gelmediğini bildirdiniz. Strike hakkı düşürüldü.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => setSelected(null)} className="btn-secondary text-sm flex-1">Kapat</button>
              {/* #77: Adayla sohbet başlat */}
              {selected.candidate?.id && (
                <button
                  onClick={async () => {
                    try {
                      await hotelApi.startConversation({
                        otherPartyId: selected.candidate.id,
                        applicationId: selected.id,
                      })
                      setSelected(null)
                      onOpenMessages?.()
                    } catch (err) {
                      toast.error(extractErrorMessage(err))
                    }
                  }}
                  className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #6b21a8, #7e22ce)' }}>
                  Mesaj Gönder
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

/* ── Overview Tab ── */
function OverviewTab({ applications, onTabChange }) {
  const pending   = applications.filter(a => a.status === 'PENDING').length
  const reviewing = applications.filter(a => a.status === 'REVIEWING').length
  const accepted  = applications.filter(a => a.status === 'ACCEPTED').length

  // #89 cleanup: Backend stats çağrısı kaldırıldı (recharts gitti, sonucu kullanılmıyordu)
  // Stat strip applications prop'undan hesaplanıyor.

  return (
    <div className="space-y-4">
      {/* Stat strip — sade 4'lü (Bu Ay, Kabul %, Red %, Aktif İlan kaldırıldı) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Toplam',      value: applications.length, dot: 'bg-blue-400' },
          { label: 'Bekleyen',    value: pending,             dot: 'bg-amber-400' },
          { label: 'İnceleniyor', value: reviewing,           dot: 'bg-brand-400' },
          { label: 'Kabul',       value: accepted,            dot: 'bg-brand-500' },
        ].map(s => (
          <div key={s.label} className="stat-card !p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold truncate">{s.label}</span>
            </div>
            <div className="text-xl font-black text-white leading-none">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-ink-800 dark:text-ink-900">Son Başvurular</h2>
          <button onClick={() => onTabChange('applications')}
            className="text-xs font-medium text-brand-700 dark:text-brand-700">Tümünü Gör →</button>
        </div>
        {applications.length === 0 ? (
          <div className="empty-state">
            <p className="text-ink-500 text-sm">Henüz başvuru yok</p>
          </div>
        ) : (
          <div className="table-container rounded-none border-0 border-t border-cream-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Aday</th>
                  <th className="hidden md:table-cell">İlan</th>
                  <th>Durum</th>
                  <th className="hidden sm:table-cell">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 5).map(app => (
                  <tr key={app.id}>
                    <td>
                      <div className="font-medium text-ink-800 dark:text-ink-900">{app.candidate?.fullName}</div>
                      <div className="text-xs text-ink-400">{app.candidate?.email}</div>
                    </td>
                    <td className="hidden md:table-cell text-ink-600 text-sm">{app.listing?.title}</td>
                    <td><StatusBadge status={app.status} /></td>
                    <td className="hidden sm:table-cell text-ink-500 text-xs">
                      {new Date(app.createdAt).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Main Dashboard ── */
export default function BusinessDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = useCallback(async () => {
    try {
      // #84: Backend artık PageResponse döner. Overview stats + client filtre için
      // tümünü çekiyoruz (büyük size). Liste içinde ayrıca sayfalama yapılır.
      const data = await hotelApi.getBusinessApplications({ size: 1000 })
      setApplications(Array.isArray(data) ? data : (data?.content ?? []))
    } catch {
      toast.error('Başvurular yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview'      && <OverviewTab applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'mylistings'    && <MyListingsTab />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={fetchApplications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'workers'       && <WorkersTab applications={applications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'profile'       && <ProfileTab />}
        </>
      )}
    </DashboardLayout>
  )
}
