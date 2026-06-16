import { useState } from 'react'
import toast from 'react-hot-toast'
import MapView from '../../../components/MapView'

/**
 * Business profili — tam konum editörü.
 * Aday'lar ilan detayında bu tam konumu görür. Adres ya yazılır → geocode + harita,
 * ya da haritaya tıklayarak işaretlenir.
 */
export default function BusinessLocationEditor({
  district, neighborhood, businessName, address,
  latitude, longitude, onChange,
}) {
  const [searchInput, setSearchInput] = useState(address || '')
  const [searching, setSearching] = useState(false)
  const hasExact = latitude != null && longitude != null

  async function handleSearch() {
    if (!searchInput || searchInput.trim().length < 5) {
      toast.error('Adres en az 5 karakter olmalı')
      return
    }
    setSearching(true)
    try {
      const { geocodeAddress } = await import('../../../components/MapView')
      const fullQuery = `${searchInput.trim()}, ${neighborhood || ''} ${district}`
      const coords = await geocodeAddress(fullQuery)
      if (coords) {
        onChange(coords[0], coords[1])
        toast.success('Adres haritada bulundu')
      } else {
        toast.error('Adres bulunamadı — haritaya tıklayarak da işaretleyebilirsiniz')
      }
    } catch (err) {
      toast.error('Adres arama başarısız')
    } finally {
      setSearching(false)
    }
  }

  function handleMapClick([lat, lng]) {
    onChange(lat, lng)
  }

  function handleClear() {
    onChange(null, null)
    setSearchInput('')
  }

  const position = hasExact ? [Number(latitude), Number(longitude)] : null

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
              style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
            Tam Konum
          </h3>
          <p className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">
            {hasExact
              ? 'Aday\'lar ilan detayında bu tam konumu görür.'
              : 'Adresi yaz veya haritada tıklayarak işaretle. Aksi halde ilçe merkezi gösterilir.'}
          </p>
        </div>
        {hasExact && (
          <button type="button" onClick={handleClear}
            className="btn-sm bg-cream-100 hover:bg-cream-200 text-ink-700 dark:bg-ink-700 dark:hover:bg-slate-700 dark:text-ink-300 flex-shrink-0">
            Temizle
          </button>
        )}
      </div>

      {/* Adres arama */}
      <div className="flex gap-2">
        <input type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          placeholder="Örn: Bağdat Caddesi 42 — Adres + numara"
          className="input flex-1 text-sm" />
        <button type="button" onClick={handleSearch} disabled={searching}
          className="btn-sm bg-brand-700 text-white hover:bg-brand-800 disabled:opacity-50 flex-shrink-0 px-4">
          {searching ? 'Aranıyor...' : 'Ara'}
        </button>
      </div>

      <MapView
        position={position}
        district={district}
        neighborhood={neighborhood}
        title={businessName}
        height="280px"
        editable
        onChange={handleMapClick}
      />

      {hasExact && (
        <div className="flex items-center gap-2 text-[11px] text-brand-700 dark:text-brand-700 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
          {position[0].toFixed(5)}, {position[1].toFixed(5)}
        </div>
      )}
    </div>
  )
}
