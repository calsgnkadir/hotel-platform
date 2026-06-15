import { useState } from 'react'
import api from '../api/client'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

/**
 * FAZ 4.4 — Email doğrulanmamış kullanıcılar için banner.
 * Dashboard'ın en üstünde görünür. Email zaten doğrulanmışsa null döner.
 */
export default function EmailVerifyBanner() {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  if (!user || user.emailVerified) return null

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

  return (
    <div className="mx-4 mt-4 px-4 py-3 rounded-xl border flex items-center gap-3 flex-wrap"
         style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#78350f' }}>
      <span className="text-lg">⚠</span>
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-semibold">Email adresini doğrula</p>
        <p className="text-xs mt-0.5">
          {user.email} adresine gönderilen doğrulama linkine tıkla.
          Hesabın aktif ama doğrulanana kadar bazı işlemler kısıtlı olabilir.
        </p>
      </div>
      <button
        onClick={resend}
        disabled={sending || sent}
        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50"
        style={{ background: '#fff', borderColor: '#fcd34d', color: '#78350f' }}>
        {sent ? '✓ Gönderildi' : sending ? 'Gönderiliyor...' : 'Tekrar Gönder'}
      </button>
    </div>
  )
}
