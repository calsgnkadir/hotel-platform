import { useEffect, useState } from 'react'

/**
 * FAZ I.1 — KVKK m.5 uyumlu cookie consent banner.
 *
 * Üç kategori:
 *  - necessary  : devre dışı bırakılamaz (JWT, dil seçimi, oturum)
 *  - analytics  : opt-in (kullanım metrikleri, ileride GA/Plausible)
 *  - marketing  : opt-in (henüz kullanılmıyor, ileride retargeting)
 *
 * Tercih localStorage'da `cookie-consent` key'i altında saklanır.
 * Tercih varsa banner görünmez. Footer'dan tekrar açılabilir
 * (window.openCookieSettings() yardımcı global).
 */
const STORAGE_KEY = 'cookie-consent'
const VERSION = 1   // Versiyon değişirse tüm kullanıcılara tekrar sorulur

function readPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (obj.v !== VERSION) return null
    return obj
  } catch {
    return null
  }
}

function writePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    v: VERSION,
    necessary: true,
    analytics: !!prefs.analytics,
    marketing: !!prefs.marketing,
    ts: new Date().toISOString(),
  }))
  window.dispatchEvent(new CustomEvent('cookie-consent-changed'))
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    if (!readPrefs()) setOpen(true)
    // Footer linki için global açıcı
    window.openCookieSettings = () => {
      const cur = readPrefs()
      setAnalytics(!!cur?.analytics)
      setMarketing(!!cur?.marketing)
      setShowDetails(true)
      setOpen(true)
    }
    return () => { delete window.openCookieSettings }
  }, [])

  function acceptAll() {
    writePrefs({ analytics: true, marketing: true })
    setOpen(false)
    setShowDetails(false)
  }
  function acceptNecessary() {
    writePrefs({ analytics: false, marketing: false })
    setOpen(false)
    setShowDetails(false)
  }
  function savePrefs() {
    writePrefs({ analytics, marketing })
    setOpen(false)
    setShowDetails(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-label="Çerez tercihleri"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 9999,
        maxWidth: 720,
        margin: '0 auto',
        background: 'rgba(12, 23, 38, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(205, 183, 143, 0.25)',
        borderRadius: 14,
        padding: '18px 20px',
        boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
        color: '#ede4d3',
      }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
      }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d4a853" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="9.5" cy="9.5" r="1" fill="#d4a853" />
          <circle cx="15.5" cy="11" r="1" fill="#d4a853" />
          <circle cx="11" cy="15" r="1" fill="#d4a853" />
        </svg>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#cdb78f', letterSpacing: '0.04em' }}>
          Çerez Tercihleri
        </h2>
      </div>

      {!showDetails ? (
        <>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(205, 183, 143, 0.14)', marginBottom: 14 }}>
            AjansHotel deneyimini iyileştirmek için çerezler kullanır. <strong style={{ color: '#cdb78f' }}>Gerekli çerezler</strong> oturumun açık kalması için
            zorunludur. Analitik ve pazarlama çerezleri opsiyoneldir.
            {' '}
            <a href="/kvkk" style={{ color: '#cdb78f', textDecoration: 'underline' }}>KVKK metni</a>.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={acceptAll} style={btnPrimary}>Tümünü Kabul Et</button>
            <button onClick={acceptNecessary} style={btnGhost}>Sadece Gerekli</button>
            <button onClick={() => setShowDetails(true)} style={btnLink}>Tercihleri Yönet</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <Row label="Gerekli" subtitle="Oturum, dil, güvenlik. Devre dışı bırakılamaz." disabled checked />
            <Row label="Analitik" subtitle="Sayfa görüntüleme, hata raporu (anonim)."
                 checked={analytics} onChange={setAnalytics} />
            <Row label="Pazarlama" subtitle="Henüz kullanılmıyor — ileride kampanya hedefleme için."
                 checked={marketing} onChange={setMarketing} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={savePrefs} style={btnPrimary}>Seçimi Kaydet</button>
            <button onClick={acceptAll} style={btnGhost}>Tümünü Kabul</button>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, subtitle, checked, onChange, disabled }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: 10, borderRadius: 8,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(205, 183, 143, 0.08)',
      cursor: disabled ? 'not-allowed' : 'pointer',
    }}>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={e => onChange?.(e.target.checked)}
        style={{ marginTop: 2, accentColor: '#d4a853' }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#cdb78f' }}>
          {label}
          {disabled && <span style={{ marginLeft: 8, fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>(zorunlu)</span>}
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{subtitle}</div>
      </div>
    </label>
  )
}

/** Diğer komponentlerden okunabilsin (örn. analytics yükleme kararı). */
export function getCookiePrefs() {
  return readPrefs() || { necessary: true, analytics: false, marketing: false }
}

const btnPrimary = {
  padding: '8px 16px', borderRadius: 8,
  background: 'linear-gradient(135deg, #d4a853, #cdb78f)',
  color: '#13110f', fontSize: 12, fontWeight: 700,
  border: 'none', cursor: 'pointer',
  whiteSpace: 'nowrap',
}
const btnGhost = {
  padding: '8px 16px', borderRadius: 8,
  background: 'rgba(205, 183, 143, 0.10)',
  color: '#cdb78f', fontSize: 12, fontWeight: 600,
  border: '1px solid rgba(205, 183, 143, 0.22)',
  cursor: 'pointer', whiteSpace: 'nowrap',
}
const btnLink = {
  padding: '8px 12px', background: 'transparent',
  color: '#94a3b8', fontSize: 12, fontWeight: 600,
  border: 'none', cursor: 'pointer', textDecoration: 'underline',
}
