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
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
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
        {sent ? 'Gönderildi' : sending ? 'Gönderiliyor...' : 'Tekrar Gönder'}
      </button>
    </div>
  )
}
