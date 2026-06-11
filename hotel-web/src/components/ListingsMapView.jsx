/**
 * FAZ 1/#30 — Çoklu marker harita (ilan listesi için split-screen).
 *
 * Props:
 *   listings:        ListingResponse[] (businessLatitude/Longitude + businessDistrict)
 *   highlightedId:   şu an vurgulanan ilan id (liste hover'ı)
 *   onMarkerClick:   (listing) => void
 *
 * Davranış:
 *   - lat/lng olan ilanlar → tam konum marker
 *   - olmayanlar → ilçe merkezi (cluster engellemek için küçük offset)
 *   - highlightedId varsa o marker büyür + popup
 *   - Otomatik fit-bounds (tüm marker'ları görecek şekilde zoom)
 */
import { useMemo, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { coordsOfDistrict, ISTANBUL_CENTER } from '../data/istanbul'
import { formatSalary } from '../lib/salary'  // FAZ 2/#25

function makeIcon(size = 32, hot = false) {
  const grad = hot
    ? 'linear-gradient(135deg, #d946ef, #a855f7)'
    : 'linear-gradient(135deg, #6b21a8, #7e22ce)'
  const shadow = hot ? '0 4px 16px rgba(217, 70, 239, 0.7)' : '0 4px 12px rgba(107, 33, 168, 0.5)'
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        width: ${size}px; height: ${size}px;
        background: ${grad};
        border: 2px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: ${shadow};
        display: flex; align-items: center; justify-content: center;
      ">
        <div style="
          width: ${Math.floor(size * 0.3)}px; height: ${Math.floor(size * 0.3)}px;
          background: white; border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize:     [size, size],
    iconAnchor:   [size / 2, size],
    popupAnchor:  [0, -size],
  })
}

const normalIcon = makeIcon(32, false)
const hotIcon    = makeIcon(40, true)

// FIX: NaN guard — Leaflet flyTo'ya NaN koordinat verilince crash.
function isValidLatLng(p) {
  return Array.isArray(p) && p.length === 2
    && typeof p[0] === 'number' && typeof p[1] === 'number'
    && !isNaN(p[0]) && !isNaN(p[1])
    && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180
}

function FitToBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length || !map) return
    try {
      const validCoords = points.map(p => p.coords).filter(isValidLatLng)
      if (validCoords.length === 0) return
      const bounds = L.latLngBounds(validCoords)
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      }
      setTimeout(() => {
        try { map.invalidateSize() } catch {}
      }, 100)
    } catch (e) {
      console.warn('[Map] FitToBounds failed:', e?.message)
    }
  }, [points, map])
  return null
}

// FlyTo kaldırıldı — Leaflet iç requestAnimationFrame'lerde NaN üretiyor,
// try/catch ile durdurulamıyor (sonsuz frame loop). Highlight sadece
// marker icon değişikliği ile gösteriliyor (hot vs normal).
function FlyTo() {
  return null
}

function _legacyFormatSalary(min, max) {
  if (!min && !max) return null
  const fmt = (n) => Number(n).toLocaleString('tr-TR')
  if (min && max) return `${fmt(min)} – ${fmt(max)} ₺`
  return `${fmt(min || max)} ₺`
}

export default function ListingsMapView({ listings = [], highlightedId, onMarkerClick }) {
  // Her ilanı bir noktaya çevir (lat/lng yoksa ilçe merkezi).
  // NaN/invalid koordinatlı ilanlar atlanır (haritaya konmaz).
  const points = useMemo(() => {
    return listings.map(l => {
      const lat = Number(l.businessLatitude)
      const lng = Number(l.businessLongitude)
      let coords
      if (!isNaN(lat) && !isNaN(lng) && l.businessLatitude != null && l.businessLongitude != null) {
        coords = [lat, lng]
      } else if (l.businessDistrict) {
        const c = coordsOfDistrict(l.businessDistrict)
        coords = c ? [c[0] + (Math.random() - 0.5) * 0.005,
                      c[1] + (Math.random() - 0.5) * 0.005]
                   : ISTANBUL_CENTER
      } else {
        coords = ISTANBUL_CENTER
      }
      return { listing: l, coords, approx: l.businessLatitude == null }
    }).filter(p => isValidLatLng(p.coords))  // NaN/invalid'ları at
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings.length])

  const highlightedPoint = points.find(p => p.listing.id === highlightedId)

  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border flex items-center justify-center h-full"
           style={{ background: 'rgba(168,85,247,0.08)', borderColor: 'rgba(168,85,247,0.30)' }}>
        <p className="text-sm" style={{ color: '#6b21a8' }}>İlan yok — haritada gösterilecek yer yok</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden relative h-full" style={{ border: '1px solid rgba(168,85,247,0.30)' }}>
      <MapContainer
        center={ISTANBUL_CENTER}
        zoom={11}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', background: '#0a0f1c' }}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={19}
        />
        {points.map(p => {
          const isHot = p.listing.id === highlightedId
          return (
            <Marker
              key={p.listing.id}
              position={p.coords}
              icon={isHot ? hotIcon : normalIcon}
              eventHandlers={{
                click: () => onMarkerClick?.(p.listing),
              }}>
              <Popup>
                <div className="text-[12px]" style={{ minWidth: 180 }}>
                  <div className="font-bold mb-0.5" style={{ color: '#3b0764' }}>{p.listing.title}</div>
                  <div className="text-ink-700 mb-1">{p.listing.businessName}</div>
                  <div className="text-ink-500 text-[10px] mb-1">
                    {p.listing.businessDistrict || 'İstanbul'}
                    {p.approx && <span className="italic"> (yaklaşık)</span>}
                  </div>
                  {formatSalary(p.listing.salaryMin, p.listing.salaryMax, p.listing.salaryType, p.listing.tipsIncluded) && (
                    <div className="font-semibold" style={{ color: '#7e22ce' }}>
                      {formatSalary(p.listing.salaryMin, p.listing.salaryMax, p.listing.salaryType, p.listing.tipsIncluded)}
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onMarkerClick?.(p.listing) }}
                    className="mt-1.5 text-[11px] font-semibold underline"
                    style={{ color: '#a855f7' }}>
                    Detayları gör →
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}
        <FitToBounds points={points} />
        {/* FlyTo kaldırıldı (Leaflet NaN crash) - sadece marker icon hot/normal */}
      </MapContainer>

      {/* Toplam ilan etiketi */}
      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md"
           style={{ background: 'rgba(255,255,255,0.85)', color: '#3b0764' }}>
        {listings.length} ilan haritada
      </div>

      {/* Attribution */}
      <div className="absolute bottom-1 right-1 text-[8px] text-ink-400/70 bg-cream-100/80 px-1.5 py-0.5 rounded backdrop-blur-sm">
        © <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a> · © <a href="https://openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>
      </div>
    </div>
  )
}
