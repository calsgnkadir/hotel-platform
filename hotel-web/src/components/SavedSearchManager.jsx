/**
 * FAZ 5 — Saved Search Manager
 *
 * ListingsPage filtre sidebar'ında render edilir.
 * Üç görev:
 *  1) Mevcut filtreleri "Aramayı Kaydet" butonuyla persist eder (isim ister)
 *  2) Kullanıcının kayıtlı aramalarını listeler — tıklayınca filtreleri uygular
 *  3) Her aramada zil (bildirim toggle) + sil butonu
 */
import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'

export default function SavedSearchManager({ filters, onApply }) {
  const queryClient = useQueryClient()
  const [showSaveInput, setShowSaveInput] = useState(false)
  const [name, setName] = useState('')

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: hotelApi.listSavedSearches,
    staleTime: 60_000,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] })

  const createMut = useMutation({
    mutationFn: hotelApi.createSavedSearch,
    onSuccess: () => {
      toast.success('Arama kaydedildi · yeni eşleşmelerde bildirim alacaksın')
      setShowSaveInput(false)
      setName('')
      invalidate()
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  })

  const toggleNotifMut = useMutation({
    mutationFn: ({ id, enabled }) => hotelApi.updateSavedSearch(id, { notificationsEnabled: enabled }),
    onSuccess: invalidate,
    onError: (err) => toast.error(extractErrorMessage(err)),
  })

  const deleteMut = useMutation({
    mutationFn: hotelApi.deleteSavedSearch,
    onSuccess: () => { toast.success('Kayıtlı arama silindi'); invalidate() },
    onError: (err) => toast.error(extractErrorMessage(err)),
  })

  function buildPayload(label) {
    const f = filters
    return {
      name: label,
      position:  f.position  || null,
      jobType:   f.jobType   || null,
      district:  f.district  || null,
      keyword:   f.keyword   || null,
      minSalary: f.minSalary ? Number(f.minSalary) : null,
      dateFrom:  f.dateFrom  || null,
      dateTo:    f.dateTo    || null,
      shifts:    (f.shifts && f.shifts.length) ? f.shifts : null,
    }
  }

  function handleSubmitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Arama için bir isim gir')
      return
    }
    createMut.mutate(buildPayload(trimmed))
  }

  const hasActiveFilters =
    !!(filters?.position || filters?.jobType || filters?.district ||
       filters?.keyword || filters?.minSalary || filters?.dateFrom ||
       (filters?.shifts && filters.shifts.length > 0))

  return (
    <div className="space-y-2.5">
      {/* Save button + inline name input */}
      <div>
        {!showSaveInput ? (
          <button
            type="button"
            disabled={!hasActiveFilters}
            onClick={() => setShowSaveInput(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{
              background: hasActiveFilters
                ? 'linear-gradient(135deg, #1b1815, #8a7349)'
                : 'rgba(27, 24, 21, 0.75)',
              color: hasActiveFilters ? '#ffffff' : '#6b6358',
              border: `1px solid ${hasActiveFilters ? 'rgba(205, 183, 143, 0.28)' : 'rgba(205, 183, 143, 0.12)'}`,
              boxShadow: hasActiveFilters ? '0 4px 14px rgba(35, 74, 130, 0.30)' : 'none',
            }}
            title={hasActiveFilters ? 'Bu filtreleri kaydet' : 'Önce bir filtre seç'}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="m17.593 3.322 1.1.128A2.25 2.25 0 0 1 20.75 5.69V21l-7.5-3.5L5.75 21V5.69a2.25 2.25 0 0 1 2.057-2.24l1.1-.128a45.5 45.5 0 0 1 8.686 0Z" />
            </svg>
            Aramayı Kaydet
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            className="space-y-2">
            <input type="text" value={name} autoFocus maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSubmitName() }
                if (e.key === 'Escape') { setShowSaveInput(false); setName('') }
              }}
              placeholder="Aramaya isim ver (örn: Beşiktaş Garson)"
              className="input text-sm" />
            <div className="flex gap-2">
              <button type="button" onClick={handleSubmitName}
                disabled={createMut.isPending}
                className="flex-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #1b1815, #8a7349)' }}>
                {createMut.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button type="button"
                onClick={() => { setShowSaveInput(false); setName('') }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
                style={{
                  background: 'rgba(27, 24, 21, 0.75)',
                  color: '#c9bdaa',
                  border: '1px solid rgba(205, 183, 143, 0.10)',
                }}>
                İptal
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Saved list */}
      {!isLoading && saved.length > 0 && (
        <div className="space-y-1.5 pt-2"
             style={{ borderTop: '1px solid rgba(205, 183, 143, 0.08)' }}>
          <div className="text-[10px] font-bold uppercase tracking-widest pt-2"
               style={{ color: '#928678' }}>
            Kayıtlı Aramalar · {saved.length}
          </div>
          <AnimatePresence initial={false}>
            {saved.map(s => (
              <motion.div key={s.id}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="group relative rounded-lg px-2.5 py-2 transition-all hover:-translate-y-0.5"
                style={{
                  background: 'rgba(27, 24, 21, 0.75)',
                  border: '1px solid rgba(205, 183, 143, 0.12)',
                }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => onApply?.(s)}
                    title="Bu aramayı uygula"
                    className="flex-1 min-w-0 text-left">
                    <div className="text-[12px] font-semibold truncate" style={{ color: '#ffffff' }}>
                      {s.name}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: '#928678' }}>
                      {buildPreview(s)}
                    </div>
                  </button>
                  <button onClick={() => toggleNotifMut.mutate({ id: s.id, enabled: !s.notificationsEnabled })}
                    title={s.notificationsEnabled ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                    className="w-6 h-6 grid place-items-center rounded-full transition-colors flex-shrink-0"
                    style={{
                      color: s.notificationsEnabled ? '#cdb78f' : 'rgba(139, 169, 210, 0.5)',
                      background: s.notificationsEnabled ? 'rgba(205, 183, 143, 0.10)' : 'transparent',
                    }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={s.notificationsEnabled ? 'currentColor' : 'none'}
                         stroke="currentColor" strokeWidth={1.8} className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round"
                            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                    </svg>
                  </button>
                  <button onClick={() => deleteMut.mutate(s.id)}
                    title="Sil"
                    className="w-6 h-6 grid place-items-center rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20 flex-shrink-0"
                    style={{ color: 'rgba(252, 165, 165, 0.85)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth={2} className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function buildPreview(s) {
  const parts = []
  if (s.keyword) parts.push(`"${s.keyword}"`)
  if (s.position) parts.push(s.position)
  if (s.district) parts.push(s.district)
  if (s.shifts && s.shifts.length) parts.push(`${s.shifts.length} vardiya`)
  if (s.minSalary) parts.push(`≥${s.minSalary}₺`)
  return parts.length ? parts.join(' · ') : 'Tüm ilanlar'
}
