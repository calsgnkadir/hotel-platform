/**
 * FAZ 2/#8 — PWA Install Prompt.
 *
 * Akış:
 *  - Chrome/Edge: `beforeinstallprompt` event'i yakalanir, custom UI ile sorulur
 *  - iOS Safari: native prompt yok — bilgilendirici karta yonlendirilir
 *  - Kullanici "Şimdi Değil" derse 7 gün boyunca tekrar gosterme
 *
 * Login sonrasi 5 sn bekleyip gosterir (UX rahatlatma).
 */
import { useEffect, useState } from 'react'

const STORAGE_KEY = 'pwa-install-dismissed-at'
const DISMISS_DAYS = 7

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
}

function recentlyDismissed() {
  const ts = localStorage.getItem(STORAGE_KEY)
  if (!ts) return false
  const days = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24)
  return days < DISMISS_DAYS
}

export default function InstallPrompt() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [iosMode, setIosMode] = useState(false)

  useEffect(() => {
    if (isStandalone()) return            // zaten yuklu
    if (recentlyDismissed()) return        // 7 gun icinde kapatildi

    // Chrome / Edge / Brave: beforeinstallprompt
    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
      // 5 sn sonra gostermeye basla
      setTimeout(() => setShow(true), 5000)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS Safari: native event yok, bilgi karti gostermek icin custom logic
    if (isIOS()) {
      setIosMode(true)
      const t = setTimeout(() => setShow(true), 8000)
      return () => {
        clearTimeout(t)
        window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      try { await deferredPrompt.userChoice } catch {}
      setDeferredPrompt(null)
    }
    setShow(false)
  }

  function handleLater() {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show) return null

  // iOS — talimat karti
  if (iosMode) {
    return (
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[1000]">
        <div className="rounded-2xl shadow-2xl overflow-hidden"
             style={{ background: 'linear-gradient(135deg, #dde7f3 0%, #ddd6fe 100%)' }}>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xl"
                   style={{ background: 'linear-gradient(135deg, #d4a853, #234a82)' }}>
                📱
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm" style={{ color: '#0c1726' }}>
                  Ana ekrana ekle
                </h3>
                <p className="text-xs mt-1" style={{ color: '#1e3a5f' }}>
                  Safari'de paylaş ikonuna <span className="font-bold">⎙</span> bas, ardından
                  <span className="font-bold"> "Ana Ekrana Ekle"</span> seç.
                </p>
                <button onClick={handleLater}
                  className="mt-3 text-xs font-semibold"
                  style={{ color: '#234a82' }}>
                  Şimdi değil
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Chrome — install prompt karti
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[1000]">
      <div className="rounded-2xl shadow-2xl overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #dde7f3 0%, #ddd6fe 100%)' }}>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-2xl"
                 style={{ background: 'linear-gradient(135deg, #d4a853, #234a82)' }}>
              📲
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-sm" style={{ color: '#0c1726' }}>
                AjansHotel'i yükle
              </h3>
              <p className="text-xs mb-3" style={{ color: '#1e3a5f' }}>
                Ana ekrandan tek tıkla aç, native uygulama hissi yaşa.
              </p>
              <div className="flex gap-2">
                <button onClick={handleInstall}
                  className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #d4a853, #234a82)' }}>
                  ⬇ Yükle
                </button>
                <button onClick={handleLater}
                  className="px-3 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.50)', color: '#1e3a5f' }}>
                  Sonra
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
