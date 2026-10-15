/**
 * Kayıtlı aramalar — ListingsPage filtre panelinde render edilir.
 *  1) Mevcut filtreleri "Aramayı kaydet" ile saklar (isim ister)
 *  2) Kayıtlı aramaları listeler; tıklayınca filtreleri uygular
 *  3) Her aramada bildirim aç/kapat + sil
 *
 * Vardiya saati (shifts) kayıtlı aramaya EKLENMEZ: backend eşleştirmesi ilanın
 * `shift` alanına bakıyor ve bu alan yeni ilanlarda boş; eklenirse arama yeni
 * ilanlarla hiç eşleşmez. Kullanıcıya bu durum kısa bir notla söylenir.
 */
import { useState } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'
import { POSITION_LABELS, JOB_TYPE_LABELS, labelOf } from '../utils/labels'

const SALARY_UNIT = { DAILY: '₺/gün', PART_TIME: '₺/gün', PERMANENT: '₺/ay', SEASONAL: '₺/ay' }

export function buildSavedSearchPayload(label, f = {}) {
  return {
    name: label,
    position:  f.position  || null,
    jobType:   f.jobType   || null,
    keyword:   f.keyword   || null,
    // Ücret birimi çalışma türüne bağlı; tür yoksa ücret kaydedilmez
    minSalary: f.jobType && f.minSalary ? Number(f.minSalary) : null,
    dateFrom:  f.dateFrom  || null,
    dateTo:    f.dateTo    || null,
    shifts:    null,
  }
}

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

  function handleSubmitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Arama için bir ad gir')
      return
    }
    createMut.mutate(buildSavedSearchPayload(trimmed, filters))
  }

  const hasActiveFilters =
    !!(filters?.position || filters?.jobType ||
       filters?.keyword || filters?.minSalary || filters?.dateFrom)

  return (
    <div className="space-y-2.5">
      <div>
        {!showSaveInput ? (
          <button
            type="button"
            disabled={!hasActiveFilters}
            onClick={() => setShowSaveInput(true)}
            className="btn-secondary w-full"
            title={hasActiveFilters ? 'Bu filtreleri kaydet' : 'Önce bir filtre seç'}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Aramayı kaydet
          </button>
        ) : (
          <div className="space-y-2">
            <label htmlFor="saved-search-name" className="sr-only">Arama adı</label>
            <input id="saved-search-name" type="text" value={name} autoFocus maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleSubmitName() }
                if (e.key === 'Escape') { setShowSaveInput(false); setName('') }
              }}
              placeholder="Aramaya ad ver (ör. Beşiktaş garson)"
              className="input text-sm" />
            <div className="flex gap-2">
              <button type="button" onClick={handleSubmitName}
                disabled={createMut.isPending}
                className="btn-primary flex-1">
                {createMut.isPending ? 'Kaydediliyor' : 'Kaydet'}
              </button>
              <button type="button"
                onClick={() => { setShowSaveInput(false); setName('') }}
                className="btn-ghost">
                İptal
              </button>
            </div>
          </div>
        )}
        {filters?.shiftBandsActive && (
          <p className="type-caption mt-1.5" data-testid="saved-search-shift-note">
            Vardiya saati seçimi kayıtlı aramaya eklenmez.
          </p>
        )}
      </div>

      {!isLoading && saved.length > 0 && (
        <div className="space-y-1.5 pt-2" style={{ borderTop: '1px solid var(--ah-line)' }}>
          <div className="type-label pt-1">
            Kayıtlı aramalar · <span className="tabular-nums">{saved.length}</span>
          </div>
          <ul className="space-y-1.5">
            {saved.map(s => (
              <li key={s.id} className="flex items-center gap-1 rounded-lg pl-3"
                  style={{ border: '1px solid var(--ah-line)', background: 'var(--ah-card)' }}>
                <button type="button" onClick={() => onApply?.(s)}
                  title="Bu aramayı uygula"
                  className="flex-1 min-w-0 text-left py-2">
                  <span className="type-subhead block truncate" style={{ color: 'var(--ah-ink)' }}>{s.name}</span>
                  <span className="type-caption block truncate mt-0.5">{buildPreview(s)}</span>
                </button>
                <button type="button"
                  onClick={() => toggleNotifMut.mutate({ id: s.id, enabled: !s.notificationsEnabled })}
                  aria-pressed={!!s.notificationsEnabled}
                  aria-label={s.notificationsEnabled ? `${s.name} bildirimlerini kapat` : `${s.name} bildirimlerini aç`}
                  title={s.notificationsEnabled ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
                  className="w-11 h-11 grid place-items-center rounded-lg flex-shrink-0"
                  style={{ color: s.notificationsEnabled ? 'var(--ah-brand)' : 'var(--ah-ink-3)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                       fill={s.notificationsEnabled ? 'currentColor' : 'none'}
                       stroke="currentColor" strokeWidth={1.8} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                  </svg>
                </button>
                <button type="button" onClick={() => deleteMut.mutate(s.id)}
                  aria-label={`${s.name} aramasını sil`}
                  title="Sil"
                  className="w-11 h-11 grid place-items-center rounded-lg flex-shrink-0"
                  style={{ color: 'var(--ah-ink-3)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function buildPreview(s) {
  const parts = []
  if (s.keyword) parts.push(`"${s.keyword}"`)
  if (s.position) parts.push(labelOf(POSITION_LABELS, s.position))
  if (s.jobType) parts.push(labelOf(JOB_TYPE_LABELS, s.jobType))
  if (s.minSalary) {
    parts.push(`${Number(s.minSalary).toLocaleString('tr-TR')} ${SALARY_UNIT[s.jobType] || '₺'}+`)
  }
  return parts.length ? parts.join(' · ') : 'Tüm ilanlar'
}
