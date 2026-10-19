import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { extractErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import TermsConsent from '../../components/TermsConsent'
import { GOOGLE_AUTH_URL } from '../../components/GoogleSignInButton'
import { rememberOAuthConsent, takeOAuthConsent } from '../../lib/legal'
import { homeForRole, rememberReturn, takeReturn } from '../../lib/authReturn'

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
 *      Kayıt ekranında Kullanım Şartları işaretlendiyse onay alanları
 *      (termsAccepted + privacyNoticeVersion) bu isteğe eklenir, sonra sekmeden silinir.
 *   4. AuthContext.loginFromOAuth ile persist; geldiği sayfaya (varsa) ya da role'e göre
 *      panele yönlendir.
 *   5. Yeni Google kullanıcısı onaysız gelirse backend 422 CONSENT_REQUIRED döner:
 *      onay ekranı gösterilir. Kod tek kullanımlık olduğundan (sunucuda harcanır)
 *      onaydan sonra Google adımı yeniden yapılır; onay bu kez sekmede hazırdır.
 */
/** Google'a tam sayfa yönlendirme (testte izlenebilsin diye nesne üzerinden). */
export const oauthNav = {
  toGoogle() { window.location.assign(GOOGLE_AUTH_URL) },
}

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
  const [needsConsent, setNeedsConsent] = useState(false)
  const returnRef = useRef(null)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    const code = readAndClearOAuthCode()
    const consent = takeOAuthConsent()          // okundu + silindi
    returnRef.current = takeReturn()?.path || null
    if (!code) {
      toast.error('Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.')
      navigate('/login', { replace: true })
      return
    }

    api.post('/api/auth/oauth/exchange', consent ? { code, ...consent } : { code })
      .then(({ data }) => {
        loginFromOAuth({ ...data, id: data.userId })
        toast.success(`Hoş geldin${data.fullName ? ', ' + data.fullName.split(' ')[0] : ''}.`)
        navigate(returnRef.current || homeForRole(data.role), { replace: true })
      })
      .catch(err => {
        if (err?.response?.data?.code === 'CONSENT_REQUIRED') {
          setNeedsConsent(true)
          return
        }
        toast.error(extractErrorMessage(err))
        navigate('/login', { replace: true })
      })
  }, [navigate, loginFromOAuth])

  if (needsConsent) {
    return <ConsentStep returnPath={returnRef.current} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center ah-surface"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <div className="text-center" role="status">
        <div className="spinner mx-auto" aria-hidden="true" />
        <p className="type-meta mt-4">Giriş yapılıyor...</p>
      </div>
    </div>
  )
}

/**
 * Google ile ilk kez gelen kullanıcı Kullanım Şartları'nı onaylamadıysa.
 * Onay sekmeye yazılır, Google adımı tekrarlanır (kod tek kullanımlıktı).
 */
function ConsentStep({ returnPath }) {
  const [accepted, setAccepted] = useState(false)
  const [error, setError] = useState('')

  function continueWithGoogle() {
    if (!accepted) {
      setError('Devam etmek için Kullanım Şartları\'nı kabul etmelisin.')
      return
    }
    rememberOAuthConsent()
    rememberReturn(returnPath)
    oauthNav.toGoogle()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 ah-surface"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="font-bold text-base" style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>
            Kadrom
          </Link>
        </div>
        <section className="card space-y-5" aria-labelledby="oauth-consent-title">
          <div>
            <h1 id="oauth-consent-title" className="type-section" style={{ color: 'var(--ah-ink)' }}>
              Hesabını oluşturmadan önce
            </h1>
            <p className="type-body mt-1.5" style={{ color: 'var(--ah-ink-2)' }}>
              Google hesabınla Kadrom'a ilk kez geliyorsun. Aday hesabın açılmadan önce
              Kullanım Şartları'nı kabul etmen gerekiyor.
            </p>
          </div>
          <TermsConsent id="oauth-terms" checked={accepted}
            onChange={(v) => { setAccepted(v); if (v) setError('') }} error={error} />
          <div className="space-y-2">
            <button type="button" onClick={continueWithGoogle} className="btn-primary">
              Kabul et ve Google ile devam et
            </button>
            <p className="type-caption text-center">
              Güvenlik için Google'a kısa bir yönlendirme daha yapılır.
            </p>
          </div>
          <div className="pt-4 flex items-center justify-center gap-2 type-meta" style={{ borderTop: '1px solid var(--ah-line)' }}>
            <Link to="/register" className="font-semibold hover:underline" style={{ color: 'var(--ah-ink)' }}>
              E-postayla kayıt ol
            </Link>
            <span aria-hidden="true" style={{ color: 'var(--ah-ink-4)' }}>·</span>
            <Link to="/" className="font-semibold hover:underline" style={{ color: 'var(--ah-ink-2)' }}>
              Vazgeç
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
