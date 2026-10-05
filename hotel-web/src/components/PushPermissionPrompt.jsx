/**
 * Bildirim izni kartı.
 *
 * Sayfa açılınca değil, bildirimin işe yaradığı anda sorulur:
 *   - aday ilk başvurusunu gönderince ("Başvurun kabul edilince haber verelim mi?")
 *   - işletme ilan yayınlayınca ("Yeni başvuru gelince haber verelim mi?")
 * Bu anlar requestPushMoment(reason) ile bildirilir.
 *
 * Sadece giriş yapmış kullanıcıya; tarayıcı izni hâlâ sorulmamışsa ("default").
 * "Şimdi değil" 7 gün erteler; ayarlardan kapatan kullanıcıya hiç sorulmaz.
 * Açık bir pencere (başvuru onayı vb.) kapanana kadar bekler, çerez bandının
 * üstüne binmez.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  PUSH_MOMENT_EVENT, isPushSupported, getPermission, requestPermission, subscribeUser,
  isPushOptedOut, isPushSnoozed, snoozePush,
} from '../lib/webpush'

const COPY = {
  applied: { title: 'push.appliedTitle', body: 'push.appliedBody' },
  listing: { title: 'push.listingTitle', body: 'push.listingBody' },
}

function canAsk() {
  return isPushSupported() && getPermission() === 'default' && !isPushOptedOut() && !isPushSnoozed()
}

function modalOpen() {
  return !!document.querySelector('.modal-overlay, [aria-modal="true"]')
}

function cookieBarHeight() {
  const bar = document.querySelector('[aria-label="Çerez bilgilendirmesi"]')
  return bar ? bar.getBoundingClientRect().height + 12 : 0
}

export default function PushPermissionPrompt() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [pending, setPending] = useState(null)   // bekleyen anın nedeni
  const [shown, setShown] = useState(null)       // gösterilen kartın nedeni
  const [bottomOffset, setBottomOffset] = useState(0)

  // Anı dinle
  useEffect(() => {
    if (!user) return
    function onMoment(e) {
      const reason = e.detail?.reason
      if (COPY[reason] && canAsk()) setPending(reason)
    }
    window.addEventListener(PUSH_MOMENT_EVENT, onMoment)
    return () => window.removeEventListener(PUSH_MOMENT_EVENT, onMoment)
  }, [user])

  // Açık pencere kapanınca göster (en fazla ~30 sn bekler)
  useEffect(() => {
    if (!pending) return
    let tries = 0
    const id = setInterval(() => {
      tries++
      if (!modalOpen()) {
        clearInterval(id)
        setBottomOffset(cookieBarHeight())
        setShown(pending)
        setPending(null)
      } else if (tries > 30) {
        clearInterval(id)
        setPending(null)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [pending])

  // Çıkış yapılırsa kartı kaldır
  useEffect(() => { if (!user) { setShown(null); setPending(null) } }, [user])

  async function enable() {
    setShown(null)
    try {
      const perm = await requestPermission()
      if (perm !== 'granted') {
        toast(t('push.denied'))
        return
      }
      await subscribeUser()
      toast.success(t('push.enabled'))
    } catch (e) {
      console.warn('[Push] subscribe failed:', e?.message)
      toast.error(t('push.failed'))
    }
  }

  function later() {
    snoozePush()
    setShown(null)
  }

  if (!shown || !user) return null
  const copy = COPY[shown]

  return (
    <div role="dialog" aria-labelledby="push-prompt-title"
         className="floating-notice fixed right-3 left-3 sm:left-auto sm:right-4 sm:max-w-sm z-[55]"
         style={{ bottom: 12 + bottomOffset }}>
      <div className="rounded-xl border p-4 flex items-start gap-3"
           style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line-2)', boxShadow: 'var(--elev-2)' }}>
        <div className="w-10 h-10 rounded-lg grid place-items-center flex-shrink-0"
             style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={1.8} className="w-5 h-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 id="push-prompt-title" className="font-bold text-[14px] mb-1" style={{ color: 'var(--ah-ink)' }}>
            {t(copy.title)}
          </h3>
          <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: 'var(--ah-ink-3)' }}>
            {t(copy.body)}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={enable}
              className="flex-1 px-3 py-2 rounded-lg text-[12.5px] font-bold transition-opacity hover:opacity-90"
              style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
              {t('push.enable')}
            </button>
            <button type="button" onClick={later}
              className="px-3 py-2 rounded-lg text-[12.5px] font-semibold border"
              style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line-2)', color: 'var(--ah-ink-2)' }}>
              {t('push.later')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
