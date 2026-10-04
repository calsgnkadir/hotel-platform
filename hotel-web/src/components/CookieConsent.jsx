import { useState } from 'react'
import { Link } from 'react-router-dom'

/**
 * Çerez bilgilendirmesi (KVKK).
 *
 * Kadrom yalnızca zorunlu çerez/tarayıcı kaydı kullanır (oturum, güvenlik, dil
 * ve ekran tercihleri). Analitik, reklam veya takip aracı YOK; bu yüzden izin
 * seçeneği sunulmaz, sadece bilgi verilir. İleride analitik eklenirse burada
 * açık rıza (opt-in) seçeneği geri gelmeli.
 *
 * Bir kez "Anladım" denince `cookie-consent` anahtarına yazılır ve bir daha
 * görünmez. Eski sürümün kaydı (v1) da görülmüş sayılır.
 */
const STORAGE_KEY = 'cookie-consent'

function alreadySeen() {
  try { return !!localStorage.getItem(STORAGE_KEY) } catch { return false }
}

export default function CookieConsent() {
  const [open, setOpen] = useState(() => !alreadySeen())

  if (!open) return null

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, necessaryOnly: true, ts: new Date().toISOString() }))
    } catch { /* yok say: bu oturumda kapanir */ }
    setOpen(false)
  }

  return (
    <div role="region" aria-label="Çerez bilgilendirmesi"
         className="fixed left-3 right-3 bottom-3 z-[60] mx-auto max-w-2xl rounded-xl border px-4 py-3
                    flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4"
         style={{
           background: 'var(--ah-card)', borderColor: 'var(--ah-line-2)',
           boxShadow: 'var(--elev-2)', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
         }}>
      <p className="flex-1 min-w-0 text-[13px] leading-relaxed" style={{ color: 'var(--ah-ink-2)' }}>
        Kadrom yalnızca oturumun ve tercihlerin için <b style={{ color: 'var(--ah-ink)' }}>gerekli çerezleri</b> kullanır;
        reklam veya takip çerezi yok.{' '}
        <Link to="/kvkk" className="underline font-medium" style={{ color: 'var(--ah-ink)' }}>KVKK metni</Link>
      </p>
      <button type="button" onClick={dismiss}
              className="self-end sm:self-auto flex-shrink-0 text-[13px] font-semibold px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: 'var(--ah-brand)', color: '#ffffff' }}>
        Anladım
      </button>
    </div>
  )
}
