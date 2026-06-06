import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { coordsOfDistrict, ISTANBUL_CENTER } from '../data/istanbul'

/**
 * #81: Leaflet harita gösterimi.
 *
 * Props:
 *   - district:     'Beşiktaş'      (ilçe, koordinat lookup için)
 *   - neighborhood: 'Levent'        (opsiyonel, marker popup'ta gösterilir)
 *   - title:        'Park Otel'     (popup başlık)
 *   - height:       '240px'         (default)
 *   - zoom:         13              (default)
 *
 * Koordinat data: src/data/istanbul.js — 39 ilçe için sabit lat/lng.
 * Tile server: CartoDB Dark (ücretsiz, key yok, retina destekli).
 */

// ── Custom marker (Leaflet default ikonun Vite/webpack uyumsuzluğunu çözer) ──
const brandIcon = L.divIcon({
  className: 'custom-map-marker',
  html: `
    <div style="
      width: 32px; height: 32px;
      background: linear-gradient(135deg, #047857, #10b981);
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

// ── Tema değişince yeniden boyutlandır ──
function MapInvalidator() {
  const map = useMap()
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(timer)
  }, [map])
  return null
}

export default function MapView({
  district,
  neighborhood,
  title,
  height = '240px',
  zoom = 13,
}) {
  if (!district) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 flex items-center justify-center"
           style={{ height }}>
        <p className="text-xs text-slate-500 uppercase tracking-widest">Konum bilgisi yok</p>
      </div>
    )
  }

  const coords = coordsOfDistrict(district)
  const isFallback = !coordsOfDistrict(district) || coords === ISTANBUL_CENTER && district !== 'Eminönü'

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800 relative" style={{ height }}>
      <MapContainer
        center={coords}
        zoom={zoom}
        scrollWheelZoom={false}
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
              {title && <div className="font-bold text-slate-900 mb-0.5">{title}</div>}
              <div className="text-slate-700">{district}{neighborhood ? ` · ${neighborhood}` : ''}</div>
              {isFallback && (
                <div className="text-[10px] text-amber-700 mt-1 italic">
                  Yaklaşık konum (ilçe merkezi)
                </div>
              )}
            </div>
          </Popup>
        </Marker>
        <MapInvalidator />
      </MapContainer>

      {/* Sağ alt köşe — attribution (CartoDB + OSM zorunlu) */}
      <div className="absolute bottom-1 right-1 text-[8px] text-slate-400/70 bg-ink-900/80 px-1.5 py-0.5 rounded backdrop-blur-sm">
        © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer" className="hover:text-white">CARTO</a>
        {' '}·{' '}
        © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-white">OSM</a>
      </div>
    </div>
  )
}
