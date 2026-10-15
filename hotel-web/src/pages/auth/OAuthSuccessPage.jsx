import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { extractErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'

/**
 * #92: Google OAuth login callback page.
 *
 * URL: /oauth-success#code=...  (tek kullanımlık, 60 sn geçerli giriş kodu)
 *
 * Akış:
 *   1. Backend OAuth2SuccessHandler bu URL'e redirect ediyor. Adreste JWT/e-posta YOK;
 *      kod URL fragment'ında (sunucuya, loglara ve Referer'a gitmez).
 *   2. Kod okunur okunmaz history.replaceState ile adresten silinir (geçmişte kalmaz).
 *   3. POST /api/auth/oauth/exchange → erişim token'ı (gövde) + httpOnly refresh çerezi.
 *   4. AuthContext.loginFromOAuth ile persist, role'e göre dashboard'a yönlendir.
 */
export function readAndClearOAuthCode() {
  const hash = window.location.hash || ''
  const code = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash).get('code')
  // Kodu adresten hemen sil (başarılı/başarısız fark etmez)
  window.history.replaceState(window.history.state, '', window.location.pathname)
  return code
}

export default function OAuthSuccessPage() {
  const navigate = useNavigate()
  const { loginFromOAuth } = useAuth()
  const handledRef = useRef(false)  // StrictMode double-mount koruma

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const code = readAndClearOAuthCode()
    if (!code) {
      toast.error('Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.')
      navigate('/login', { replace: true })
      return
    }

    api.post('/api/auth/oauth/exchange', { code })
      .then(({ data }) => {
        loginFromOAuth({ ...data, id: data.userId })
        toast.success(`Hoş geldin${data.fullName ? ', ' + data.fullName.split(' ')[0] : ''}!`)
        const target =
          data.role === 'CANDIDATE'       ? '/candidate' :
          data.role === 'BUSINESS_OWNER'  ? '/business'  :
          data.role === 'ADMIN'           ? '/admin'     : '/'
        navigate(target, { replace: true })
      })
      .catch(err => {
        toast.error(extractErrorMessage(err))
        navigate('/login', { replace: true })
      })
  }, [navigate, loginFromOAuth])

  return (
    <div className="min-h-screen flex items-center justify-center ah-surface"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <div className="text-center">
        <div className="spinner mx-auto" />
        <p className="text-[13px] mt-4" style={{ color: 'var(--ah-ink-3)' }}>Giriş yapılıyor...</p>
      </div>
    </div>
  )
}
