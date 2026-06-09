import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { coordsOfDistrict, ISTANBUL_CENTER } from '../data/istanbul'

/**
 * #81 v2: Leaflet harita — okuma + düzenleme modu.
 *
 * Props:
 *   - position:     [lat, lng]   tam koordinat (ÖNCELIKLI)
 *   - district:     'Beşiktaş'   fallback (position yoksa ilçe merkezi)
 *   - neighborhood: 'Levent'     popup'ta gösterim
 *   - title:        'Park Otel'  popup başlık
 *   - height:       '240px'
 *   - zoom:         16            tam konum varsa 16, ilçe fallback'inde 13
 *   - editable:     false        true ise tıklamayla marker güncellenir
 *   - onChange:     ([lat,lng])  düzenleme modunda yeni koordinat callback
 *
 * Tile: CartoDB Dark (ücretsiz, key yok).
 * Geocoding: Nominatim (OpenStreetMap, ücretsiz, rate-limited).
 */

// ── Custom marker (Vite/webpack uyumsuzluğu için divIcon) ──
const brandIcon = L.divIcon({
  className: 'custom-map-marker',
  html: `
    <div style="
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #0f766e, #0d9488);
      border: 2px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.5);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 10px; height: 10px;
        background: white;
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize:     [32, 32],
  iconAnchor:   [16, 32],
  popupAnchor:  [0, -32],
})

function MapInvalidator() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(t)
  }, [map])
  return null
}

// Düzenleme modu: tıklayınca marker güncellenir
function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function MapView({
  position,         // [lat, lng] — tam konum (öncelikli)
  district,         // ilçe — fallback
  neighborhood,
  title,
  height = '240px',
  zoom,
  editable = false,
  onChange,
}) {
  // 1) position varsa onu kullan
  // 2) yoksa district merkezi
  // 3) yoksa İstanbul merkezi
  const hasExact = Array.isArray(position) && position.length === 2 &&
                   typeof position[0] === 'number' && typeof position[1] === 'number'
  const coords = hasExact ? position
                          : (district ? coordsOfDistrict(district) : ISTANBUL_CENTER)
  const effectiveZoom = zoom || (hasExact ? 16 : 13)
  const isApprox = !hasExact && district

  if (!hasExact && !district && !editable) {
    return (
      <div className="rounded-2xl border border-cream-300 bg-slate-900/40 flex items-center justify-center"
           style={{ height }}>
        <p className="text-xs text-ink-500 uppercase tracking-widest">Konum bilgisi yok</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-cream-300 relative" style={{ height }}>
      <MapContainer
        center={coords}
        zoom={effectiveZoom}
        scrollWheelZoom={editable}
        style={{ height: '100%', width: '100%', background: '#0a0f1c' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        <Marker position={coords} icon={brandIcon}>
          <Popup>
            <div className="text-[12px]">
              {title && <div className="font-bold text-ink-900 mb-0.5">{title}</div>}
              <div className="text-ink-700">
                {district}{neighborhood ? ` · ${neighborhood}` : ''}
              </div>
              {isApprox && (
                <div className="text-[10px] text-amber-700 mt-1 italic">
                  Yaklaşık konum — işletme henüz tam konum girmemiş
                </div>
              )}
              {hasExact && (
                <div className="text-[10px] text-brand-700 mt-1">
                  Tam konum: {coords[0].toFixed(5)}, {coords[1].toFixed(5)}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
        {editable && <ClickHandler onClick={onChange} />}
        <MapInvalidator />
      </MapContainer>

      {/* Düzenleme modunda kullanıcıya rehber */}
      {editable && (
        <div className="absolute top-2 left-2 right-2 bg-cream-100/85 backdrop-blur-sm border border-emerald-500/30 text-brand-700 text-[11px] uppercase tracking-widest font-bold px-3 py-1.5 rounded-full text-center pointer-events-none">
          Konumu seçmek için haritaya tıkla
        </div>
      )}

      {/* Sağ alt köşe — attribution (CartoDB + OSM zorunlu) */}
      <div className="absolute bottom-1 right-1 text-[8px] text-ink-400/70 bg-cream-100/80 px-1.5 py-0.5 rounded backdrop-blur-sm">
        © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer" className="hover:text-white">CARTO</a>
        {' '}·{' '}
        © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-white">OSM</a>
      </div>
    </div>
  )
}

/**
 * Nominatim adres arama yardımcısı (OpenStreetMap, ücretsiz).
 * Kullanıcı adres yazınca koordinat önerisi getirir.
 * Rate limit: 1 req/sec — UI'da debounce zorunlu.
 *
 * @returns Promise<[lat, lng] | null>
 */
export async function geocodeAddress(query) {
  if (!query || query.trim().length < 5) return null
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=tr&limit=1&q=${encodeURIComponent(query + ', İstanbul')}`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'tr,en' },
    })
    if (!res.ok) return null
    const arr = await res.json()
    if (!Array.isArray(arr) || arr.length === 0) return null
    return [parseFloat(arr[0].lat), parseFloat(arr[0].lon)]
  } catch {
    return null
  }
}
