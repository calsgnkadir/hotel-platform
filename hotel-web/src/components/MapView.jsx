import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { coordsOfDistrict, ISTANBUL_CENTER } from '../data/istanbul'
import { searchGeo } from '../api/hotel'

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
 * Döşeme: CARTO Voyager (açık tema; sokak adları ve parklar okunur, anahtar yok).
 *   CSP img-src: https://*.basemaps.cartocdn.com (vercel.json) — aynı alan.
 * Atıf: "© OpenStreetMap katkıcıları, © CARTO" her zaman görünür (lisans şartı).
 * Adres arama: backend üzerinden (GET /api/geo/search) — tarayıcı Nominatim'e
 *   doğrudan gitmez; yalnız "Ara" eyleminde çağrılır (otomatik tamamlama YOK,
 *   OSM kullanım politikası).
 */

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

// ── Custom marker (Vite/webpack uyumsuzluğu için divIcon) ──
const brandIcon = L.divIcon({
  className: 'custom-map-marker',
  html: `
    <div style="
      width: 32px; height: 32px;
      background: var(--ah-brand);
      border: 2px solid var(--ah-card);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 12px rgba(107, 117, 116, 0.5);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="
        width: 10px; height: 10px;
        background: var(--ah-card);
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
      <div className="rounded-xl flex items-center justify-center"
           style={{ height, background: 'var(--ah-band)', border: '1px solid var(--ah-line)' }}>
        <p className="type-meta">Konum bilgisi yok</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden relative" style={{ height, border: '1px solid var(--ah-line)' }}>
      <MapContainer
        center={coords}
        zoom={effectiveZoom}
        scrollWheelZoom={editable}
        style={{ height: '100%', width: '100%', background: 'var(--ah-band)' }}
        attributionControl={false}
      >
        <TileLayer
          url={TILE_URL}
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        <Marker position={coords} icon={brandIcon}>
          <Popup>
            <div className="type-caption" style={{ color: 'var(--ah-ink-2)' }}>
              {title && <div className="font-semibold mb-0.5" style={{ color: 'var(--ah-ink)' }}>{title}</div>}
              <div>
                {district}{neighborhood ? ` · ${neighborhood}` : ''}
              </div>
              {isApprox && (
                <div className="mt-1" style={{ color: 'var(--ah-warn)' }}>
                  Yaklaşık konum — işletme henüz tam konum girmemiş
                </div>
              )}
              {hasExact && (
                <div className="mt-1 tabular-nums">
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
        <div className="absolute top-2 left-2 right-2 z-[500] type-caption font-semibold px-3 py-1.5 rounded-full text-center pointer-events-none"
             style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line)', color: 'var(--ah-ink)', boxShadow: 'var(--elev-1)' }}>
          Konumu seçmek için haritaya tıkla
        </div>
      )}

      {/* Sağ alt köşe — atıf (OpenStreetMap ODbL + CARTO lisansı gereği her zaman görünür) */}
      <div data-testid="map-attribution"
           className="absolute bottom-0 right-0 z-[500] text-[11px] leading-4 px-1.5 py-0.5 rounded-tl"
           style={{ background: 'var(--ah-card)', color: 'var(--ah-ink-2)', opacity: 0.92 }}>
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">OpenStreetMap katkıcıları</a>
        , © <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">CARTO</a>
      </div>
    </div>
  )
}

/** Backend'in kabul ettiği en kısa sorgu (GET /api/geo/search). */
export const GEOCODE_MIN_CHARS = 3

/**
 * Adres → koordinat (ilk sonuç). Backend vekili GET /api/geo/search?q=...
 * (girişli) [{ lat, lon, displayName }] döner; OSM politikası (önbellek, hız
 * sınırı, kimlik) orada uygulanır. YALNIZ kullanıcı "Ara"ya bastığında /
 * Enter'da çağır — yazarken çağırma.
 *
 * @returns Promise<[lat, lng] | null>  (bulunamadı → null; ağ/sunucu hatası → throw)
 */
export async function geocodeAddress(query) {
  const q = (query || '').trim()
  if (q.length < GEOCODE_MIN_CHARS) return null
  const results = await searchGeo(q)
  const first = Array.isArray(results) ? results[0] : null
  if (!first) return null
  const lat = Number(first.lat)
  const lon = Number(first.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null
}

