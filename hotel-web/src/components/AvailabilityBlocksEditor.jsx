import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'

/**
 * Faz B/#10 — Aday haftalık müsaitlik blokları editörü.
 *
 * Cal.com tarzı: aday "Pzt 09-17", "Cuma 14-22" gibi tekrarlayan haftalık
 * dilimler tanımlar. PUT atomik (tüm liste replace).
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

export default function AvailabilityBlocksEditor() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    hotelApi.getMyAvailabilityBlocks()
      .then(data => setBlocks(data.map(b => ({
        // backend HH:mm:ss formatında dönebilir; HH:mm'e indirgenir
        ...b, startTime: trimSeconds(b.startTime), endTime: trimSeconds(b.endTime),
      }))))
      .catch(() => toast.error('Müsaitlik blokları yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  function addBlock() {
    setBlocks(prev => [...prev, { id: null, dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '17:00' }])
    setDirty(true)
  }
  function updateBlock(idx, patch) {
    setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b))
    setDirty(true)
  }
  function removeBlock(idx) {
    setBlocks(prev => prev.filter((_, i) => i !== idx))
    setDirty(true)
  }

  async function save() {
    for (const b of blocks) {
      if (!b.dayOfWeek || !b.startTime || !b.endTime) {
        toast.error('Her satırda gün, başlangıç ve bitiş zorunlu')
        return
      }
      if (b.startTime >= b.endTime) {
        toast.error(`${DAY_LABELS[b.dayOfWeek]}: başlangıç bitişten önce olmalı`)
        return
      }
    }
    setSaving(true)
    try {
      const fresh = await hotelApi.setMyAvailabilityBlocks(blocks.map(b => ({
        dayOfWeek: b.dayOfWeek,
        startTime: ensureSeconds(b.startTime),
        endTime: ensureSeconds(b.endTime),
      })))
      setBlocks(fresh.map(b => ({
        ...b, startTime: trimSeconds(b.startTime), endTime: trimSeconds(b.endTime),
      })))
      setDirty(false)
      toast.success('Müsaitlik kaydedildi')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...blocks].sort((a, b) => {
    const d = DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)
    return d !== 0 ? d : a.startTime.localeCompare(b.startTime)
  })

  return (
    <div className="card p-5"
         style={{
           background: 'linear-gradient(135deg, rgba(20, 14, 38, 0.85), rgba(15, 10, 30, 0.85))',
           border: '1px solid rgba(168, 85, 247, 0.20)',
         }}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-1"
              style={{ color: '#c4b5fd' }}>
            Haftalık Müsaitlik
          </h3>
          <p className="text-[11px] max-w-md" style={{ color: '#a5b4fc' }}>
            Hangi gün ve saatlerde çalışabilirsin? İşletmeler ilan açtığında bu bloklara
            göre eşleştirme yapılır.
          </p>
        </div>
        <button type="button" onClick={addBlock}
          className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(168, 85, 247, 0.18)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            color: '#d8b4fe',
          }}>
          + Blok Ekle
        </button>
      </div>

      {loading && <p className="text-xs" style={{ color: '#a5b4fc' }}>Yükleniyor...</p>}

      {!loading && sorted.length === 0 && (
        <div className="text-center py-6 rounded-lg"
             style={{ background: 'rgba(168, 85, 247, 0.06)', border: '1px dashed rgba(168, 85, 247, 0.25)' }}>
          <p className="text-xs" style={{ color: '#c4b5fd' }}>
            Henüz blok tanımlanmamış. <b>+ Blok Ekle</b> ile başla.
          </p>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((b, sortedIdx) => {
            // İşlemleri kaynak (sıralanmamış) listede yapmak için orijinal index'i bul
            const realIdx = blocks.findIndex(x => x === b || (x.id === b.id && x.dayOfWeek === b.dayOfWeek && x.startTime === b.startTime))
            return (
              <div key={b.id ?? `new-${sortedIdx}`}
                   className="flex flex-wrap items-center gap-2 rounded-lg p-2"
                   style={{ background: 'rgba(168, 85, 247, 0.06)', border: '1px solid rgba(168, 85, 247, 0.18)' }}>
                <select value={b.dayOfWeek}
                        onChange={e => updateBlock(realIdx, { dayOfWeek: e.target.value })}
                        className="text-sm rounded-md px-2 py-1.5 min-w-[110px]"
                        style={{
                          background: 'rgba(15, 10, 30, 0.85)',
                          color: '#e9d5ff',
                          border: '1px solid rgba(168, 85, 247, 0.30)',
                        }}>
                  {DAY_ORDER.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>
                <input type="time" value={b.startTime}
                       onChange={e => updateBlock(realIdx, { startTime: e.target.value })}
                       className="text-sm rounded-md px-2 py-1.5"
                       style={{
                         background: 'rgba(15, 10, 30, 0.85)',
                         color: '#e9d5ff',
                         border: '1px solid rgba(168, 85, 247, 0.30)',
                         colorScheme: 'dark',
                       }} />
                <span style={{ color: '#a5b4fc' }}>—</span>
                <input type="time" value={b.endTime}
                       onChange={e => updateBlock(realIdx, { endTime: e.target.value })}
                       className="text-sm rounded-md px-2 py-1.5"
                       style={{
                         background: 'rgba(15, 10, 30, 0.85)',
                         color: '#e9d5ff',
                         border: '1px solid rgba(168, 85, 247, 0.30)',
                         colorScheme: 'dark',
                       }} />
                <button type="button" onClick={() => removeBlock(realIdx)}
                  title="Bu bloğu sil"
                  className="ml-auto w-7 h-7 rounded-full flex items-center justify-center transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#fca5a5',
                    border: '1px solid rgba(239, 68, 68, 0.30)',
                  }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!loading && (
        <div className="flex justify-end mt-4">
          <button type="button" onClick={save} disabled={!dirty || saving}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-white rounded-full transition-all hover:-translate-y-0.5 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #6b21a8, #9333ea)',
              boxShadow: '0 0 14px rgba(168, 85, 247, 0.40)',
            }}>
            {saving ? 'Kaydediliyor...' : 'Müsaitliği Kaydet'}
          </button>
        </div>
      )}
    </div>
  )
}

// Backend LocalTime "HH:mm:ss" döner; <input type="time"> "HH:mm" bekler
function trimSeconds(t) {
  if (!t) return ''
  return t.length > 5 ? t.slice(0, 5) : t
}
function ensureSeconds(t) {
  if (!t) return t
  return t.length === 5 ? t + ':00' : t
}
