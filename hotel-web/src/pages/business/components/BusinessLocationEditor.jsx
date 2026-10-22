import { useState } from 'react'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import MapView from '../../../components/MapView'

/**
 * Business profili — tam konum editörü.
 * Aday'lar ilan detayında bu tam konumu görür. Adres ya yazılır geocode + harita,
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
    // Backend kuralıyla aynı: en az 3 karakter
    if (!searchInput || searchInput.trim().length < 3) {
      toast.error('Aramak için en az 3 karakter yaz.')
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
        toast.error('Adres bulunamadı. Haritaya tıklayarak da işaretleyebilirsin.')
      }
    } catch (err) {
      // 503 (yoğunluk/sağlayıcı hatası) ve 422 mesajları backend'den Türkçe gelir
      toast.error(extractErrorMessage(err) || 'Adres araması şu anda yapılamıyor.')
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
          <h3 className="type-card">Tam konum</h3>
          <p className="type-meta mt-1">
            {hasExact
              ? 'Adaylar ilan detayında bu tam konumu görür.'
              : 'Adresi yaz veya haritada tıklayarak işaretle. Aksi halde ilçe merkezi gösterilir.'}
          </p>
        </div>
        {hasExact && (
          <button type="button" onClick={handleClear}
            className="btn-ghost flex-shrink-0">
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
          aria-label="Adres ara"
          placeholder="Örn: Bağdat Caddesi 42"
          className="input flex-1 min-w-0 text-sm" />
        <button type="button" onClick={handleSearch} disabled={searching}
          className="btn-secondary !w-auto flex-shrink-0">
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
        <div className="flex items-center gap-2 type-caption type-num">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--ah-ok)' }} aria-hidden="true" />
          <span className="sr-only">Seçili koordinat:</span>
          {position[0].toFixed(5)}, {position[1].toFixed(5)}
        </div>
      )}
    </div>
  )
}
