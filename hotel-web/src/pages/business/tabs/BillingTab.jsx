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

function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}
function daysLeft(v) {
  if (!v) return null
  return Math.max(0, Math.ceil((new Date(v) - new Date()) / 86400000))
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
    return <div className="mt-4"><div className="card p-6" style={{ color: 'var(--ah-ink-3)' }}>Yükleniyor…</div></div>
  }

  const active = b.active
  const trialDays = b.status === 'TRIAL' ? daysLeft(b.trialEndsAt) : null
  const price = Number(b.monthlyPrice || 0).toLocaleString('tr-TR')
  const primaryLabel = active ? 'Aboneliği Yenile / Uzat' : 'Aboneliği Başlat'

  return (
    <div className="mt-4 max-w-3xl space-y-4">
      <div>
        <h2 className="font-display text-[22px] font-semibold" style={{ color: 'var(--ah-ink)', letterSpacing: '-.02em' }}>Abonelik</h2>
        <p className="text-[13px] mt-1" style={{ color: 'var(--ah-ink-3)' }}>
          Adaylar için her zaman ücretsiz. Gelir yalnızca işletme tarafında — düşük aylık, komisyonsuz.
        </p>
      </div>

      {/* Durum kartı */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[18px] font-semibold" style={{ color: 'var(--ah-ink)' }}>
                {STATUS_LABEL[b.status] || b.status}
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                    style={active
                      ? { background: 'var(--ah-brand)', color: '#fff' }
                      : { background: 'transparent', color: 'var(--ah-ink-3)', border: '1px solid var(--ah-line-2)' }}>
                {active ? 'Erişim açık' : 'Erişim kapalı'}
              </span>
            </div>
            <div className="mt-3 text-[13.5px] space-y-1" style={{ color: 'var(--ah-ink-2)' }}>
              {b.status === 'TRIAL' && (
                <p><span style={{ color: 'var(--ah-ink-3)' }}>Deneme bitişi:</span> {fmtDate(b.trialEndsAt)}
                  {trialDays != null && <> · <b>{trialDays} gün kaldı</b></>}</p>
              )}
              {b.status === 'ACTIVE' && (
                <p><span style={{ color: 'var(--ah-ink-3)' }}>Dönem sonu:</span> {fmtDate(b.currentPeriodEnd)}</p>
              )}
              <p><span style={{ color: 'var(--ah-ink-3)' }}>Plan:</span> {b.plan} · <b>{price} ₺</b> / ay</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display font-black tabular-nums" style={{ color: 'var(--ah-ink)', fontSize: 30, lineHeight: 1 }}>{price} ₺</div>
            <div className="text-[11px] uppercase tracking-widest mt-1" style={{ color: 'var(--ah-ink-4)' }}>aylık</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 mt-5 pt-5 flex-wrap" style={{ borderTop: '1px solid var(--ah-line)' }}>
          <button onClick={() => checkout.mutate()} disabled={checkout.isPending}
            className="px-5 py-2.5 text-sm font-semibold rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5 text-white"
            style={{ background: 'var(--ah-brand-gradient)', boxShadow: 'var(--elev-1)' }}>
            {checkout.isPending ? 'Yönlendiriliyor…' : primaryLabel}
          </button>
          {(b.status === 'TRIAL' || b.status === 'ACTIVE') && (
            <button onClick={() => cancel.mutate()} disabled={cancel.isPending}
              className="px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors"
              style={{ background: '#fff', color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line-2)' }}>
              {cancel.isPending ? '…' : 'İptal et'}
            </button>
          )}
        </div>
      </div>

      {/* enforce durum notu */}
      {!b.enforced && (
        <div className="rounded-xl p-4 text-[13px]" style={{ background: 'var(--ah-band)', border: '1px dashed var(--ah-line-2)', color: 'var(--ah-ink-2)' }}>
          <b>Geliştirme / test modu.</b> Şu an ilan yayınlama abonelikle kısıtlanmıyor
          (<code>billing.enforce=false</code>). Canlıya geçince açılır.
        </div>
      )}

      {/* Sandbox test kartı bilgisi */}
      <div className="card p-5">
        <div className="text-[10px] uppercase tracking-widest font-bold mb-2" style={{ color: 'var(--ah-ink-3)' }}>iyzico Sandbox — test kartı</div>
        <div className="text-[13px] space-y-1" style={{ color: 'var(--ah-ink-2)' }}>
          <p>Kart: <b className="font-mono">5528 7900 0000 0008</b> · SKT <b>12/30</b> · CVC <b>123</b> · 3D şifre <b>283126</b></p>
          <p style={{ color: 'var(--ah-ink-3)' }}>Gerçek para hareket etmez. Canlıya geçiş yalnızca gerçek iyzico anahtarları + ticari/yasal onay ile.</p>
        </div>
      </div>
    </div>
  )
}
