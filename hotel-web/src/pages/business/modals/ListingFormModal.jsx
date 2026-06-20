import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import { POSITION_LABELS, JOB_TYPE_LABELS, SHIFT_LABELS } from '../lib/constants'
import useFocusTrap from '../../../lib/useFocusTrap'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function genSlotUid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'sl-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * #9 refactor: BusinessDashboard'tan extract edildi.
 *
 * Yeni ilan oluşturma + mevcut ilan düzenleme.
 * Slot bazlı yapı: ilan + N vardiya slotu (date+start+end+slotsNeeded).
 */
export default function ListingFormModal({ listing, onClose, onSuccess }) {
  const isEdit = !!listing
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    position:     listing?.position     || 'WAITER',
    jobType:      listing?.jobType      || 'PERMANENT',
    // shift kategorisi (Sabah/Akşam/Gece) kaldirildi — somut slot saatleri yeterli
    title:        listing?.title        || '',
    description:  listing?.description  || '',
    requirements: listing?.requirements || '',
    salaryMin:    listing?.salaryMin    ?? '',
    salaryMax:    listing?.salaryMax    ?? '',
    salaryType:    listing?.salaryType    ?? 'HOURLY',  // FAZ 2/#25 default saatlik
    tipsIncluded:  listing?.tipsIncluded  ?? false,
    startDate:    listing?.startDate    || '',
    endDate:      listing?.endDate      || '',
  })

  // Faz E2: Slot listesi (date+start+end+slotsNeeded). FAZ 5.5b: _uid drag-drop icin stable id.
  const [slots, setSlots] = useState(() => {
    if (listing?.shiftSlots?.length) {
      return listing.shiftSlots.map(s => ({
        _uid:        genSlotUid(),
        id:          s.id ?? null,
        date:        s.date || '',
        startTime:   s.startTime ? s.startTime.slice(0, 5) : '',
        endTime:     s.endTime ? s.endTime.slice(0, 5) : '',
        slotsNeeded: s.slotsNeeded ?? 1,
        slotsFilled: s.slotsFilled ?? 0,
      }))
    }
    return [{ _uid: genSlotUid(), id: null, date: '', startTime: '', endTime: '', slotsNeeded: 1, slotsFilled: 0 }]
  })

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function updateSlot(i, patch) {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s))
  }

  function addSlot() {
    setSlots(prev => [...prev, { _uid: genSlotUid(), id: null, date: '', startTime: '', endTime: '', slotsNeeded: 1, slotsFilled: 0 }])
  }

  function removeSlot(i) {
    setSlots(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)
  }

  function duplicateSlot(i) {
    setSlots(prev => {
      const copy = { ...prev[i], _uid: genSlotUid(), id: null, slotsFilled: 0 }
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)]
    })
  }

  // FAZ 5.5b: drag-drop ile slot siralama (FAZ C.1: TouchSensor — mobil)
  const slotSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function handleSlotDragEnd(e) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setSlots(prev => {
      const from = prev.findIndex(s => s._uid === active.id)
      const to   = prev.findIndex(s => s._uid === over.id)
      if (from < 0 || to < 0) return prev
      return arrayMove(prev, from, to)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.title.trim())       return toast.error('İlan başlığı zorunlu')
    if (!form.description.trim()) return toast.error('Açıklama zorunlu')
    // FAZ 2/#25 - NEGOTIABLE'da min ucret opsiyonel
    if (form.salaryType !== 'NEGOTIABLE' && !form.salaryMin) {
      return toast.error('Min. ücret zorunlu (veya tipi "Görüşülecek" yap)')
    }

    const min = form.salaryMin ? parseFloat(form.salaryMin) : null
    const max = form.salaryMax ? parseFloat(form.salaryMax) : null
    if (min !== null && max !== null && max < min) {
      return toast.error('Max. ücret min. ücretten küçük olamaz')
    }

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
        shift:       null,  // legacy field, slot saatleri belirleyici
        title:       form.title.trim(),
        description: form.description.trim(),
        requirements: form.requirements.trim() || null,
        salaryMin:    min,
        salaryMax:    max,
        salaryType:   form.salaryType || 'HOURLY',
        tipsIncluded: !!form.tipsIncluded,
        startDate:   form.startDate || null,
        endDate:     form.endDate || null,
        shiftStart:  null,
        shiftEnd:    null,
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

  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, true, onClose)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef}
           role="dialog" aria-modal="true" aria-labelledby="listing-form-title"
           className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-cream-200 sticky top-0 bg-white dark:bg-ink-800 z-10">
          <h2 id="listing-form-title" className="text-lg font-bold text-ink-900">
            {isEdit ? 'İlanı Düzenle' : 'Yeni İlan Oluştur'}
          </h2>
          <p className="text-sm text-ink-500">
            {isEdit ? 'Mevcut bilgileri güncelleyin' : 'Adayların göreceği iş ilanı'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
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
            <label className="label">Gereksinimler <span className="text-ink-400 font-normal">(opsiyonel)</span></label>
            <textarea name="requirements" value={form.requirements} onChange={handleChange}
              className="input resize-none h-16 text-sm"
              placeholder="Deneyim, yaş, dil bilgisi vb..." />
          </div>

          {/* FAZ 2/#25 - Ucret tipi seffafligi */}
          <div>
            <label className="label">Ücret tipi *</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { v: 'HOURLY',     l: 'Saatlik' },
                { v: 'DAILY',      l: 'Günlük'  },
                { v: 'MONTHLY',    l: 'Aylık'   },
                { v: 'NEGOTIABLE', l: 'Görüşülecek' },
              ].map(opt => (
                <button key={opt.v} type="button"
                  onClick={() => setForm(f => ({ ...f, salaryType: opt.v }))}
                  className={`text-xs font-semibold py-2 px-2 rounded-lg border-2 transition ${
                    form.salaryType === opt.v
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white dark:bg-ink-800 border-ink-200 dark:border-ink-700 text-ink-600 dark:text-ink-300 hover:border-brand-300'
                  }`}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {form.salaryType !== 'NEGOTIABLE' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Min. Ücret ₺ *</label>
                <input type="number" name="salaryMin" value={form.salaryMin} onChange={handleChange}
                  className="input"
                  placeholder={form.salaryType === 'HOURLY' ? '150' : form.salaryType === 'DAILY' ? '1500' : '20000'}
                  min="0" />
              </div>
              <div>
                <label className="label">Max. Ücret ₺ <span className="text-ink-400 font-normal">(ops.)</span></label>
                <input type="number" name="salaryMax" value={form.salaryMax} onChange={handleChange}
                  className="input"
                  placeholder={form.salaryType === 'HOURLY' ? '200' : form.salaryType === 'DAILY' ? '2000' : '30000'}
                  min="0" />
              </div>
            </div>
          )}

          {/* Bahsis seffafligi - garson/servis icin onemli */}
          <label className="flex items-center gap-2 cursor-pointer select-none p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20">
            <input type="checkbox" name="tipsIncluded"
              checked={!!form.tipsIncluded}
              onChange={(e) => setForm(f => ({ ...f, tipsIncluded: e.target.checked }))}
              className="w-4 h-4 accent-brand-600" />
            <span className="text-sm text-ink-700 dark:text-ink-200">
              Bahşiş (servis bedeli) ek olarak verilir
            </span>
          </label>

          {/* Faz E2: Vardiya slotları */}
          {(() => {
            const todayStr = new Date().toISOString().split('T')[0]
            return (
              <div className="border-2 border-brand-100 dark:border-brand-900/40 rounded-xl p-4 bg-brand-50/40 dark:bg-brand-900/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="label !mb-0">Vardiyalar *</label>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Adaylar bu vardiyalardan birine veya birkaçına başvurabilir
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700">
                    {slots.length} vardiya
                  </span>
                </div>

                <DndContext sensors={slotSensors} collisionDetection={closestCenter} onDragEnd={handleSlotDragEnd}>
                  <SortableContext items={slots.map(s => s._uid)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {slots.map((s, i) => (
                        <SortableSlot
                          key={s._uid}
                          slot={s}
                          index={i}
                          totalCount={slots.length}
                          todayStr={todayStr}
                          onUpdate={(patch) => updateSlot(i, patch)}
                          onDuplicate={() => duplicateSlot(i)}
                          onRemove={() => removeSlot(i)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <button type="button" onClick={addSlot}
                  className="w-full py-2 text-sm font-semibold text-brand-700 dark:text-brand-700 bg-white border-2 border-dashed border-brand-400 dark:border-brand-600 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors">
                  + Vardiya Ekle
                </button>
              </div>
            )
          })()}

          <div>
            <label className="label">
              Kontrat Dönemi <span className="text-ink-400 font-normal">(opsiyonel — kalıcı/sezonluk için)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" name="startDate" value={form.startDate}
                onChange={handleChange} min={new Date().toISOString().split('T')[0]}
                className="input" placeholder="Başlangıç" />
              <input type="date" name="endDate" value={form.endDate}
                onChange={handleChange} min={form.startDate || new Date().toISOString().split('T')[0]}
                className="input" placeholder="Bitiş" />
            </div>
            <p className="text-xs text-ink-400 mt-1">
              İşin bütünüyle kapsadığı dönem (yukarıdaki vardiyalar bu dönem içinde olur)
            </p>
          </div>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white dark:bg-ink-800 py-3 -mx-6 px-6 border-t border-cream-200">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">İptal</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)' }}>
              {loading
                ? (isEdit ? 'Güncelleniyor...' : 'Oluşturuluyor...')
                : (isEdit ? 'Güncelle' : 'İlan Oluştur')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* FAZ 5.5b — Tek slot satiri (drag handle ile sortable) */
function SortableSlot({ slot, index, totalCount, todayStr, onUpdate, onDuplicate, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot._uid })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 30 : 'auto',
    boxShadow: isDragging ? '0 12px 30px rgba(35, 74, 130, 0.35)' : undefined,
  }

  const locked = (slot.slotsFilled || 0) > 0

  return (
    <div ref={setNodeRef} style={style}
      className="bg-white rounded-lg p-3 border border-cream-300 space-y-2 relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          <button type="button"
            {...attributes}
            {...listeners}
            aria-label={`Vardiya ${index + 1} sürükle`}
            className="cursor-grab active:cursor-grabbing touch-none px-1.5 py-1 rounded text-ink-400 hover:bg-cream-100 hover:text-brand-700 transition-colors"
            title="Sürükle ve sırala">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <circle cx="7"  cy="5"  r="1.4" />
              <circle cx="13" cy="5"  r="1.4" />
              <circle cx="7"  cy="10" r="1.4" />
              <circle cx="13" cy="10" r="1.4" />
              <circle cx="7"  cy="15" r="1.4" />
              <circle cx="13" cy="15" r="1.4" />
            </svg>
          </button>
          <span className="text-xs font-semibold text-ink-500">
            Vardiya #{index + 1}
            {locked && (
              <span className="ml-2 text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                {slot.slotsFilled}/{slot.slotsNeeded} dolu
              </span>
            )}
          </span>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onDuplicate}
            className="text-xs px-2 py-1 rounded bg-cream-100 hover:bg-cream-200 text-ink-600 flex items-center justify-center"
            title="Bu vardiyayı çoğalt">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
            </svg>
          </button>
          {totalCount > 1 && (
            <button type="button" onClick={onRemove}
              disabled={locked}
              className="text-xs px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
              title={locked ? 'Bu slota kabul edilmiş aday var, silinemez' : 'Sil'}
              aria-label="Sil">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="col-span-2 sm:col-span-2">
          <label className="text-xs text-ink-500">Tarih</label>
          <input type="date" value={slot.date} min={todayStr}
            onChange={e => onUpdate({ date: e.target.value })}
            className="input text-sm !py-1.5" required />
        </div>
        <div>
          <label className="text-xs text-ink-500">Başlangıç</label>
          <input type="time" value={slot.startTime}
            onChange={e => onUpdate({ startTime: e.target.value })}
            className="input text-sm !py-1.5" required />
        </div>
        <div>
          <label className="text-xs text-ink-500">Bitiş</label>
          <input type="time" value={slot.endTime}
            onChange={e => onUpdate({ endTime: e.target.value })}
            className="input text-sm !py-1.5" required />
        </div>
      </div>

      <div>
        <label className="text-xs text-ink-500">İhtiyaç sayısı (kaç aday)</label>
        <input type="number" min="1" max="50" value={slot.slotsNeeded}
          onChange={e => onUpdate({ slotsNeeded: e.target.value })}
          className="input text-sm !py-1.5 w-24" required />
      </div>
    </div>
  )
}
