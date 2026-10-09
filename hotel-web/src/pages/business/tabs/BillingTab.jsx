// İşletme aboneliği (iyzico). İşçi tarafı her zaman ücretsiz.
// MODEL: ilk {freeListings} ilan ücretsiz; sonrası aylık abonelik (sınırsız ilan).
// paymentsAvailable=false (iyzico anahtarı yok) → kota yok, satın alma butonu yok.
// Otomatik yenileme YOK: currentPeriodEnd aboneliğin bitiş tarihidir. İptal edilen
// abonelik (status=CANCELED) ödenmiş dönem sonuna kadar active=true kalır.
// sandbox=true → test kartı kutusu gösterilir (yalnız test ortamında).
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'

// Satış değeri — plana dahil olanlar
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

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
         className="flex-shrink-0 mt-[3px]" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// "Nasıl çalışır" adımları (numaralı)
function Step({ n, title, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex-shrink-0 grid place-items-center rounded-full font-bold tabular-nums"
            style={{ width: 24, height: 24, fontSize: 12, background: 'var(--ah-brand)', color: '#fff' }}>{n}</span>
      <div className="text-[13.5px] leading-snug" style={{ color: 'var(--ah-ink-2)' }}>
        <b style={{ color: 'var(--ah-ink)' }}>{title}</b>
        <div style={{ color: 'var(--ah-ink-3)' }}>{children}</div>
      </div>
    </li>
  )
}

