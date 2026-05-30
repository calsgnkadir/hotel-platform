import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import ChangePasswordCard from '../../components/ChangePasswordCard'

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}
const JOB_TYPE_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}
const SHIFT_LABELS = {
  MORNING: 'Sabah (08:00–16:00)',
  EVENING: 'Akşam (16:00–24:00)',
  NIGHT:   'Gece (22:00–08:00)',
}
const SHIFT_SHORT = {
  MORNING: 'Sabah',
  EVENING: 'Akşam',
  NIGHT:   'Gece',
}
const STATUS_LABELS = { ACTIVE: 'Aktif', PAUSED: 'Durduruldu', CLOSED: 'Kapatıldı' }
const SENSITIVE_DOC_TYPES_BIZ = [
  { type: 'CRIMINAL_RECORD',    label: 'Adli Sicil' },
  { type: 'HEALTH_CERTIFICATE', label: 'Sağlık Raporu' },
  { type: 'IDENTITY_DOCUMENT',  label: 'Kimlik Fotokopisi' },
]
const DOC_REQ_STATUS_LABELS = {
  PENDING: { cls: 'bg-amber-50 text-amber-700',   label: 'Bekliyor' },
  GRANTED: { cls: 'bg-emerald-50 text-emerald-700', label: 'İzin Verildi' },
  DENIED:  { cls: 'bg-red-50 text-red-700',        label: 'Reddedildi' },
}
const BUSINESS_TYPE_LABELS = {
  HOTEL: '🏨 Otel',
  RESTAURANT: '🍽️ Restoran',
  CAFE: '☕ Kafe',
}
const ISTANBUL_DISTRICTS = [
  'Adalar', 'Arnavutköy', 'Ataşehir', 'Avcılar', 'Bağcılar', 'Bahçelievler',
  'Bakırköy', 'Başakşehir', 'Bayrampaşa', 'Beşiktaş', 'Beykoz', 'Beylikdüzü',
  'Beyoğlu', 'Büyükçekmece', 'Çatalca', 'Çekmeköy', 'Esenler', 'Esenyurt',
  'Eyüpsultan', 'Fatih', 'Gaziosmanpaşa', 'Güngören', 'Kadıköy', 'Kağıthane',
  'Kartal', 'Küçükçekmece', 'Maltepe', 'Pendik', 'Sancaktepe', 'Sarıyer',
  'Silivri', 'Sultanbeyli', 'Sultangazi', 'Şile', 'Şişli', 'Tuzla',
  'Ümraniye', 'Üsküdar', 'Zeytinburnu',
]

const WEEKDAYS = [
  { key: 'MONDAY',    label: 'Pazartesi' },
  { key: 'TUESDAY',   label: 'Salı' },
  { key: 'WEDNESDAY', label: 'Çarşamba' },
  { key: 'THURSDAY',  label: 'Perşembe' },
  { key: 'FRIDAY',    label: 'Cuma' },
  { key: 'SATURDAY',  label: 'Cumartesi' },
  { key: 'SUNDAY',    label: 'Pazar' },
]

const DEFAULT_HOURS = WEEKDAYS.reduce((acc, d) => {
  acc[d.key] = { open: '09:00', close: '18:00', closed: false }
  return acc
}, {})

/**
 * Backend'deki TEXT alanından struct elde et.
 * Eski format (serbest text) → null döner, çağıran DEFAULT_HOURS kullanır.
 */
function parseWorkingHours(text) {
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return null
    const result = {}
    for (const d of WEEKDAYS) {
      const entry = parsed[d.key]
      result[d.key] = entry && typeof entry === 'object'
        ? {
            open:   entry.open   || '09:00',
            close:  entry.close  || '18:00',
            closed: !!entry.closed,
          }
        : { open: '09:00', close: '18:00', closed: true }
    }
    return result
  } catch {
    return null
  }
}

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const map = {
    PENDING:   { cls: 'badge-pending',   icon: '⏳', label: 'Bekliyor' },
    REVIEWING: { cls: 'badge-reviewing', icon: '🔍', label: 'İnceleniyor' },
    ACCEPTED:  { cls: 'badge-accepted',  icon: '✅', label: 'Kabul Edildi' },
    REJECTED:  { cls: 'badge-rejected',  icon: '❌', label: 'Reddedildi' },
    EXPIRED:   { cls: 'badge-expired',   icon: '⌛', label: 'Süresi Doldu' },
    WITHDRAWN: { cls: 'badge-expired',   icon: '🚫', label: 'Aday İptal Etti' },
  }
  const s = map[status] || { cls: 'badge-pending', icon: '?', label: status }
  return <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>
}

