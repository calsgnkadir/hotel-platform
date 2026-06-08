import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useTheme } from '../../context/ThemeContext'

/**
 * Ayarlar sekmesi — tüm rollerde aynı (CANDIDATE / BUSINESS_OWNER / ADMIN)
 *
 * Bölümler:
 *  1) Tema seçimi (light / dark)
 *  2) Bildirim sustur (localStorage flag)
 *
 * NOT: Bildirim ayarı şu an client-side (localStorage). İleride backend
 *      user_preferences tablosuna taşınabilir.
 */
export default function SettingsTab() {
  const { theme, toggleTheme } = useTheme()

  // Bildirim sustur (localStorage)
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem('ajanshotel.notifications.muted') === '1' }
    catch { return false }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ajanshotel.notifications.muted', muted ? '1' : '0')
      // NotificationBell polling'i bu flag'i okuyor — değişiklik anında etkili
      window.dispatchEvent(new Event('ajanshotel:notifications-muted-changed'))
    } catch {}
  }, [muted])

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h2 className="text-2xl font-black tracking-tight">Ayarlar</h2>
        <p className="text-[12px] text-slate-400 mt-1">
          Görünüm ve bildirim tercihlerini buradan yönet.
        </p>
      </div>

      {/* Tema */}
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Görünüm</div>
            <div className="font-semibold text-slate-100">Tema</div>
            <p className="text-[12px] text-slate-400 mt-1">
              {theme === 'dark'
                ? 'Şu an koyu (lacivert) tema aktif.'
                : 'Şu an açık (beyaz) tema aktif.'}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemePill
              active={theme === 'light'}
              label="Açık"
              onClick={() => { if (theme !== 'light') toggleTheme() }}
            />
            <ThemePill
              active={theme === 'dark'}
              label="Koyu"
              onClick={() => { if (theme !== 'dark') toggleTheme() }}
            />
          </div>
        </div>
      </div>

      {/* Bildirim sustur */}
      <div className="card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Bildirimler</div>
            <div className="font-semibold text-slate-100">Bildirimleri kapat</div>
            <p className="text-[12px] text-slate-400 mt-1">
              Açıksa zil ikonu hiç yeni bildirim göstermez. Bildirimler
              backend'de yine kayıt edilir, sadece arayüzde görünmez.
            </p>
          </div>
          <ToggleSwitch
            checked={muted}
            onChange={(v) => {
              setMuted(v)
              toast.success(v ? 'Bildirimler kapatıldı.' : 'Bildirimler açıldı.')
            }}
          />
        </div>
      </div>

      {/* Hesap bölümü — sadece bilgi */}
      <div className="card">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">Hesap</div>
          <div className="font-semibold text-slate-100">Şifre & güvenlik</div>
          <p className="text-[12px] text-slate-400 mt-1">
            Şifreni değiştirmek için <strong className="text-slate-200">Profilim → Şifre Değiştir</strong> bölümünü kullan.
            Şifreni unuttuysan giriş sayfasında "Şifremi unuttum" linkine tıkla.
          </p>
        </div>
      </div>
    </div>
  )
}

function ThemePill({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors
        ${active
          ? 'bg-brand-500 text-white border-brand-500'
          : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700/60'}`}
    >
      {label}
    </button>
  )
}

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors shrink-0
        ${checked ? 'bg-brand-500 border-brand-500' : 'bg-slate-700 border-slate-600'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  )
}
