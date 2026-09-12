// Faz 1 — İşletme aboneliği (iyzico SANDBOX). İşçi tarafı her zaman ücretsiz.
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'

const STATUS_LABEL = {
  TRIAL:    'Deneme sürümü',
  ACTIVE:   'Aktif abonelik',
  PAST_DUE: 'Süresi doldu',
  CANCELED: 'İptal edildi',
}

// Satış değeri — plana dahil olanlar (sag kolon)
const PLAN_FEATURES = [
  'Sınırsız vardiya ilanı yayınla',
  'Komisyon yok — işçi ücretinin tamamını alır',
  'Gelen başvuruları tek panelden yönet',
  'Adaylarla doğrudan mesajlaşma',
  'Çalışan havuzunu kaydet, tekrar çağır',
  'İlan başına ek ücret yok',
]

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}
function daysLeft(v) {
  if (!v) return null
  return Math.max(0, Math.ceil((new Date(v) - new Date()) / 86400000))
}

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
         className="flex-shrink-0 mt-[3px]" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function BillingTab() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()

  const { data: b, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: hotelApi.getBilling,
  })

  // iyzico callback -> ?sub=ok|fail ile döner
  useEffect(() => {
    const sub = params.get('sub')
    if (!sub) return
    if (sub === 'ok')   toast.success('Ödeme alındı — aboneliğin aktif.')
    if (sub === 'fail') toast.error('Ödeme tamamlanamadı. Tekrar deneyebilirsin.')
    qc.invalidateQueries({ queryKey: ['billing'] })
    const next = new URLSearchParams(params); next.delete('sub')
    setParams(next, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkout = useMutation({
    mutationFn: hotelApi.startBillingCheckout,
    onSuccess: (init) => {
      if (init?.ok && init.paymentPageUrl) {
        window.location.href = init.paymentPageUrl   // iyzico hosted ödeme sayfası (sandbox)
      } else {
        toast.error(init?.error || 'Ödeme başlatılamadı.')
      }
    },
    onError: (e) => toast.error(extractErrorMessage(e) || 'Ödeme başlatılamadı.'),
  })

  const cancel = useMutation({
    mutationFn: hotelApi.cancelBilling,
    onSuccess: () => { toast.success('Abonelik iptal edildi.'); qc.invalidateQueries({ queryKey: ['billing'] }) },
    onError: (e) => toast.error(extractErrorMessage(e) || 'İptal edilemedi.'),
  })

  if (isLoading || !b) {
    return <div className="mt-2"><div className="card p-6" style={{ color: 'var(--ah-ink-3)' }}>Yükleniyor…</div></div>
  }

  const active = b.active
  const isTrial = b.status === 'TRIAL'
  const trialTotal = Number(b.trialDays || 14)
  const trialDays = isTrial ? daysLeft(b.trialEndsAt) : null
  const trialPct = isTrial && trialDays != null
    ? Math.max(6, Math.min(100, Math.round((trialDays / trialTotal) * 100)))
    : 0
  const price = Number(b.monthlyPrice || 0).toLocaleString('tr-TR')
  const primaryLabel = active ? 'Aboneliği Yenile / Uzat' : 'Aboneliği Başlat'

  return (
    // NOT: panel basligini (h1 "Abonelik") DashboardLayout basiyor — burada tekrar etmiyoruz.
    <div className="mt-2 max-w-5xl">
      <p className="text-[13.5px] mb-5" style={{ color: 'var(--ah-ink-3)', maxWidth: 640 }}>
        Adaylar için her zaman ücretsiz. Gelir yalnızca işletme tarafında — tek, düşük aylık ücret, komisyon yok.
      </p>

      <div className="grid lg:grid-cols-12 gap-4 items-stretch">
        {/* SOL — durum + fiyat + aksiyon */}
        <div className="lg:col-span-7 card p-6 flex flex-col">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3"
                    style={active
                      ? { background: 'var(--ah-brand)', color: '#fff' }
                      : { background: 'var(--ah-band)', color: 'var(--ah-ink-3)', border: '1px solid var(--ah-line-2)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? '#fff' : 'var(--ah-ink-4)' }} />
                {active ? 'Erişim açık' : 'Erişim kapalı'}
              </span>
              <div className="font-display text-[22px] font-semibold" style={{ color: 'var(--ah-ink)', letterSpacing: '-.02em' }}>
                {STATUS_LABEL[b.status] || b.status}
              </div>
              <div className="text-[13px] mt-1" style={{ color: 'var(--ah-ink-3)' }}>Plan: {b.plan}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="font-display font-black tabular-nums leading-none" style={{ color: 'var(--ah-ink)', fontSize: 34 }}>{price} ₺</div>
              <div className="text-[11px] uppercase tracking-widest mt-1.5" style={{ color: 'var(--ah-ink-4)' }}>aylık</div>
            </div>
          </div>

          {/* Deneme ilerleme cubugu */}
          {isTrial && trialDays != null && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                <span style={{ color: 'var(--ah-ink-2)' }}><b>{trialDays} gün</b> deneme kaldı</span>
                <span style={{ color: 'var(--ah-ink-4)' }}>bitiş {fmtDate(b.trialEndsAt)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ah-line)' }}>
                <div className="h-full rounded-full" style={{ width: `${trialPct}%`, background: 'var(--ah-brand-gradient)' }} />
              </div>
            </div>
          )}
          {b.status === 'ACTIVE' && (
            <div className="mt-5 text-[13.5px]" style={{ color: 'var(--ah-ink-2)' }}>
              <span style={{ color: 'var(--ah-ink-3)' }}>Bir sonraki yenileme:</span> <b>{fmtDate(b.currentPeriodEnd)}</b>
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-auto pt-6 flex-wrap" style={{ borderTop: '1px solid var(--ah-line)', marginTop: 24 }}>
            <button onClick={() => checkout.mutate()} disabled={checkout.isPending}
              className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5 text-white"
              style={{ background: 'var(--ah-brand-gradient)', boxShadow: 'var(--elev-1)' }}>
              {checkout.isPending ? 'Yönlendiriliyor…' : primaryLabel}
            </button>
            {(isTrial || b.status === 'ACTIVE') && (
              <button onClick={() => cancel.mutate()} disabled={cancel.isPending}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors"
                style={{ background: '#fff', color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line-2)' }}>
                {cancel.isPending ? '…' : 'İptal et'}
              </button>
            )}
          </div>
        </div>

        {/* SAG — plana dahil olanlar */}
        <div className="lg:col-span-5 card p-6">
          <div className="text-[10px] uppercase tracking-widest font-bold mb-3.5" style={{ color: 'var(--ah-ink-3)' }}>Plana dahil</div>
          <ul className="space-y-2.5">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-snug" style={{ color: 'var(--ah-ink-2)' }}>
                <span style={{ color: 'var(--ah-brand)' }}><Check /></span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* enforce durum notu */}
      {!b.enforced && (
        <div className="rounded-xl p-4 text-[13px] mt-4" style={{ background: 'var(--ah-band)', border: '1px dashed var(--ah-line-2)', color: 'var(--ah-ink-2)' }}>
          <b>Geliştirme / test modu.</b> Şu an ilan yayınlama abonelikle kısıtlanmıyor
          (<code>billing.enforce=false</code>). Canlıya geçince açılır.
        </div>
      )}

      {/* Sandbox test karti bilgisi */}
      <div className="card p-5 mt-4">
        <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--ah-ink-3)' }}>iyzico Sandbox — test kartı</div>
        <div className="text-[13px] space-y-1" style={{ color: 'var(--ah-ink-2)' }}>
          <p>Kart: <b className="font-mono">5528 7900 0000 0008</b> · SKT <b>12/30</b> · CVC <b>123</b> · 3D şifre <b>283126</b></p>
          <p style={{ color: 'var(--ah-ink-3)' }}>Gerçek para hareket etmez. Canlıya geçiş yalnızca gerçek iyzico anahtarları + ticari/yasal onay ile.</p>
        </div>
      </div>
    </div>
  )
}