export default function BillingTab() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()

  const { data: b, isLoading, isError, refetch } = useQuery({
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
        window.location.href = init.paymentPageUrl   // iyzico hosted ödeme sayfası
      } else {
        toast.error(init?.error || 'Ödeme başlatılamadı.')
      }
    },
    onError: (e) => toast.error(extractErrorMessage(e) || 'Ödeme başlatılamadı.'),
  })

  const cancel = useMutation({
    mutationFn: hotelApi.cancelBilling,
    onSuccess: () => { toast.success('Abonelik iptal edildi; dönem sonuna kadar geçerli.'); qc.invalidateQueries({ queryKey: ['billing'] }) },
    onError: (e) => toast.error(extractErrorMessage(e) || 'İptal edilemedi.'),
  })

  if (isError) {
    return (
      <div className="mt-2">
        <div className="card p-6" role="alert">
          <div className="text-[14px] font-semibold" style={{ color: 'var(--ah-ink)' }}>Abonelik bilgisi yüklenemedi.</div>
          <div className="text-[13px] mt-1" style={{ color: 'var(--ah-ink-3)' }}>Bağlantını kontrol edip tekrar dene.</div>
          <button type="button" onClick={() => refetch()} className="btn-secondary mt-4">
            Tekrar dene
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || !b) {
    return <div className="mt-2"><div className="card p-6" style={{ color: 'var(--ah-ink-3)' }}>Yükleniyor…</div></div>
  }

  const paid       = b.active
  const canceled   = paid && b.status === 'CANCELED'   // iptal edildi, dönem sonuna kadar geçerli
  const payments   = !!b.paymentsAvailable   // abonelik satın alınabilir mi
  const limited    = !!b.enforced            // ücretsiz ilan kotası uygulanıyor mu
  const free       = Number(b.freeListings ?? 5)
  const used       = Number(b.usedListings ?? 0)
  const remaining  = Number(b.freeRemaining ?? Math.max(0, free - used))
  const canPost    = paid || !limited || remaining > 0
  const usagePct   = free > 0 ? Math.min(100, Math.round((used / free) * 100)) : 0
  const price      = Number(b.monthlyPrice || 0).toLocaleString('tr-TR')
  const primaryLabel = paid ? 'Aboneliği yenile / uzat' : 'Aboneliğe geç'

  return (
    <div className="mt-2">
      <p className="text-[13.5px] mb-5" style={{ color: 'var(--ah-ink-3)', maxWidth: 680 }}>
        {limited ? (
          <>Adaylar için her zaman ücretsiz. İlk <b>{free}</b> ilan işletmeler için de ücretsiz;
          daha fazlası için tek, düşük aylık ücret — komisyon yok.</>
        ) : (
          <>Adaylar için her zaman ücretsiz. İlan yayınlama şimdilik işletmeler için de
          <b> ücretsiz ve sınırsız</b> — komisyon yok.</>
        )}
      </p>

      {/* === SATIR 1 — durum + kullanım (tam genişlik) === */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <span className="type-label inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3"
                  style={canPost
                    ? { background: 'var(--ah-brand)', color: '#fff' }
                    : { background: 'var(--ah-band)', color: 'var(--ah-ink-3)', border: '1px solid var(--ah-line-2)' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: canPost ? '#fff' : 'var(--ah-ink-4)' }} />
              {canPost ? 'İlan yayınlayabilirsin' : 'İlan hakkın doldu'}
            </span>
            <h2 className="type-section" style={{ color: 'var(--ah-ink)' }}>
              {canceled ? 'İptal edildi (dönem sonuna kadar geçerli)' : paid ? 'Aktif abonelik' : 'Ücretsiz plan'}
            </h2>
            <div className="type-meta mt-1">
              {paid ? `Plan: ${b.plan}` : limited ? `${free} ilana kadar ücretsiz` : 'Sınırsız ilan, ücretsiz'}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="type-num leading-none" style={{ color: 'var(--ah-ink)', fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em' }}>{price} ₺</div>
            <div className="type-meta mt-1.5">
              {payments ? 'aylık · sınırsız ilan' : 'aylık · yakında'}
            </div>
          </div>
        </div>

        {/* Kullanım / sınırsız */}
        <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--ah-line)' }}>
          {canceled ? (
            <div className="text-[13.5px]" style={{ color: 'var(--ah-ink-2)' }}>
              {b.currentPeriodEnd
                ? <>Aboneliğin iptal edildi; <b>{fmtDate(b.currentPeriodEnd)}</b> tarihine kadar sınırsız ilan açık.</>
                : <>Aboneliğin iptal edildi; dönem sonuna kadar sınırsız ilan açık.</>}
            </div>
          ) : paid ? (
            <div className="text-[13.5px]" style={{ color: 'var(--ah-ink-2)' }}>
              <b>Sınırsız ilan yayınlama açık.</b>
              {b.currentPeriodEnd && <> · <span style={{ color: 'var(--ah-ink-3)' }}>Abonelik bitişi:</span> <b>{fmtDate(b.currentPeriodEnd)}</b></>}
            </div>
          ) : !limited ? (
            <div className="text-[13.5px]" style={{ color: 'var(--ah-ink-2)' }}>
              <b>İlan yayınlama şimdilik ücretsiz ve sınırsız.</b>
              {!payments && <> <span style={{ color: 'var(--ah-ink-3)' }}>Ücretli abonelik henüz aktif değil.</span></>}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                <span style={{ color: 'var(--ah-ink-2)' }}>Ücretsiz ilan hakkı</span>
                <span className="tabular-nums" style={{ color: 'var(--ah-ink-3)' }}><b style={{ color: 'var(--ah-ink)' }}>{used}</b> / {free} kullanıldı</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ah-line)' }}>
                <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: 'var(--ah-brand-gradient)' }} />
              </div>
              <div className="text-[12.5px] mt-2" style={{ color: remaining > 0 ? 'var(--ah-ink-3)' : 'var(--ah-ink-2)' }}>
                {remaining > 0
                  ? <><b>{remaining}</b> ücretsiz ilan hakkın kaldı.</>
                  : <>Ücretsiz hakkın doldu — yeni ilan için aboneliğe geç <span style={{ color: 'var(--ah-ink-3)' }}>(veya bir ilanı kapat, hak geri gelsin).</span></>}
              </div>
            </>
          )}
        </div>

        {/* Aksiyonlar — ödeme sistemi kapalıysa satın alma butonu yok */}
        {(payments || paid) && (
        <div className="flex items-center gap-2.5 mt-5 flex-wrap">
          {payments && (
          <button type="button" onClick={() => checkout.mutate()} disabled={checkout.isPending}
            className="btn-primary !w-auto">
            {checkout.isPending ? 'Yönlendiriliyor…' : primaryLabel}
          </button>
          )}
          {paid && !canceled && (
            <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending}
              className="btn-danger">
              {cancel.isPending ? '…' : 'İptal et'}
            </button>
          )}
        </div>
        )}
      </div>

      {/* === SATIR 2 — plana dahil + nasıl çalışır === */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="card p-6">
          <h3 className="type-card mb-3.5">Plana dahil</h3>
          <ul className="space-y-2.5">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[13.5px] leading-snug" style={{ color: 'var(--ah-ink-2)' }}>
                <span style={{ color: 'var(--ah-brand)' }}><Check /></span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-6">
          <h3 className="type-card mb-3.5">Nasıl çalışır</h3>
          <ol className="space-y-3.5">
            {limited ? (
              <>
                <Step n={1} title={`İlk ${free} ilan ücretsiz`}>Kart bilgisi istemeden hemen ilan yayınla.</Step>
                <Step n={2} title={`Sonrası ${price} ₺ / ay`}>Aboneliğe geçince sınırsız ilan; istediğin zaman iptal.</Step>
              </>
            ) : (
              <>
                <Step n={1} title="Şimdilik sınırsız ve ücretsiz">Kart bilgisi istemeden dilediğin kadar ilan yayınla.</Step>
                <Step n={2} title="Ücretli plan sonra">Abonelik başladığında yayındaki ilanların kapanmaz.</Step>
              </>
            )}
            <Step n={3} title="Adaylar hep ücretsiz">İşçi tarafından hiçbir komisyon/kesinti alınmaz.</Step>
          </ol>
        </div>
      </div>

      {/* Test kartı — yalnız test (sandbox) ödeme ortamında; canlıda asla görünmez */}
      {payments && b.sandbox && (
        <div className="card p-5 mt-4">
          <h3 className="type-card mb-2">Test ödeme ortamı — test kartı</h3>
          <div className="text-[13px] space-y-1" style={{ color: 'var(--ah-ink-2)' }}>
            <p>Kart: <b className="font-mono">5528 7900 0000 0008</b> · SKT <b>12/30</b> · CVC <b>123</b> · 3D şifre <b>283126</b></p>
            <p style={{ color: 'var(--ah-ink-3)' }}>Bu bir deneme ortamıdır; gerçek para hareket etmez.</p>
          </div>
        </div>
      )}
    </div>
  )
}