/* ── No-show Badge ── */
function NoShowBadge() {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      🚫 İşe Gelmedi
    </span>
  )
}

/* ── Listing Form Modal (create + edit) ── */
function ListingFormModal({ listing, onClose, onSuccess }) {
  const isEdit = !!listing
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    position:     listing?.position     || 'WAITER',
    jobType:      listing?.jobType      || 'PERMANENT',
    shift:        listing?.shift        || 'MORNING',
    title:        listing?.title        || '',
    description:  listing?.description  || '',
    requirements: listing?.requirements || '',
    salaryMin:    listing?.salaryMin    ?? '',
    salaryMax:    listing?.salaryMax    ?? '',
    startDate:    listing?.startDate    || '',
    endDate:      listing?.endDate      || '',
  })

  // Faz E2: Slot listesi (date+start+end+slotsNeeded)
  // Edit modunda mevcut slotlardan başlat, yeni ilanda 1 boş satır
  const [slots, setSlots] = useState(() => {
    if (listing?.shiftSlots?.length) {
      return listing.shiftSlots.map(s => ({
        id:          s.id ?? null,
        date:        s.date || '',
        startTime:   s.startTime ? s.startTime.slice(0, 5) : '',
        endTime:     s.endTime ? s.endTime.slice(0, 5) : '',
        slotsNeeded: s.slotsNeeded ?? 1,
        slotsFilled: s.slotsFilled ?? 0,
      }))
    }
    return [{ id: null, date: '', startTime: '', endTime: '', slotsNeeded: 1, slotsFilled: 0 }]
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function updateSlot(i, patch) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  function addSlot() {
    setSlots(prev => [...prev, { id: null, date: '', startTime: '', endTime: '', slotsNeeded: 1, slotsFilled: 0 }])
  }

  function removeSlot(i) {
    setSlots(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }

  function duplicateSlot(i) {
    setSlots(prev => {
      const copy = { ...prev[i], id: null, slotsFilled: 0 }
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Zorunlu alanlar
    if (!form.title.trim())       return toast.error('İlan başlığı zorunlu')
    if (!form.description.trim()) return toast.error('Açıklama zorunlu')
    if (!form.salaryMin)          return toast.error('Min. ücret zorunlu')

    // Sayısal kontroller
    const min = parseFloat(form.salaryMin)
    const max = form.salaryMax ? parseFloat(form.salaryMax) : null
    if (max !== null && max < min) {
      return toast.error('Max. ücret min. ücretten küçük olamaz')
    }

    // Kontrat dönemi tarihleri opsiyonel — sadece sanity check
    const today = new Date().toISOString().split('T')[0]
    if (form.startDate && form.startDate < today) {
      return toast.error('Başlangıç tarihi geçmişte olamaz')
    }
    if (form.endDate && form.endDate < today) {
      return toast.error('Bitiş tarihi geçmişte olamaz')
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return toast.error('Bitiş tarihi başlangıçtan önce olamaz')
    }

    // Faz E2: Slot validasyonu
    if (slots.length === 0) {
      return toast.error('En az 1 vardiya slotu eklemelisiniz')
    }
    for (let i = 0; i < slots.length; i++) {
      const s = slots[i]
      const n = i + 1
      if (!s.date)      return toast.error(`Slot ${n}: tarih zorunlu`)
      if (!s.startTime) return toast.error(`Slot ${n}: başlangıç saati zorunlu`)
      if (!s.endTime)   return toast.error(`Slot ${n}: bitiş saati zorunlu`)
      if (s.date < today) return toast.error(`Slot ${n}: geçmiş tarih olamaz`)
      if (s.endTime <= s.startTime) return toast.error(`Slot ${n}: bitiş saati başlangıçtan sonra olmalı`)
      if (!s.slotsNeeded || s.slotsNeeded < 1) return toast.error(`Slot ${n}: ihtiyaç sayısı en az 1`)
    }

    setLoading(true)
    try {
      const payload = {
        position:    form.position,
        jobType:     form.jobType,
        shift:       form.shift,
        title:       form.title.trim(),
        description: form.description.trim(),
        requirements: form.requirements.trim() || null,
        salaryMin:   min,
        salaryMax:   max,
        startDate:   form.startDate || null,
        endDate:     form.endDate || null,
        shiftStart:  null,  // legacy — artık her slot kendi saatini taşıyor
        shiftEnd:    null,
        // Faz E2: slotları gönder
        shiftSlots: slots.map(s => ({
          id:          s.id || null,
          date:        s.date,
          startTime:   s.startTime.length === 5 ? `${s.startTime}:00` : s.startTime,
          endTime:     s.endTime.length === 5 ? `${s.endTime}:00` : s.endTime,
          slotsNeeded: parseInt(s.slotsNeeded, 10) || 1,
        })),
      }
      if (isEdit) {
        await hotelApi.updateListing(listing.id, payload)
        toast.success('İlan güncellendi!')
      } else {
        await hotelApi.createListing(payload)
        toast.success('İlan oluşturuldu!')
      }
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-slate-900">
            {isEdit ? 'İlanı Düzenle' : 'Yeni İlan Oluştur'}
          </h2>
          <p className="text-sm text-slate-500">
            {isEdit ? 'Mevcut bilgileri güncelleyin' : 'Adayların göreceği iş ilanı'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Temel bilgiler */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Pozisyon *</label>
              <select name="position" value={form.position} onChange={handleChange} className="input">
                {Object.entries(POSITION_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Çalışma Türü *</label>
              <select name="jobType" value={form.jobType} onChange={handleChange} className="input">
                {Object.entries(JOB_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Vardiya kategorisi */}
          <div>
            <label className="label">Vardiya *</label>
            <select name="shift" value={form.shift} onChange={handleChange} className="input">
              {Object.entries(SHIFT_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Adaylar bu kategoriye göre filtreleyebilir
            </p>
          </div>

          {/* Başlık + açıklama */}
          <div>
            <label className="label">İlan Başlığı *</label>
            <input type="text" name="title" value={form.title} onChange={handleChange}
              className="input" placeholder="Örn: Sabah vardiyası garson aranıyor" />
          </div>

          <div>
            <label className="label">Açıklama *</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              className="input resize-none h-24 text-sm"
              placeholder="Pozisyon hakkında detaylı bilgi verin..." />
          </div>

          <div>
            <label className="label">Gereksinimler <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
            <textarea name="requirements" value={form.requirements} onChange={handleChange}
              className="input resize-none h-16 text-sm"
              placeholder="Deneyim, yaş, dil bilgisi vb..." />
          </div>

          {/* Ücret */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Min. Maaş ₺ *</label>
              <input type="number" name="salaryMin" value={form.salaryMin} onChange={handleChange}
                className="input" placeholder="15000" min="0" />
            </div>
            <div>
              <label className="label">Max. Maaş ₺ <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
              <input type="number" name="salaryMax" value={form.salaryMax} onChange={handleChange}
                className="input" placeholder="25000" min="0" />
            </div>
          </div>

          {/* Faz E2: Vardiya slotları (zorunlu — en az 1) */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0]
            return (
              <div className="border-2 border-violet-100 rounded-xl p-4 bg-violet-50/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="label !mb-0">Vardiyalar *</label>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Adaylar bu vardiyalardan birine veya birkaçına başvurabilir
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700">
                    {slots.length} vardiya
                  </span>
                </div>

                <div className="space-y-2">
                  {slots.map((s, i) => {
                    const locked = (s.slotsFilled || 0) > 0  // kabul edilmiş başvuru var
                    return (
                      <div key={i}
                        className="bg-white rounded-lg p-3 border border-slate-200 space-y-2 relative">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">
                            Vardiya #{i + 1}
                            {locked && (
                              <span className="ml-2 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                                {s.slotsFilled}/{s.slotsNeeded} dolu
                              </span>
                            )}
                          </span>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => duplicateSlot(i)}
                              className="text-xs px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600"
                              title="Bu vardiyayı çoğalt">
                              ⎘
                            </button>
                            {slots.length > 1 && (
                              <button type="button" onClick={() => removeSlot(i)}
                                disabled={locked}
                                className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={locked ? 'Bu slota kabul edilmiş aday var, silinemez' : 'Sil'}>
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="col-span-2 sm:col-span-2">
                            <label className="text-xs text-slate-500">Tarih</label>
                            <input type="date" value={s.date} min={todayStr}
                              onChange={e => updateSlot(i, { date: e.target.value })}
                              className="input text-sm !py-1.5" required />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Başlangıç</label>
                            <input type="time" value={s.startTime}
                              onChange={e => updateSlot(i, { startTime: e.target.value })}
                              className="input text-sm !py-1.5" required />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">Bitiş</label>
                            <input type="time" value={s.endTime}
                              onChange={e => updateSlot(i, { endTime: e.target.value })}
                              className="input text-sm !py-1.5" required />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-slate-500">İhtiyaç sayısı (kaç aday)</label>
                          <input type="number" min="1" max="50" value={s.slotsNeeded}
                            onChange={e => updateSlot(i, { slotsNeeded: e.target.value })}
                            className="input text-sm !py-1.5 w-24" required />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button type="button" onClick={addSlot}
                  className="w-full py-2 text-sm font-semibold text-violet-700 bg-white border-2 border-dashed border-violet-300 rounded-lg hover:bg-violet-100 transition-colors">
                  + Vardiya Ekle
                </button>
              </div>
            )
          })()}

          {/* Kontrat dönemi (opsiyonel — kalıcı pozisyon için) */}
          <div>
            <label className="label">
              Kontrat Dönemi <span className="text-slate-400 font-normal">(opsiyonel — kalıcı/sezonluk için)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" name="startDate" value={form.startDate}
                onChange={handleChange} min={new Date().toISOString().split('T')[0]}
                className="input" placeholder="Başlangıç" />
              <input type="date" name="endDate" value={form.endDate}
                onChange={handleChange} min={form.startDate || new Date().toISOString().split('T')[0]}
                className="input" placeholder="Bitiş" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              İşin bütünüyle kapsadığı dönem (yukarıdaki vardiyalar bu dönem içinde olur)
            </p>
          </div>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white py-3 -mx-6 px-6 border-t border-slate-100">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
              {loading
                ? (isEdit ? 'Güncelleniyor...' : 'Oluşturuluyor...')
                : (isEdit ? 'Güncelle' : 'İlan Oluştur →')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Working Hours Editor ── */
function WorkingHoursEditor({ value, onChange }) {
  const hours = value || DEFAULT_HOURS

  function updateDay(dayKey, patch) {
    onChange({
      ...hours,
      [dayKey]: { ...hours[dayKey], ...patch },
    })
  }

  function copyToAll() {
    const monday = hours.MONDAY
    const next = WEEKDAYS.reduce((acc, d) => {
      acc[d.key] = { ...monday }
      return acc
    }, {})
    onChange(next)
  }

  return (
    <div>
      <div className="space-y-1">
        {WEEKDAYS.map(d => {
          const h = hours[d.key]
          return (
            <div key={d.key}
              className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-24 text-sm font-medium text-slate-700">{d.label}</div>

              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input type="checkbox"
                  checked={!h.closed}
                  onChange={e => updateDay(d.key, { closed: !e.target.checked })}
                  className="w-4 h-4 accent-violet-600" />
                <span className={h.closed ? 'text-slate-400' : 'text-slate-700'}>
                  {h.closed ? 'Kapalı' : 'Açık'}
                </span>
              </label>

              {!h.closed && (
                <div className="flex items-center gap-2 ml-auto">
                  <input type="time" value={h.open}
                    onChange={e => updateDay(d.key, { open: e.target.value })}
                    className="input !py-1 text-sm w-24" />
                  <span className="text-slate-400 text-sm">—</span>
                  <input type="time" value={h.close}
                    onChange={e => updateDay(d.key, { close: e.target.value })}
                    className="input !py-1 text-sm w-24" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end mt-2">
        <button type="button" onClick={copyToAll}
          className="text-xs text-violet-600 hover:text-violet-800 font-medium">
          ⎘ Pazartesi saatlerini tüm günlere uygula
        </button>
      </div>
    </div>
  )
}

/* ── Logo + Gallery Media Block ── */
function MediaBlock({ logoUrl, logoVersion, photos, onLogoUpload, onLogoDelete, onPhotoUpload, onPhotoDelete }) {
  const [logoUploading, setLogoUploading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const MAX_PHOTOS = 10
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10 MB (backend ile aynı)
  const ALLOWED_IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

  function validateImage(file) {
    if (file.size > MAX_IMAGE_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(1)
      toast.error(`Görsel çok büyük (${mb} MB). Maksimum 10 MB.`)
      return false
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_IMG_EXT.includes(ext)) {
      toast.error(`'.${ext}' formatı desteklenmiyor. Kabul edilenler: JPG, PNG, WEBP, HEIC`)
      return false
    }
    return true
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!validateImage(file)) { e.target.value = ''; return }
    setLogoUploading(true)
    try { await onLogoUpload(file) }
    finally { setLogoUploading(false); e.target.value = '' }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!validateImage(file)) { e.target.value = ''; return }
    setPhotoUploading(true)
    try { await onPhotoUpload(file) }
    finally { setPhotoUploading(false); e.target.value = '' }
  }

  return (
    <div className="card p-5 space-y-5">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Görseller</h3>

      {/* Logo */}
      <div>
        <label className="label">Logo</label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
            {logoUrl ? (
              <img src={`${logoUrl}?v=${logoVersion}`} alt="Logo"
                   className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl text-slate-300">🏢</span>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <label className={`block px-4 py-2 text-sm font-medium rounded-lg cursor-pointer text-center transition-colors
              ${logoUploading
                ? 'bg-violet-50 text-violet-400 cursor-wait'
                : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}>
              <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
                onChange={handleLogoChange} disabled={logoUploading} />
              {logoUploading
                ? '⏳ Yükleniyor...'
                : (logoUrl ? '🔄 Logoyu Değiştir' : '📷 Logo Yükle')}
            </label>
            {logoUrl && (
              <button type="button" onClick={onLogoDelete}
                className="block w-full px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                🗑 Logoyu Kaldır
              </button>
            )}
            <p className="text-xs text-slate-400">Max 10 MB · JPG/PNG/WEBP/HEIC</p>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label !mb-0">Galeri ({photos.length}/{MAX_PHOTOS})</label>
          {photos.length < MAX_PHOTOS && (
            <label className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors
              ${photoUploading
                ? 'bg-violet-50 text-violet-400 cursor-wait'
                : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}>
              <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
                onChange={handlePhotoChange} disabled={photoUploading} />
              {photoUploading ? '⏳ Yükleniyor...' : '+ Foto Ekle'}
            </label>
          )}
        </div>

        {photos.length === 0 ? (
          <div className="empty-state py-8 bg-slate-50 rounded-xl">
            <span className="text-3xl mb-2">🖼️</span>
            <p className="text-sm text-slate-500">Henüz foto yok</p>
            <p className="text-xs text-slate-400 mt-0.5">İşletmenizi tanıtan fotoğraflar ekleyin</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map(photo => (
              <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 group">
                <img src={photo.url} alt="Galeri" className="w-full h-full object-cover" />
                <button type="button"
                  onClick={() => onPhotoDelete(photo.id)}
                  className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-500 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600"
                  title="Sil">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
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
          address:      profile.address      || '',
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

    setSaving(true)
    try {
      const payload = {
        name:         form.name.trim(),
        type:         form.type,
        district:     form.district || null,
        address:      form.address.trim() || null,
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
    <div className="space-y-5 max-w-3xl">
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Görseller (logo + galeri) */}
      <MediaBlock
        logoUrl={logoUrl}
        logoVersion={logoVersion}
        photos={photos}
        onLogoUpload={handleLogoUpload}
        onLogoDelete={handleLogoDelete}
        onPhotoUpload={handlePhotoUpload}
        onPhotoDelete={handlePhotoDelete}
      />

      {/* Temel bilgiler */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Temel Bilgiler</h3>

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
            <label className="label">Kategori <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
            <input type="text" name="category" value={form.category} onChange={handleChange}
              className="input" placeholder="5*, 4*, Boutique vb." />
          </div>
        </div>

        <div>
          <label className="label">İlçe <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
          <select name="district" value={form.district} onChange={handleChange} className="input">
            <option value="">Seçin</option>
            {ISTANBUL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Adres <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
          <input type="text" name="address" value={form.address} onChange={handleChange}
            className="input" placeholder="Mahalle, sokak, no" />
        </div>

        <div>
          <label className="label">Açıklama <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
          <textarea name="description" value={form.description} onChange={handleChange}
            className="input resize-none h-24 text-sm"
            placeholder="İşletmenizi adaylara tanıtın..." />
        </div>
      </div>

      {/* İletişim */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">İletişim</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">📞 Telefon</label>
            <input type="text" name="phone" value={form.phone} onChange={handleChange}
              className="input" placeholder="0212 555 12 34" />
          </div>
          <div>
            <label className="label">🌐 Web Sitesi</label>
            <input type="text" name="website" value={form.website} onChange={handleChange}
              className="input" placeholder="https://..." />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">📷 Instagram</label>
            <input type="text" name="instagram" value={form.instagram} onChange={handleChange}
              className="input" placeholder="@kullaniciadi" />
          </div>
          <div>
            <label className="label">📘 Facebook</label>
            <input type="text" name="facebook" value={form.facebook} onChange={handleChange}
              className="input" placeholder="sayfa adı veya URL" />
          </div>
        </div>
      </div>

      {/* Çalışma saatleri */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Çalışma Saatleri</h3>
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
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.3)' }}>
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
        <p className="text-sm text-slate-500">{listings.length} ilan</p>
        <button onClick={() => setFormTarget('new')}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
          + Yeni İlan
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <span className="text-5xl mb-4">📌</span>
            <p className="font-medium text-slate-700">Henüz ilanınız yok</p>
            <p className="text-sm text-slate-500 mt-1">İlk ilanınızı oluşturun</p>
            <button onClick={() => setFormTarget('new')}
              className="mt-4 px-4 py-2 text-sm font-semibold text-white rounded-lg"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
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
                    <h3 className="font-semibold text-slate-800">{listing.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      listing.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' :
                      listing.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' :
                      'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABELS[listing.status]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {POSITION_LABELS[listing.position]} · {JOB_TYPE_LABELS[listing.jobType]}
                    {listing.shift && ` · ${SHIFT_SHORT[listing.shift]}`}
                  </p>
                  {(listing.salaryMin || listing.salaryMax) && (
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
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
                      <p className="text-xs text-violet-600 font-medium mt-0.5">
                        🗓 {total} vardiya
                        {nextStr && ` · en yakın: ${nextStr}`}
                        {totalSeats > 0 && ` · ${filled}/${totalSeats} dolu`}
                      </p>
                    )
                  })()}
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(listing.createdAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  {listing.status !== 'CLOSED' && (
                    <button onClick={() => setFormTarget(listing)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors font-medium">
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
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium">
                      Aktifleştir
                    </button>
                  )}
                  {listing.status !== 'CLOSED' && (
                    <button onClick={() => handleStatusChange(listing.id, 'CLOSED')}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors font-medium">
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
function ApplicationsTab({ applications, onRefresh }) {
  const [filter, setFilter] = useState('ALL')
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

  const filtered = filter === 'ALL' ? applications
    : applications.filter(a => a.status === filter)

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
      toast.success(decision === 'ACCEPTED' ? 'Başvuru kabul edildi ✅' : 'Başvuru reddedildi')
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
      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED'].map(f => {
          const labels = { ALL: 'Tümü', PENDING: 'Bekleyen', REVIEWING: 'İnceleniyor', ACCEPTED: 'Kabul', REJECTED: 'Red' }
          const count = f === 'ALL' ? applications.length : applications.filter(a => a.status === f).length
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
                ${filter === f
                  ? 'text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'}`}
              style={filter === f ? { background: 'linear-gradient(135deg, #7c3aed, #2563eb)' } : {}}>
              {labels[f]} ({count})
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-slate-500 text-sm">Bu filtreye uyan başvuru yok</p>
            </div>
          </div>
        ) : filtered.map(app => (
          <div key={app.id} className="card hover:border-violet-200 cursor-pointer transition-all"
               onClick={() => setSelected(app)}>
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {app.candidate?.avatarUrl ? (
                  <img src={app.candidate.avatarUrl} alt={app.candidate.fullName}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-200" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                    {app.candidate?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-slate-800">{app.candidate?.fullName}</div>
                  <div className="text-xs text-slate-500">{app.candidate?.email}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{app.listing?.title}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={app.status} />
                {app.noShow && <NoShowBadge />}
                {app.status === 'PENDING' && (
                  <button onClick={e => { e.stopPropagation(); handleReview(app.id) }}
                    disabled={actionLoading}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                    İncelemeye Al
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selected.candidate?.avatarUrl ? (
                    <img src={selected.candidate.avatarUrl} alt={selected.candidate.fullName}
                      className="w-14 h-14 rounded-full object-cover border border-slate-200 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                         style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                      {selected.candidate?.fullName?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selected.candidate?.fullName}</h2>
                    <p className="text-sm text-slate-500">{selected.candidate?.email}</p>
                  </div>
                </div>
                <StatusBadge status={selected.status} />
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">İlan</h3>
                <div className="bg-slate-50 rounded-lg p-3 text-sm font-medium text-slate-700">
                  {selected.listing?.title} · {selected.listing?.businessName}
                </div>
              </div>

              {selected.coverLetter && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ön Yazı</h3>
                  <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
                    {selected.coverLetter}
                  </div>
                </div>
              )}

              {selected.availabilities?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Müsaitlik Saatleri</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.availabilities.map((av, i) => (
                      <span key={i} className="px-3 py-1.5 bg-violet-50 text-violet-700 text-xs font-medium rounded-lg border border-violet-200">
                        {av.dayOfWeek} · {av.startTime}–{av.endTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.note && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notunuz</h3>
                  <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700 border border-amber-200">
                    {selected.note}
                  </div>
                </div>
              )}

              {/* Görüntülenebilir Belgeler */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Görüntülenebilir Belgeler
                </h3>
                {docsLoading ? (
                  <p className="text-xs text-slate-400">Yükleniyor...</p>
                ) : accessibleDocs.length === 0 ? (
                  <p className="text-xs text-slate-400 mb-3">
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
                          className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-slate-700 font-medium truncate">{typeLabel}</div>
                            <div className="text-xs text-slate-400 truncate">{doc.originalFileName}</div>
                          </div>
                          <button onClick={() => handleViewDoc(doc)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors flex-shrink-0">
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
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Belge Talepleri</h3>

                {selected.documentRequests?.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {selected.documentRequests.map(dr => {
                      const meta = SENSITIVE_DOC_TYPES_BIZ.find(t => t.type === dr.documentType)
                      const statusMeta = DOC_REQ_STATUS_LABELS[dr.status] || { cls: 'bg-slate-100 text-slate-600', label: dr.status }
                      return (
                        <div key={dr.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                          <span className="text-sm text-slate-700">{meta?.label || dr.documentType}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-3">Henüz belge talep edilmemiş</p>
                )}

                {/* Yeni talep — sadece sonuçlanmamış başvurularda */}
                {['PENDING', 'REVIEWING'].includes(selected.status) && (() => {
                  const requestedTypes = new Set(selected.documentRequests?.map(dr => dr.documentType) || [])
                  const availableTypes = SENSITIVE_DOC_TYPES_BIZ.filter(t => !requestedTypes.has(t.type))
                  if (availableTypes.length === 0) {
                    return <p className="text-xs text-slate-400">Tüm hassas belge tipleri zaten talep edilmiş.</p>
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
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                        Talep Et
                      </button>
                    </div>
                  )
                })()}
              </div>

              {selected.status === 'REVIEWING' && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Karar Ver</h3>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="input resize-none h-20 text-sm"
                    placeholder="Adaya iletilecek not (opsiyonel)..."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleDecision(selected.id, 'ACCEPTED')}
                      disabled={actionLoading}
                      className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                      ✅ Kabul Et
                    </button>
                    <button onClick={() => handleDecision(selected.id, 'REJECTED')}
                      disabled={actionLoading}
                      className="py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                      ❌ Reddet
                    </button>
                  </div>
                </div>
              )}

              {/* No-show işaretleme — sadece ACCEPTED + henüz işaretlenmemiş */}
              {selected.status === 'ACCEPTED' && !selected.noShow && (
                <div className="border-t border-slate-100 pt-4 space-y-2">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">İşe Gelme Durumu</h3>
                  <p className="text-xs text-slate-500">
                    Aday kabul edilen iş için işe gelmediyse aşağıdaki butonla işaretleyin.
                    Aday 3 kez işe gelmediğinde otomatik olarak 30 gün banlanır.
                  </p>
                  <button onClick={() => handleNoShow(selected.id)}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                    🚫 Aday İşe Gelmedi (No-Show) Olarak İşaretle
                  </button>
                </div>
              )}

              {/* No-show işaretlenmişse uyarı banner */}
              {selected.noShow && (
                <div className="border-t border-slate-100 pt-4">
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                    <span className="text-lg leading-none">🚫</span>
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

            <div className="px-6 pb-5">
              <button onClick={() => setSelected(null)} className="btn-secondary text-sm">Kapat</button>
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Başvuru', value: applications.length, color: 'from-blue-500 to-blue-600',
            svg: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
          { label: 'Bekleyen',       value: pending,             color: 'from-amber-500 to-amber-600',
            svg: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
          { label: 'İnceleniyor',    value: reviewing,           color: 'from-violet-500 to-violet-600',
            svg: 'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z' },
          { label: 'Kabul Edildi',   value: accepted,            color: 'from-emerald-500 to-emerald-600',
            svg: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.8} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={s.svg} />
              </svg>
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800">Son Başvurular</h2>
          <button onClick={() => onTabChange('applications')}
            className="text-xs font-medium" style={{ color: '#7c3aed' }}>Tümünü Gör →</button>
        </div>
        {applications.length === 0 ? (
          <div className="empty-state">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-slate-500 text-sm">Henüz başvuru yok</p>
          </div>
        ) : (
          <div className="table-container rounded-none border-0 border-t border-slate-100">
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
                      <div className="font-medium text-slate-800">{app.candidate?.fullName}</div>
                      <div className="text-xs text-slate-400">{app.candidate?.email}</div>
                    </td>
                    <td className="hidden md:table-cell text-slate-600 text-sm">{app.listing?.title}</td>
                    <td><StatusBadge status={app.status} /></td>
                    <td className="hidden sm:table-cell text-slate-500 text-xs">
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
      const data = await hotelApi.getBusinessApplications()
      setApplications(data)
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
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={fetchApplications} />}
          {activeTab === 'profile'       && <ProfileTab />}
        </>
      )}
    </DashboardLayout>
  )
}
