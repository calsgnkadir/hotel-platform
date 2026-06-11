/**
 * FAZ 1/#23 — Push Permission Prompt
 *
 * Login sonrası 1 kez gösterilir (localStorage flag).
 * Kullanıcı reddederse veya kabul ederse bir daha sorulmaz.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { isPushSupported, getPermission, requestPermission, subscribeUser } from '../lib/webpush'

const STORAGE_KEY = 'push-prompt-shown-v1'

export default function PushPermissionPrompt() {
  const [show, setShow] = useState(false)

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
        toast('Bildirim izni reddedildi')
        return
      }
      await subscribeUser()
      toast.success('Bildirimler etkin — tarayıcı kapalı bile bildirim alırsın')
    } catch (e) {
      console.warn('[Push] subscribe failed:', e?.message)
      toast.error('Bildirim ayarlanamadı: ' + (e?.message || 'Bilinmeyen hata'))
    }
  }

  function later() {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-40 animate-fade-in">
      <div className="card !p-4 shadow-2xl" style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xl"
               style={{ background: 'linear-gradient(135deg, #a855f7, #7e22ce)' }}>
            🔔
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm mb-0.5" style={{ color: '#3b0764' }}>
              Anlık bildirimler
            </h3>
            <p className="text-xs mb-3" style={{ color: '#6b21a8' }}>
              Tarayıcı kapalıyken bile yeni mesaj ve başvuru bildirimlerini al.
            </p>
            <div className="flex gap-2">
              <button onClick={enable}
                className="flex-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7, #7e22ce)' }}>
                Etkinleştir
              </button>
              <button onClick={later}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.50)', color: '#6b21a8' }}>
                Şimdi değil
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
