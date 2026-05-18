import api from './client'

/* ── Business endpoints (public) ── */
export async function getBusinessList(type) {
  const params = type ? { type } : {}
  const { data } = await api.get('/api/businesses', { params })
  return data
}

/* ── Business owner profile ── */
export async function getBusinessProfile() {
  const { data } = await api.get('/api/business/profile')
  return data
}

export async function updateBusinessProfile(payload) {
  const { data } = await api.put('/api/business/profile', payload)
  return data
}

/* ── Business photos (logo + gallery) ── */
export async function uploadBusinessLogo(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/business/logo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data  // BusinessDto with new logoUrl
}

export async function deleteBusinessLogo() {
  await api.delete('/api/business/logo')
}

export async function getMyBusinessPhotos() {
  const { data } = await api.get('/api/business/photos')
  return data  // PhotoDto[]
}

export async function uploadBusinessPhoto(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/business/photos', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data  // single PhotoDto
}

export async function deleteBusinessPhoto(photoId) {
  await api.delete(`/api/business/photos/${photoId}`)
}

/* ── Job listing endpoints (public browse) ── */
/**
 * Aktif ilanları listele — tüm filtreler opsiyonel.
 * @param {object} filters
 * @param {string} [filters.position]    - Position enum (örn: 'WAITER')
 * @param {string} [filters.jobType]     - JobType enum
 * @param {string[]} [filters.shifts]    - Shift enum array (['MORNING','EVENING'])
 * @param {string} [filters.district]    - İlçe adı (örn: 'Beyoğlu')
 * @param {number|string} [filters.minSalary]
 * @param {string} [filters.keyword]     - Başlıkta arama
 */
export async function getListings(filters = {}) {
  const params = {}
  if (filters.position)            params.position  = filters.position
  if (filters.jobType)             params.jobType   = filters.jobType
  if (filters.shifts?.length)      params.shifts    = filters.shifts.join(',')
  if (filters.district)            params.district  = filters.district
  if (filters.minSalary)           params.minSalary = filters.minSalary
  if (filters.keyword?.trim())     params.keyword   = filters.keyword.trim()
  const { data } = await api.get('/api/listings', { params })
  return data
}

export async function getMyListings() {
  const { data } = await api.get('/api/listings/my')
  return data
}

export async function createListing(payload) {
  const { data } = await api.post('/api/listings', payload)
  return data
}

export async function updateListing(listingId, payload) {
  const { data } = await api.put(`/api/listings/${listingId}`, payload)
  return data
}

export async function getListing(listingId) {
  const { data } = await api.get(`/api/listings/${listingId}`)
  return data
}

export async function updateListingStatus(listingId, status) {
  const { data } = await api.put(`/api/listings/${listingId}/status`, null, { params: { status } })
  return data
}

/* ── Application endpoints (Candidate) ── */
export async function getMyApplications() {
  const { data } = await api.get('/api/candidate/applications')
  return data
}

export async function applyToListing(payload) {
  // payload: { jobListingId, coverLetter, availabilities: [] }
  const { data } = await api.post('/api/candidate/applications', payload)
  return data
}

export async function respondDocumentRequest(requestId, grant) {
  const { data } = await api.put(`/api/candidate/document-requests/${requestId}/respond`, null, { params: { grant } })
  return data
}

/* ── Document endpoints (Candidate) ── */
export async function getMyDocuments() {
  const { data } = await api.get('/api/documents/my')
  return data
}

export async function uploadDocument(file, type) {
  const form = new FormData()
  form.append('file', file)
  form.append('type', type)
  const { data } = await api.post('/api/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function deleteDocument(documentId) {
  await api.delete(`/api/documents/${documentId}`)
}

/* ── Application endpoints (Business owner) ── */
export async function getBusinessApplications(status) {
  const params = status ? { status } : {}
  const { data } = await api.get('/api/business/applications', { params })
  return data
}

export async function startReview(applicationId) {
  const { data } = await api.put(`/api/business/applications/${applicationId}/review`)
  return data
}

export async function reviewApplication(applicationId, decision, note) {
  const { data } = await api.put(`/api/business/applications/${applicationId}/decide`, { decision, note })
  return data
}

export async function requestDocument(applicationId, documentType) {
  const { data } = await api.post(`/api/business/applications/${applicationId}/document-requests`, { documentType })
  return data
}
