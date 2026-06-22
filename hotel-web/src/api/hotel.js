import api from './client'

/* ── Business endpoints (public) ── */
export async function getBusinessList(type) {
  const params = type ? { type } : {}
  const { data } = await api.get('/api/businesses', { params })
  return data
}

// FAZ 5.9 — public profil sayfasi (login gerektirmez)
export async function getPublicBusiness(id) {
  const { data } = await api.get(`/api/businesses/${id}`)
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

/** #86: Galeri sırasını güncelle — body: foto id'lerinin yeni sırası. */
export async function reorderBusinessPhotos(orderedPhotoIds) {
  const { data } = await api.put('/api/business/photos/order', orderedPhotoIds)
  return data  // PhotoDto[] (yeni sırayla)
}

/** #86: Kapak fotoğrafı belirle. */
export async function setBusinessCoverPhoto(photoId) {
  const { data } = await api.put(`/api/business/photos/${photoId}/cover`)
  return data  // PhotoDto
}

/** Public — bir işletmenin galerisi (aday tarafı). */
export async function getBusinessGallery(businessId) {
  const { data } = await api.get(`/api/businesses/${businessId}/photos`)
  return data  // PhotoDto[]
}

/* ── Şifre değiştirme (D3) ── */
export async function changePassword(currentPassword, newPassword) {
  const { data } = await api.put('/api/auth/change-password', { currentPassword, newPassword })
  return data
}

/* ── Candidate profile ── */
// Dalga G — Aday public profili (isletme bakar, aday kendi profili icin getCandidateProfile)
export async function getCandidatePublicProfile(id) {
  const { data } = await api.get(`/api/candidates/${id}/public`)
  return data
}

export async function getCandidateProfile() {
  const { data } = await api.get('/api/candidate/profile')
  return data
}

export async function updateCandidateProfile(payload) {
  const { data } = await api.put('/api/candidate/profile', payload)
  return data
}

// D7: Aday profil fotoğrafı (avatar)
export async function uploadCandidateAvatar(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/api/candidate/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data  // CandidateProfileDto with new avatarUrl
}

export async function deleteCandidateAvatar() {
  await api.delete('/api/candidate/avatar')
}

// Faz B/#11: Adayın kendi güvenilirlik skoru + breakdown
export async function getMyReliability() {
  const { data } = await api.get('/api/candidate/reliability')
  return data  // { score, noShowCount, completedJobsLast90d, averageRating, reviewCount }
}

// Faz B/#10: Aday haftalık müsaitlik blokları (profil bazlı)
export async function getMyAvailabilityBlocks() {
  const { data } = await api.get('/api/candidate/availability-blocks')
  return data  // List<{ id, dayOfWeek, startTime, endTime }>
}

export async function setMyAvailabilityBlocks(blocks) {
  const { data } = await api.put('/api/candidate/availability-blocks', blocks)
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

// Dalga H3 — Profil goruntulenme stats (son N gun)
export async function getMyProfileViews(days = 90) {
  const { data } = await api.get('/api/candidate/profile-views', { params: { days } })
  return data  // { totalViews, uniqueViewers, days }
}

// Dalga H1 — Kaydettiklerim (saved/favori ilanlar)
export async function saveListing(listingId) {
  await api.post(`/api/saved-listings/${listingId}`)
}
export async function unsaveListing(listingId) {
  await api.delete(`/api/saved-listings/${listingId}`)
}
export async function getMySavedListings() {
  const { data } = await api.get('/api/saved-listings/my')
  return data
}

export async function getListing(listingId) {
  const { data } = await api.get(`/api/listings/${listingId}`)
  return data
}

// Dalga 4 — view count tracking (fire-and-forget; hata UI'yi bloklamasin)
export async function trackListingView(listingId) {
  try { await api.post(`/api/listings/${listingId}/view`) } catch { /* sessiz */ }
}

export async function updateListingStatus(listingId, status) {
  const { data } = await api.put(`/api/listings/${listingId}/status`, null, { params: { status } })
  return data
}

/* ── Application endpoints (Candidate) ── */
// #84: Backend artık PageResponse döner. Aday genelde az başvuruya sahip;
// büyük size çekip içeriği array gibi kullanıyoruz (filtre client-side).
export async function getMyApplications(params = {}) {
  const { data } = await api.get('/api/candidate/applications', {
    params: { size: 100, sort: 'createdAt,desc', ...params },
  })
  return data  // PageResponse<ApplicationResponse>
}

export async function applyToListing(payload) {
  // payload: { jobListingId, coverLetter, availabilities: [] }
  // FAZ D.2 — Idempotency-Key: double-click/retry'da duplicate basvuru yaratmiyor.
  // Backend in-memory cache 1 saat boyunca ayni response'u doner.
  const idemKey = genIdempotencyKey()
  const { data } = await api.post('/api/candidate/applications', payload, {
    headers: { 'Idempotency-Key': idemKey },
  })
  return data
}

function genIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'idem-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36)
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

// FAZ 2/#33 — Sertifika cüzdanı: belge önizleme URL'i (Cloudinary)
export async function getDocumentUrl(documentId) {
  const { data } = await api.get(`/api/documents/${documentId}/url`)
  return data.url || data
}

/* ── Application endpoints (Business owner) ── */
// #84: Sayfalı + filtreli. opts: { status, listingId, q, page, size }
// PageResponse döner: { content, page, size, totalElements, totalPages, first, last }
export async function getBusinessApplications(opts = {}) {
  const { status, listingId, q, page = 0, size = 20 } = opts
  const params = { page, size, sort: 'createdAt,desc' }
  if (status)    params.status = status
  if (listingId) params.listingId = listingId
  if (q)         params.q = q
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

// FAZ 2/#28 — Direkt rezervasyon / HOLD
export async function holdApplication(applicationId) {
  const { data } = await api.put(`/api/business/applications/${applicationId}/hold`)
  return data
}

export async function respondToHold(applicationId, accept) {
  const { data } = await api.put(`/api/candidate/applications/${applicationId}/respond-hold?accept=${accept}`)
  return data
}

// FAZ 2/#32 — Talent pool / favoriler
export async function addFavorite(candidateId, note) {
  const { data } = await api.post(`/api/business/favorites/${candidateId}`, { note: note || null })
  return data
}
export async function removeFavorite(candidateId) {
  await api.delete(`/api/business/favorites/${candidateId}`)
}
export async function listFavorites() {
  const { data } = await api.get('/api/business/favorites')
  return data
}
export async function checkFavorite(candidateId) {
  const { data } = await api.get(`/api/business/favorites/${candidateId}/check`)
  return data.favorited
}
export async function getMyFavoritedCount() {
  const { data } = await api.get('/api/candidate/favorited-count')
  return data.count
}

// FAZ 2/#21 — Geo-fenced clock-in/out
export async function clockIn(applicationId, lat, lng) {
  const { data } = await api.post(`/api/candidate/work-sessions/${applicationId}/clock-in`, { lat, lng })
  return data
}
export async function clockOut(applicationId, lat, lng) {
  const { data } = await api.post(`/api/candidate/work-sessions/${applicationId}/clock-out`, { lat, lng })
  return data
}
export async function getActiveSession(applicationId) {
  try {
    const res = await api.get(`/api/candidate/work-sessions/${applicationId}/active`)
    return res.status === 204 ? null : res.data
  } catch { return null }
}

// FAZ 4 hotfix — N+1 / 429 fix: tek call ile birden cok basvurunun aktif mesai durumu
export async function getActiveSessionsBatch(applicationIds) {
  if (!applicationIds || applicationIds.length === 0) return {}
  try {
    const { data } = await api.get('/api/candidate/work-sessions/active-batch', {
      params: { ids: applicationIds.join(',') },
    })
    return data || {}
  } catch { return {} }
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

/* ── Yorum (Review) endpoints ── */
// FAZ 2/#26 — 4 aspect destegi: rating tamam, aspects = { aspect1..4 }
export async function createReview(applicationId, rating, comment, aspects = {}) {
  const { data } = await api.post(`/api/applications/${applicationId}/reviews`,
    { rating, comment, ...aspects })
  return data
}

export async function getBusinessReviews(businessId) {
  const { data } = await api.get(`/api/businesses/${businessId}/reviews`)
  return data
}

export async function getBusinessRating(businessId) {
  const { data } = await api.get(`/api/businesses/${businessId}/rating`)
  return data
}

export async function getCandidateReviews(candidateId) {
  const { data } = await api.get(`/api/candidates/${candidateId}/reviews`)
  return data
}

/* ── Bildirim (Notification) endpoints ── */
export async function getNotifications(limit = 20) {
  const { data } = await api.get('/api/notifications', { params: { limit } })
  return data
}

export async function getUnreadNotificationCount() {
  const { data } = await api.get('/api/notifications/unread-count')
  return data.count
}

export async function markNotificationRead(id) {
  await api.put(`/api/notifications/${id}/read`)
}

export async function markAllNotificationsRead() {
  await api.put('/api/notifications/read-all')
}

/* ── Şikayet (Report) endpoints ── */
export async function createReport(payload) {
  // payload: { targetType, targetId, reason, description }
  const { data } = await api.post('/api/reports', payload)
  return data
}

export async function adminListReports(status) {
  const params = status ? { status } : {}
  const { data } = await api.get('/api/admin/reports', { params })
  return data
}

export async function adminListAuditLogs(action, limit = 100) {
  const params = { limit }
  if (action) params.action = action
  const { data } = await api.get('/api/admin/audit-logs', { params })
  return data
}

export async function adminUpdateReportStatus(id, status, adminNote) {
  const { data } = await api.put(`/api/admin/reports/${id}/status`, { status, adminNote })
  return data
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

// FAZ I.5 — Destek bileti (kullanıcı + admin)
export async function submitSupport(subject, message) {
  const { data } = await api.post('/api/me/support', { subject, message })
  return data
}
export async function listMySupport() {
  const { data } = await api.get('/api/me/support')
  return data
}
export async function adminListSupport(status, limit = 100) {
  const params = { limit }
  if (status) params.status = status
  const { data } = await api.get('/api/admin/support', { params })
  return data
}
export async function adminUpdateSupportStatus(id, status, adminNote) {
  const { data } = await api.put(`/api/admin/support/${id}/status`,
    { status, adminNote: adminNote || null })
  return data
}

// FAZ G.3 — İşletme doğrulama (KYC rozet)
export async function adminListBusinesses(verified, search) {
  const params = {}
  if (verified !== undefined && verified !== null) params.verified = verified
  if (search) params.search = search
  const { data } = await api.get('/api/admin/businesses', { params })
  return data
}

export async function adminSetBusinessVerified(id, verified) {
  const { data } = await api.put(`/api/admin/businesses/${id}/verify`, null, { params: { verified } })
  return data
}

// FAZ D.5 — Outbox DLQ
export async function adminListOutbox(filter = 'all', limit = 50) {
  const { data } = await api.get('/api/admin/outbox', { params: { filter, limit } })
  return data
}

export async function adminRetryOutbox(id) {
  await api.post(`/api/admin/outbox/${id}/retry`)
}

export async function adminGetStats() {
  const { data } = await api.get('/api/admin/stats')
  return data
}

// FAZ 6.3 — Listing moderation
export async function adminListListings(status, search) {
  const params = {}
  if (status) params.status = status
  if (search) params.search = search
  const { data } = await api.get('/api/admin/listings', { params })
  return data
}

export async function adminSetListingStatus(id, status) {
  const { data } = await api.put(`/api/admin/listings/${id}/status`, { status })
  return data
}

/* ── Messaging (#76) ── */

/** Sohbetlerim — PageResponse<ConversationDto> döner. */
export async function getMyConversations({ page = 0, size = 20 } = {}) {
  const { data } = await api.get('/api/messages/conversations', {
    params: { page, size },
  })
  return data
}

/** Yeni sohbet başlat veya mevcudu döndür. otherPartyId zorunlu. */
export async function startConversation({ otherPartyId, applicationId = null }) {
  const { data } = await api.post('/api/messages/conversations', {
    otherPartyId, applicationId,
  })
  return data  // ConversationDto
}

/** Sohbet mesajları — en yeniden eskiye sayfalı. */
export async function getConversationMessages(conversationId, { page = 0, size = 50 } = {}) {
  const { data } = await api.get(`/api/messages/conversations/${conversationId}/messages`, {
    params: { page, size },
  })
  return data  // PageResponse<MessageDto>
}

/** Mesaj gönder. */
export async function sendMessage(conversationId, content) {
  const { data } = await api.post(
    `/api/messages/conversations/${conversationId}/messages`,
    { content }
  )
  return data  // MessageDto
}

/** Chat refactor v2: dosya/foto ekli mesaj gönder (multipart). */
export async function sendMessageAttachment(conversationId, file, caption = '') {
  const form = new FormData()
  form.append('file', file)
  if (caption) form.append('caption', caption)
  const { data } = await api.post(
    `/api/messages/conversations/${conversationId}/attachment`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data  // MessageDto with attachmentUrl/type/name/size
}

/** Sohbete giriş — okundu işaretle. */
export async function markConversationRead(conversationId) {
  const { data } = await api.put(`/api/messages/conversations/${conversationId}/read`)
  return data  // { updated: N }
}

/** Toplam okunmamış mesaj sayısı (badge için). */
export async function getMessagesUnreadCount() {
  const { data } = await api.get('/api/messages/unread-count')
  return data?.unread ?? 0
}

/* ── Dashboard stats (#88) ── */

export async function getBusinessStats() {
  const { data } = await api.get('/api/business/stats')
  return data
}

export async function getCandidateStats() {
  const { data } = await api.get('/api/candidate/stats')
  return data
}

// ── #80: Şifre sıfırlama ──

/** Email'e sıfırlama linki gönderir. Bilinmeyen email olsa bile 200 döner (güvenlik). */
export async function requestPasswordReset(email) {
  const { data } = await api.post('/api/auth/password-reset/request', { email })
  return data
}

/** Token'ı doğrular — UI'da reset formunu açmadan önce. */
export async function validatePasswordResetToken(token) {
  const { data } = await api.get('/api/auth/password-reset/validate', { params: { token } })
  return data
}

/** Yeni şifreyi kaydeder, token'ı tüketir. */
export async function confirmPasswordReset(token, newPassword) {
  const { data } = await api.post('/api/auth/password-reset/confirm', { token, newPassword })
  return data
}
