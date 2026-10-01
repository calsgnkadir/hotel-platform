import { useState } from 'react'

/**
 * CV vitrini uyarı bandı. Sadece VITE_SHOWCASE=true build'inde görünür
 * (render.yaml). Backend o ortamda prod,showcase ile çalışır: örnek veri +
 * herkesçe bilinen demo hesaplar. Ziyaretçi gerçek kişisel bilgi girmemeli.
 */
export const SHOWCASE = import.meta.env.VITE_SHOWCASE === 'true'

export default function ShowcaseBanner() {
  const [open, setOpen] = useState(false)
  if (!SHOWCASE) return null

  return (
    <div role="note" className="text-xs px-4 py-2 print:hidden"
         style={{ background: 'var(--ah-warn-soft)', color: 'var(--ah-warn)', borderBottom: '1px solid var(--ah-warn)' }}>
      <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>
          <b>Demo vitrini.</b> İlanlar ve kişiler örnek veridir; gerçek kişisel bilgi, belge veya ödeme bilgisi girmeyin.
        </span>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
                className="underline font-semibold" style={{ color: 'inherit' }}>
          {open ? 'Gizle' : 'Demo hesaplar'}
        </button>
        {open && (
          <span className="basis-full sm:basis-auto">
            Aday: <code>demo-aday1@test.com</code> · İşletme: <code>demo-isletme1@test.com</code> · Şifre: <code>Demo1234!</code>
          </span>
        )}
      </div>
    </div>
  )
}
