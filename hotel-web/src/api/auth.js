import api from './client'

/**
 * Backend endpoint'leri ile 1:1 eşleşen servisler.
 * Her fonksiyon response.data döner.
 */

export async function login(email, password) {
  const { data } = await api.post('/api/auth/login', { email, password })
  return data  // { token, userId, email, fullName, role }
}

export async function register(payload) {
  /*
   * payload:
   * {
   *   fullName, email, password, role: 'CANDIDATE' | 'BUSINESS_OWNER',
   *   phone?,
   *   // BUSINESS_OWNER ek alanlar:
   *   businessName?, businessType?, district?, address?,
   *   businessPhone?, website?, description?
   * }
   */
  const { data } = await api.post('/api/auth/register', payload)
  return data
}
