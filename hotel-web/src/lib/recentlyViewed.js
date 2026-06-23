/**
 * Dalga I2 — Incelediklerim (localStorage tabanli)
 *
 * Kariyer.net 'Inceledigim Ilanlar' esdegeri. Aday son acigi 20 ilani
 * cihazinda saklar. Backend opsiyonel (kullanici giris yapmadiginda da
 * calismasi icin).
 *
 * Schema: { id, title, businessName, district, position, salary, viewedAt }
 */
const KEY = 'ajanshotel.recently-viewed-listings'
const MAX_ITEMS = 20

export function getRecent() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function recordView(listing) {
  if (!listing?.id) return
  try {
    const list = getRecent()
    // Ayni ilan varsa kaldir (en uste tekrar gelecek)
    const filtered = list.filter(it => it.id !== listing.id)
    const entry = {
      id: listing.id,
      title: listing.title,
      businessName: listing.businessName,
      district: listing.businessDistrict,
      position: listing.position,
      salaryMin: listing.salaryMin,
      salaryMax: listing.salaryMax,
      salaryType: listing.salaryType,
      tipsIncluded: listing.tipsIncluded,
      jobType: listing.jobType,
      viewedAt: Date.now(),
    }
    const next = [entry, ...filtered].slice(0, MAX_ITEMS)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch { /* quota exceeded vs. sessiz */ }
}

export function removeFromRecent(listingId) {
  try {
    const list = getRecent().filter(it => it.id !== listingId)
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
}

export function clearRecent() {
  try { localStorage.removeItem(KEY) } catch {}
}
