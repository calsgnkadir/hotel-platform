import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const DISMISS_KEY = 'kadrom.email-verify-banner.dismissed'

/**
 * FAZ 4.4 — Email doğrulanmamış kullanıcılar için banner.
 * Tek satır (mobilde ilk ekranı doldurmasın); bu oturum için kapatılabilir.
 * Email zaten doğrulanmışsa null döner.
 */
export default function EmailVerifyBanner() {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  if (!user || user.emailVerified || dismissed) return null

  async function resend() {
    setSending(true)
    try {
      await api.post('/api/auth/resend-verification')
      setSent(true)
      toast.success('Doğrulama maili tekrar gönderildi.')
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Gönderilemedi, tekrar dene.')
    } finally {
      setSending(false)
    }
  }

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* yok say */ }
    setDismissed(true)
  }

  return (
    <div role="status" className="mx-4 lg:mx-8 mt-3 px-3 py-2 rounded-lg border flex items-center gap-2 text-[12.5px]"
         style={{ background: 'var(--ah-warn-soft)', borderColor: 'var(--ah-warn)', color: 'var(--ah-ink-2)' }}>
      <span className="min-w-0 flex-1 truncate">
        <b style={{ color: 'var(--ah-ink)' }}>E-postanı doğrula</b>
        <span className="hidden sm:inline"> — {user.email} adresine gönderilen linke tıkla.</span>
      </span>
      <button
        onClick={resend}
        disabled={sending || sent}
        className="flex-shrink-0 font-semibold underline disabled:opacity-50 disabled:no-underline"
        style={{ color: 'var(--ah-ink)' }}>
        {sent ? 'Gönderildi' : sending ? 'Gönderiliyor...' : 'Tekrar gönder'}
      </button>
      <button onClick={dismiss} aria-label="Uyarıyı kapat"
        className="flex-shrink-0 w-6 h-6 grid place-items-center rounded"
        style={{ color: 'var(--ah-ink-3)' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18" /><path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  )
}
