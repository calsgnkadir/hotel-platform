import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import * as hotelApi from '../../api/hotel'

const fmtTime = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

/**
 * Giriş kartı — vardiya günü aday panelinin üstünde. Kapıdaki otel görevlisi
 * QR'ı kendi telefonuyla okutur; kart o vardiya için tek kullanımlık.
 * Vardiya yoksa hiçbir şey çizmez.
 */
export default function EntryPasses() {
  const [open, setOpen] = useState(null)
  const { data: passes = [] } = useQuery({
    queryKey: ['entry-passes'],
    queryFn: () => hotelApi.getMyPasses(),
    // Kart açıkken okutulduğunu hemen görsün
    refetchInterval: open ? 5000 : 60000,
    retry: 0,
  })

  if (passes.length === 0) return null
  const current = open && passes.find(p => p.applicationId === open)

  return (
    <>
      <div className="space-y-2 mb-4">
        {passes.map(p => (
          <button key={p.applicationId} type="button" onClick={() => setOpen(p.applicationId)}
                  className="card w-full !p-3 flex items-center gap-3 text-left transition-shadow hover:shadow-md">
            <div className="p-1.5 rounded-lg bg-white shrink-0" style={{ border: '1px solid var(--ah-line)', opacity: p.usedAt ? 0.35 : 1 }}>
              <QRCodeSVG value={p.passUrl} size={48} level="M" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ah-ink-4)' }}>
                Bugünkü giriş kartın
              </div>
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>
                {p.businessName} · {p.shift}
              </div>
              <div className="text-xs" style={{ color: p.usedAt ? 'var(--ah-ok)' : 'var(--ah-ink-3)' }}>
                {p.usedAt ? `Giriş yapıldı · ${fmtTime(p.usedAt)}` : 'Kapıdaki görevliye okut — dokun, büyüsün'}
              </div>
            </div>
          </button>
        ))}
      </div>

      {current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(17, 24, 39, 0.85)' }} onClick={() => setOpen(null)}
             role="dialog" aria-modal="true" aria-label="Giriş kartı">
          <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: '#ffffff' }}
               onClick={e => e.stopPropagation()}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ah-ink-4)' }}>
              Giriş kartı
            </div>
            <div className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ah-ink)' }}>{current.fullName}</div>
            <div className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>
              {current.businessName} · {current.shift}
            </div>

            <div className="relative inline-block mt-4 p-3 rounded-xl bg-white" style={{ border: '1px solid var(--ah-line)' }}>
              <div style={{ opacity: current.usedAt ? 0.15 : 1 }}>
                <QRCodeSVG value={current.passUrl} size={240} level="M" />
              </div>
              {current.usedAt && (
                <div className="absolute inset-0 grid place-items-center">
                  <div className="rounded-xl px-4 py-2 text-sm font-semibold"
                       style={{ background: 'var(--ah-ok-soft)', color: 'var(--ah-ok)', border: '1px solid var(--ah-ok)' }}>
                    Kullanıldı · {fmtTime(current.usedAt)}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs mt-3" style={{ color: 'var(--ah-ink-3)' }}>
              {current.usedAt
                ? 'Girişin kaydedildi. Kart bu vardiya için tekrar kullanılamaz.'
                : 'Kapıdaki görevli telefonuyla okutsun. Tek kullanımlıktır; ekran parlaklığını açık tut.'}
            </p>
            {current.meetingPoint && (
              <p className="text-xs mt-3 rounded-lg p-2.5 text-left whitespace-pre-line"
                 style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)', color: 'var(--ah-ink-2)' }}>
                <span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Toplanma: </span>
                {current.meetingPoint}
                {current.meetingMinutesBefore ? ` (vardiyadan ${current.meetingMinutesBefore} dk önce)` : ''}
              </p>
            )}
            <button type="button" onClick={() => setOpen(null)}
                    className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold"
                    style={{ border: '1px solid var(--ah-line)', color: 'var(--ah-ink-2)' }}>
              Kapat
            </button>
          </div>
        </div>
      )}
    </>
  )
}
