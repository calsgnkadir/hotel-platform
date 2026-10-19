import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api, { EMAIL_NOT_VERIFIED_EVENT, extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ConfirmDialog } from './ui/ConfirmDialog'

/**
 * E-posta doğrulaması gereken işlemde (ilan açma/yayınlama, başvuru, sohbet
 * başlatma) backend 403 EMAIL_NOT_VERIFIED döner; api/client.js bunu
 * 'kadrom:email-not-verified' olayına çevirir, bu pencere açılır.
 *
 * Panel üstündeki "E-postanı doğrula" bandıyla aynı dil ve aynı uç
 * (POST /api/auth/resend-verification). Kural backend'de; burası yalnız
 * kullanıcıya ne yapacağını söyler. AuthProvider içinde tek kez bağlanır.
 */
export default function EmailVerifyDialog() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    function onNotVerified() { setOpen(true) }
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, onNotVerified)
    return () => window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, onNotVerified)
  }, [])

  // Çağıran ekran aynı hatayı ayrıca toast'la gösterir (toast.error(extractErrorMessage)).
  // Pencere açıkken o tekrar eden bildirimi kaldır: tek, anlaşılır akış kalsın.
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => toast.dismiss(), 0)
    return () => clearTimeout(t)
  }, [open])

  async function resend() {
    setSending(true)
    try {
      await api.post('/api/auth/resend-verification')
      toast.success(user?.email
        ? `Doğrulama e-postası ${user.email} adresine gönderildi.`
        : 'Doğrulama e-postası gönderildi.')
      setOpen(false)
    } catch (e) {
      toast.error(extractErrorMessage(e) || 'Gönderilemedi, tekrar dene.')
    } finally {
      setSending(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      title="E-postanı doğrula"
      description={
        <>
          Bu işlem için e-posta adresini doğrulaman gerekiyor.
          {user?.email
            ? <> <b style={{ color: 'var(--ah-ink)' }}>{user.email}</b> adresine gönderdiğimiz bağlantıya tıkla; gelmediyse gereksiz klasörüne de bak.</>
            : <> Kayıtlı adresine gönderdiğimiz bağlantıya tıkla.</>}
        </>
      }
      confirmLabel="Doğrulama e-postasını tekrar gönder"
      cancelLabel="Kapat"
      loading={sending}
      onConfirm={resend}
    />
  )
}
