import { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'
import { validateShiftTimes, isOvernight, shiftDuration, MAX_AVAILABILITY_HOURS } from '../lib/shiftTime'

/**
 * Aday haftalık müsaitlik blokları editörü.
 *
 * Aday "Pzt 09:00–17:00", "Cuma 22:00–06:00" gibi tekrarlayan haftalık dilimler
 * tanımlar. Bitiş başlangıçtan önceyse blok ertesi gün biter (gece müsaitliği);
 * yalnız eşit saat geçersizdir (backend aynı kuralı 422 ile uygular). Müsaitlik
 * bloğu vardiya değildir: 16 saat sınırı yok, 24 saate kadar (ör. 00:00–23:59).
 * PUT atomik (tüm liste replace).
 */

const DAY_LABELS = {
  MONDAY:    'Pazartesi',
  TUESDAY:   'Salı',
  WEDNESDAY: 'Çarşamba',
  THURSDAY:  'Perşembe',
  FRIDAY:    'Cuma',
  SATURDAY:  'Cumartesi',
  SUNDAY:    'Pazar',
}
const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']

let keySeq = 0
const nextKey = () => `blk-${++keySeq}`

/** Satır doğrulaması: geçerliyse null, değilse Türkçe mesaj. */
export function validateAvailabilityBlock(b) {
  if (!b.dayOfWeek || !b.startTime || !b.endTime) return 'Gün, başlangıç ve bitiş zorunlu'
  return validateShiftTimes(b.startTime, b.endTime, { subject: 'Müsaitlik bloğu', maxHours: MAX_AVAILABILITY_HOURS })
}

export default function AvailabilityBlocksEditor() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const mounted = useRef(true)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    hotelApi.getMyAvailabilityBlocks()
      .then(data => { if (mounted.current) setBlocks(normalize(data)) })
      .catch(() => { if (mounted.current) setLoadError(true) })
      .finally(() => { if (mounted.current) setLoading(false) })
  }, [])

  useEffect(() => {
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [load])

  function addBlock() {
    setBlocks(prev => [...prev, { _k: nextKey(), id: null, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }])
    setDirty(true)
  }
  function updateBlock(key, patch) {
    setBlocks(prev => prev.map(b => b._k === key ? { ...b, ...patch } : b))
    setDirty(true)
  }
  function removeBlock(key) {
    setBlocks(prev => prev.filter(b => b._k !== key))
    setDirty(true)
  }

  async function save() {
    const firstInvalid = blocks.find(b => validateAvailabilityBlock(b))
    if (firstInvalid) {
      setShowErrors(true)
      toast.error(`${DAY_LABELS[firstInvalid.dayOfWeek] || 'Blok'}: ${validateAvailabilityBlock(firstInvalid)}`)
      return
    }
    setSaving(true)
    try {
      const fresh = await hotelApi.setMyAvailabilityBlocks(blocks.map(b => ({
        dayOfWeek: b.dayOfWeek,
        startTime: ensureSeconds(b.startTime),
        endTime: ensureSeconds(b.endTime),
      })))
      setBlocks(normalize(fresh))
      setDirty(false)
      setShowErrors(false)
      toast.success('Müsaitlik kaydedildi')
    } catch (err) {
      // Backend 422 mesajı (eşit saat vb.) olduğu gibi gösterilir
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...blocks].sort((a, b) => {
    const d = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
    return d !== 0 ? d : (a.startTime || '').localeCompare(b.startTime || '')
  })

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="type-card" style={{ color: 'var(--ah-ink)' }}>Haftalık müsaitlik</h3>
          <p className="type-caption max-w-md mt-1" style={{ color: 'var(--ah-ink-3)' }}>
            Hangi gün ve saatlerde çalışabilirsin? İşletmeler ilan açtığında bu bloklara
            göre eşleştirme yapılır. Gece bloklarında bitiş saati ertesi güne geçebilir (ör. 22:00–06:00).
          </p>
        </div>
        {!loading && !loadError && (
          <button type="button" onClick={addBlock} className="btn-secondary">
            Blok ekle
          </button>
        )}
      </div>

      {loading && <p className="type-caption" style={{ color: 'var(--ah-ink-3)' }}>Yükleniyor...</p>}

      {!loading && loadError && (
        <div className="text-center py-6 rounded-lg" role="alert"
             style={{ background: 'var(--ah-danger-soft)', border: '1px solid var(--ah-line)' }}>
          <p className="type-body" style={{ color: 'var(--ah-danger)' }}>Müsaitlik blokları yüklenemedi.</p>
          <button type="button" onClick={load} className="btn-secondary mt-3">Tekrar dene</button>
        </div>
      )}

      {!loading && !loadError && sorted.length === 0 && (
        <div className="text-center py-6 rounded-lg"
             style={{ background: 'var(--ah-band)', border: '1px dashed var(--ah-line-2)' }}>
          <p className="type-body" style={{ color: 'var(--ah-ink-2)' }}>
            Henüz blok tanımlanmamış. <b>Blok ekle</b> ile başla.
          </p>
        </div>
      )}

      {!loading && !loadError && sorted.length > 0 && (
        <ul className="space-y-2" data-testid="availability-blocks">
          {sorted.map(b => {
            const error = validateAvailabilityBlock(b)
            const overnight = !error && isOvernight(b.startTime, b.endTime)
            const duration = !error ? shiftDuration(b.startTime, b.endTime) : null
            const dayLabel = DAY_LABELS[b.dayOfWeek] || b.dayOfWeek
            return (
              <li key={b._k} className="rounded-lg p-2"
                  style={{ background: 'var(--ah-band)', border: '1px solid var(--ah-line)' }}>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={b.dayOfWeek} aria-label="Gün"
                          onChange={e => updateBlock(b._k, { dayOfWeek: e.target.value })}
                          className="input w-auto min-w-[120px]">
                    {DAY_ORDER.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                  </select>
                  <input type="time" value={b.startTime} aria-label={`${dayLabel} başlangıç`}
                         onChange={e => updateBlock(b._k, { startTime: e.target.value })}
                         className="input w-auto" />
                  <span aria-hidden="true" style={{ color: 'var(--ah-ink-3)' }}>–</span>
                  <input type="time" value={b.endTime} aria-label={`${dayLabel} bitiş`}
                         onChange={e => updateBlock(b._k, { endTime: e.target.value })}
                         className="input w-auto" />
                  {duration && (
                    <span className="type-caption tabular-nums" style={{ color: 'var(--ah-ink-2)' }}>
                      {duration}
                    </span>
                  )}
                  {overnight && <span className="badge badge-neutral">Ertesi gün biter</span>}
                  <button type="button" onClick={() => removeBlock(b._k)}
                    aria-label={`${dayLabel} bloğunu sil`} title="Bu bloğu sil"
                    className="btn-ghost ml-auto">
                    Sil
                  </button>
                </div>
                {error && (showErrors || isTimeError(b)) && (
                  <p className="type-caption mt-1.5" role="alert" style={{ color: 'var(--ah-danger)' }}>
                    {error}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!loading && !loadError && (
        <div className="flex justify-end mt-4">
          <button type="button" onClick={save} disabled={!dirty || saving} className="btn-primary">
            {saving ? 'Kaydediliyor...' : 'Müsaitliği kaydet'}
          </button>
        </div>
      )}
    </div>
  )
}

/** Saatler dolu ama kural ihlali (eşit saat) — anında gösterilir. */
function isTimeError(b) {
  return !!(b.startTime && b.endTime)
}

function normalize(list) {
  return (list || []).map(b => ({
    ...b,
    _k: nextKey(),
    // backend HH:mm:ss formatında dönebilir; <input type="time"> HH:mm bekler
    startTime: trimSeconds(b.startTime),
    endTime: trimSeconds(b.endTime),
  }))
}

function trimSeconds(t) {
  if (!t) return ''
  return t.length > 5 ? t.slice(0, 5) : t
}
function ensureSeconds(t) {
  if (!t) return t
  return t.length === 5 ? t + ':00' : t
}
