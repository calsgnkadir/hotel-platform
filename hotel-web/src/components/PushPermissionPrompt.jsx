/**
 * FAZ 1/#23 — Push Permission Prompt
 *
 * Login sonrası 1 kez gösterilir (localStorage flag).
 * Kullanıcı reddederse veya kabul ederse bir daha sorulmaz.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { isPushSupported, getPermission, requestPermission, subscribeUser } from '../lib/webpush'

const STORAGE_KEY = 'push-prompt-shown-v1'

export default function PushPermissionPrompt() {
  const [show, setShow] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    if (!isPushSupported()) return
    if (getPermission() !== 'default') return  // zaten karar verilmiş
    if (localStorage.getItem(STORAGE_KEY)) return  // bu kullanıcı bir kez gördü
    // Login sonrası 4 sn bekle, sonra prompt göster (UX)
    const t = setTimeout(() => setShow(true), 4000)
    return () => clearTimeout(t)
  }, [])

  async function enable() {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, '1')
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
      toast.error('Push setup failed: ' + (e?.message || ''))
    }
  }

  function later() {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-40 animate-fade-in">
      <div className="card !p-4 shadow-2xl" style={{ background: 'linear-gradient(135deg, #ede4d3 0%, #ddd6fe 100%)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
               style={{ background: 'linear-gradient(135deg, #d4a853, #8a7349)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-0.5" style={{ color: '#13110f' }}>
              {t('push.promptTitle')}
            </h3>
            <p className="text-xs mb-3" style={{ color: '#1b1815' }}>
              {t('push.promptBody')}
            </p>
            <div className="flex gap-2">
              <button onClick={enable}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #d4a853, #8a7349)' }}>
                {t('push.enable')}
              </button>
              <button onClick={later}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.50)', color: '#1b1815' }}>
                {t('push.later')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
