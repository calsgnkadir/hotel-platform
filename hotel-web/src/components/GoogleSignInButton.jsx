/**
 * #92: "Google ile devam et" düğmesi.
 *
 * Backend OAuth2 endpoint'ine yönlendirir:
 *   GET {VITE_API_URL}/oauth2/authorization/google
 *
 * Spring Security OAuth2 Client otomatik olarak Google'a redirect eder,
 * sonra /login/oauth2/code/google'a döner, OAuth2SuccessHandler frontend'in
 * /oauth-success sayfasına yönlendirir.
 */

// Boş VITE_API_URL: geliştirmede backend portu, derlenmiş sürümde aynı köken.
// Canlıya localhost gömülmez (vite.config.js canlı derlemede bunu da engeller).
export const API_BASE = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8080' : '')).replace(/\/$/, '')
export const GOOGLE_AUTH_URL = `${API_BASE}/oauth2/authorization/google`

/**
 * Props:
 *   label             düğme metni
 *   disabled          true → pasif (ör. Kullanım Şartları işaretlenmeden); bağlantı yok
 *   disabledHint      pasifken title + ekran okuyucu açıklaması
 *   onBeforeRedirect  Google'a gitmeden hemen önce (onay / dönüş yolunu sakla)
 */
export default function GoogleSignInButton({
  label = 'Google ile devam et', disabled = false, disabledHint, onBeforeRedirect,
}) {
  const cls = `w-full inline-flex items-center justify-center gap-2.5 min-h-[44px] py-3 px-6 rounded-full
               bg-white text-ink-900 border border-cream-300 shadow-sm
               font-semibold text-[13px] transition-all
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ink-900`
  if (disabled) {
    return (
      <button type="button" disabled title={disabledHint}
        className={`${cls} opacity-50 cursor-not-allowed`}>
        <GoogleLogo />
        {label}
        {disabledHint && <span className="sr-only"> ({disabledHint})</span>}
      </button>
    )
  }
  return (
    <a
      href={GOOGLE_AUTH_URL}
      onClick={() => onBeforeRedirect?.()}
      className={`${cls} hover:bg-cream-100 active:scale-[0.98]`}>
      <GoogleLogo />
      {label}
    </a>
  )
}

// Google'ın resmi logo renkleri (marka yönergesi gereği sabit)
function GoogleLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}
