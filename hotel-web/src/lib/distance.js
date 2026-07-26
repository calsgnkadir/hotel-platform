/**
 * FAZ B.3 — Haversine mesafe (km).
 * Client-side; sunucuya konum gonderilmez.
 */
export function distanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const R = 6371 // km
  const toRad = (d) => (Number(d) * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function formatDistance(km) {
  if (km == null || Number.isNaN(km)) return null
  if (km < 1)   return `${Math.round(km * 1000)} m`
  if (km < 10)  return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}
