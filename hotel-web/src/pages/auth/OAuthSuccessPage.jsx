import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

/**
 * #92: Google OAuth login callback page.
 *
 * URL: /oauth-success?token=...&id=...&email=...&fullName=...&role=...
 *
 * Akış:
 *   1. Backend OAuth2SuccessHandler bu URL'e redirect ediyor
 *   2. Query param'lardan token + user info çıkar
 *   3. AuthContext.loginFromOAuth ile persist
 *   4. Role'e göre dashboard'a yönlendir
 */
export default function OAuthSuccessPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { loginFromOAuth } = useAuth()
  const handledRef = useRef(false)  // StrictMode double-mount koruma

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const token    = params.get('token')
    const id       = params.get('id')
    const email    = params.get('email')
    const fullName = params.get('fullName')
    const role     = params.get('role')

    if (!token || !role) {
      toast.error('OAuth callback eksik parametre — tekrar dene.')
      navigate('/login', { replace: true })
      return
    }

    loginFromOAuth({
      token,
      id: id ? Number(id) : null,
      email,
      fullName,
      role,
    })

    toast.success(`Hoş geldin${fullName ? ', ' + fullName.split(' ')[0] : ''}!`)

    const target =
      role === 'CANDIDATE'       ? '/candidate' :
      role === 'BUSINESS_OWNER'  ? '/business'  :
      role === 'ADMIN'           ? '/admin'     : '/'

    navigate(target, { replace: true })
  }, [params, navigate, loginFromOAuth])

  return (
    <div className="min-h-screen bg-ink-900 flex items-center justify-center text-slate-300">
      <div className="text-center">
        <div className="spinner mx-auto" />
        <p className="text-[13px] mt-4">Giriş yapılıyor...</p>
      </div>
    </div>
  )
}
