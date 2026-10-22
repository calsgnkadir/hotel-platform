import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import * as hotelApi from '../../api/hotel'
import { keys } from '../../lib/queryClient'
import { annotateShiftText, localDateISO } from '../../lib/shiftTime'

/** Başvurulardaki vardiya bazlı gelmedi işaretleri: "appId:slotId" kümesi. */
function noShowKeys(applications) {
  const set = new Set()
  for (const a of applications || []) {
    for (const id of a?.noShowSlotIds || []) set.add(`${a.id}:${id}`)
  }
  return set
}

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

  // Aday panelindeki başvuru önbelleği (aynı anahtar/biçim); gelmedi işaretli
  // vardiyanın kartı okutulmaz, bekleme metni yerine "Gelmedi" gösterilir.
  const { data: applications = [] } = useQuery({
    queryKey: keys.applications.candidate(),
    queryFn: async () => {
      const res = await hotelApi.getMyApplications()
      return Array.isArray(res) ? res : (res?.content ?? [])
    },
    enabled: passes.length > 0,
    retry: 0,
  })
  const noShows = noShowKeys(applications)
  const isNoShow = p => !!p.noShow || noShows.has(`${p.applicationId}:${p.shiftSlotId}`)

  if (passes.length === 0) return null
  const current = open && passes.find(p => p.passUrl === open && !isNoShow(p))

  return (
    <>
      <div className="space-y-2 mb-4">
        {passes.map(p => {
          const noShow = isNoShow(p)
          const body = (
            <>
              <div className="p-1.5 rounded-lg bg-white shrink-0" style={{ border: '1px solid var(--ah-line)', opacity: p.usedAt || noShow ? 0.35 : 1 }}>
                <QRCodeSVG value={p.passUrl} size={48} level="M" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="type-label" style={{ color: 'var(--ah-ink-3)' }}>
                  {/* Gece vardiyası dün başlamış olabilir — "Bugünkü" yalnız bugün başlayana */}
                  {!p.shiftDate || p.shiftDate === localDateISO() ? 'Bugünkü giriş kartın' : 'Giriş kartın'}
                </div>
                <div className="text-sm font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>
                  {p.businessName} · {annotateShiftText(p.shift, { short: true })}
                </div>
                <div className="text-xs" style={{ color: 'var(--ah-ink-3)' }}>{p.shiftDate}</div>
                {noShow ? (
                  <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: 'var(--ah-ink-3)' }}>
                    <span className="badge badge-negative" data-tone="negative">Gelmedi</span>
                    Bu vardiya için kart kullanılamaz
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: p.usedAt ? 'var(--ah-ok)' : 'var(--ah-ink-3)' }}>
                    {p.usedAt ? `Giriş yapıldı · ${fmtTime(p.usedAt)}` : 'Kapıdaki görevliye okut — dokun, büyüsün'}
                  </div>
                )}
              </div>
            </>
          )
          return noShow ? (
            <div key={p.passUrl} className="card w-full !p-3 flex items-center gap-3 text-left" data-testid="pass-no-show">
              {body}
            </div>
          ) : (
            <button key={p.passUrl} type="button" onClick={() => setOpen(p.passUrl)}
                    className="card w-full !p-3 flex items-center gap-3 text-left transition-colors hover:border-[var(--ah-line-2)]">
              {body}
            </button>
          )
        })}
      </div>

      {current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(17, 24, 39, 0.85)' }} onClick={() => setOpen(null)}
             role="dialog" aria-modal="true" aria-label="Giriş kartı">
          <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: '#ffffff' }}
               onClick={e => e.stopPropagation()}>
            <div className="type-label" style={{ color: 'var(--ah-ink-3)' }}>
              Giriş kartı
            </div>
            <div className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ah-ink)' }}>{current.fullName}</div>
            <div className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>
              {current.businessName} · {annotateShiftText(current.shift)}
            </div>
            <div className="text-xs" style={{ color: 'var(--ah-ink-3)' }}>{current.shiftDate}</div>

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
