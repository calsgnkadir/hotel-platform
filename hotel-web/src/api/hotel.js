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

/* ── Şifre değiştirme (D3) ── */
export async function changePassword(currentPassword, newPassword) {
  const { data } = await api.put('/api/auth/change-password', { currentPassword, newPassword })
  return data
}

/* ── Candidate profile ── */
export async function getCandidateProfile() {
  const { data } = await api.get('/api/candidate/profile')
  return data
}

export async function updateCandidateProfile(payload) {
  const { data } = await api.put('/api/candidate/profile', payload)
  return data
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
  if (filters.dateFrom)            params.dateFrom  = filters.dateFrom  // YYYY-MM-DD
  if (filters.dateTo)              params.dateTo    = filters.dateTo
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

// D6: Aday başvurusunu iptal eder (sadece PENDING/REVIEWING)
export async function withdrawApplication(applicationId) {
  const { data } = await api.put(`/api/candidate/applications/${applicationId}/withdraw`)
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

export async function markNoShow(applicationId) {
  const { data } = await api.put(`/api/business/applications/${applicationId}/no-show`)
  return data  // { application, candidateStrikesRemaining, autoBanned, bannedUntil }
}

export async function requestDocument(applicationId, documentType) {
  const { data } = await api.post(`/api/business/applications/${applicationId}/document-requests`, { documentType })
  return data
}

export async function getApplicationDocuments(applicationId) {
  const { data } = await api.get(`/api/business/applications/${applicationId}/documents`)
  return data
}

export async function viewDocument(documentId) {
  // Backend Cloudinary signed URL döner (1 saat geçerli)
  const { data } = await api.get(`/api/documents/${documentId}/url`)
  if (data?.url) {
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }
}

/* ── Admin endpoints ── */
export async function adminListUsers(role, search) {
  const params = {}
  if (role)   params.role = role
  if (search) params.search = search
  const { data } = await api.get('/api/admin/users', { params })
  return data
}

export async function adminGetUser(id) {
  const { data } = await api.get(`/api/admin/users/${id}`)
  return data
}

export async function adminSetStudentStatus(id, approved) {
  const { data } = await api.put(`/api/admin/users/${id}/student-status`, { approved })
  return data
}

export async function adminBanUser(id, days) {
  const { data } = await api.put(`/api/admin/users/${id}/ban`, { days })
  return data
}

export async function adminUnbanUser(id) {
  const { data } = await api.put(`/api/admin/users/${id}/unban`)
  return data
}

export async function adminGetStats() {
  const { data } = await api.get('/api/admin/stats')
  return data
}
