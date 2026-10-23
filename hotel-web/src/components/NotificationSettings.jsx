import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import {
  isPushSupported, getPermission, requestPermission, subscribeUser, unsubscribeUser,
  isSubscribed, isPushOptedOut,
} from '../lib/webpush'

/**
 * Profil > Bildirimler: anlık bildirimi açma/kapatma.
 * Tarayıcı izni reddedilmişse uygulama tekrar soramaz; kullanıcıya nasıl
 * açacağı anlatılır.
 */
export default function NotificationSettings() {
  const { t } = useTranslation()
  const [state, setState] = useState('loading')  // loading | unsupported | denied | on | off
  const [busy, setBusy] = useState(false)

  async function refresh() {
    if (!isPushSupported()) return setState('unsupported')
    if (getPermission() === 'denied') return setState('denied')
    const on = getPermission() === 'granted' && !isPushOptedOut() && await isSubscribed()
    setState(on ? 'on' : 'off')
  }

  useEffect(() => { refresh() }, [])

  async function turnOn() {
    setBusy(true)
    try {
      const perm = await requestPermission()
      if (perm !== 'granted') {
        toast(t('push.denied'))
      } else {
        await subscribeUser()
        toast.success(t('push.enabled'))
      }
    } catch (e) {
      console.warn('[Push] subscribe failed:', e?.message)
      toast.error(t('push.failed'))
    } finally {
      setBusy(false)
      refresh()
    }
  }

  async function turnOff() {
    setBusy(true)
    try {
      await unsubscribeUser()
      toast.success('Bildirimler kapatıldı')
    } finally {
      setBusy(false)
      refresh()
    }
  }

  const STATUS = {
    loading:     'Kontrol ediliyor...',
    unsupported: 'Bu tarayıcı anlık bildirimi desteklemiyor. iPhone kullanıyorsan önce Kadrom\'u ana ekrana ekle, sonra buradan aç.',
    denied:      'Bildirim izni tarayıcı ayarlarından kapatılmış. Açmak için adres çubuğundaki kilit simgesine dokun ve bildirimlere izin ver.',
    on:          'Açık. Başvuru, vardiya ve mesaj haberleri uygulama kapalıyken de gelir.',
    off:         'Kapalı. Açarsan başvuru, vardiya ve mesaj haberleri uygulama kapalıyken de gelir.',
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="type-card mb-1">Bildirimler</h3>
          <p className="type-meta" aria-live="polite">
            {STATUS[state]}
          </p>
        </div>
        {(state === 'on' || state === 'off') && (
          <button type="button" role="switch" aria-checked={state === 'on'} aria-label="Anlık bildirimler"
                  disabled={busy} onClick={state === 'on' ? turnOff : turnOn}
                  className="relative flex-shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors disabled:opacity-60
                             after:content-[''] after:absolute after:-inset-2.5"
                  style={{ background: state === 'on' ? 'var(--ah-brand)' : 'var(--ah-line-2)' }}>
            <span aria-hidden="true"
                  className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-[left] duration-150"
                  style={{ left: state === 'on' ? 22 : 2, background: 'var(--ah-card)' }} />
          </button>
        )}
      </div>
    </div>
  )
}
