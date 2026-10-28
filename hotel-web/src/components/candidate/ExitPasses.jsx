import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import * as hotelApi from '../../api/hotel'
import { annotateShiftText } from '../../lib/shiftTime'

/** An exit card belongs to one open session. A fresh card is fetched while visible. */
export default function ExitPasses({ onSessionChange }) {
  const [openId, setOpenId] = useState(null)
  const { data: passes = [], isPending, isError, refetch } = useQuery({
    queryKey: ['exit-passes'],
    queryFn: hotelApi.getMyExitPasses,
    refetchInterval: openId == null ? 30000 : 15000,
    refetchOnWindowFocus: true,
    retry: 1,
  })
  const current = passes.find(p => String(p.sessionId) === String(openId))
  const sessionIds = JSON.stringify(passes.map(p => String(p.sessionId)).sort())
  const previousSessionIds = useRef(null)

  useEffect(() => {
    if (isPending || isError) return
    if (previousSessionIds.current !== null && previousSessionIds.current !== sessionIds) {
      onSessionChange?.()
    }
    previousSessionIds.current = sessionIds
  }, [sessionIds, isPending, isError, onSessionChange])

  if (isPending && !passes.length) return <p role="status" className="type-meta mb-3">Çıkış kartları kontrol ediliyor…</p>
  if (!isError && !passes.length && openId == null) return null

  return <div className="space-y-2 mb-4">
    {isError && <div className="card p-3" role="alert">
      <p>Çıkış kartları alınamadı. Bağlantını kontrol et.</p>
      <button className="btn-secondary mt-2" type="button" onClick={() => refetch()}>Tekrar dene</button>
    </div>}
    {!isError && passes.map(p => <button key={p.sessionId} type="button"
      onClick={() => setOpenId(p.sessionId)} className="card w-full !p-3 flex items-center gap-3 text-left">
      <span className="p-1.5 rounded-lg bg-white shrink-0" style={{ border: '1px solid var(--ah-line)' }}>
        <QRCodeSVG value={p.passUrl} size={48} level="M" />
      </span>
      <span className="min-w-0">
        <span className="type-label block">Çıkış kartın</span>
        <span className="text-sm font-semibold block">{p.businessName} · {annotateShiftText(p.shift, { short: true })}</span>
        <span className="text-xs block">Mesai bitiminde görevliye okutmak için aç</span>
      </span>
    </button>)}
    {openId != null && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(17, 24, 39, 0.85)' }} role="dialog" aria-modal="true" aria-label="Çıkış kartı"
      onClick={() => setOpenId(null)}>
      <div className="w-full max-w-sm rounded-2xl p-6 text-center" style={{ background: '#fff' }} onClick={e => e.stopPropagation()}>
        <div className="type-label">Çıkış kartı</div>
        {isError ? <p role="alert" className="mt-3">Kart yenilenemedi. Bağlantını kontrol edip tekrar dene.</p>
          : current ? <>
            <div className="text-lg font-semibold mt-1">{current.fullName}</div>
            <div className="text-sm">{current.businessName} · {annotateShiftText(current.shift)}</div>
            <div className="inline-block mt-4 p-3 rounded-xl bg-white" style={{ border: '1px solid var(--ah-line)' }}>
              <QRCodeSVG value={current.passUrl} size={240} level="M" />
            </div>
            <p className="text-xs mt-3">Mesai bitiminde işletme görevlisine okut. Kart otomatik yenilenir.</p>
          </> : <p role="status" className="mt-3">Bu mesai için açık çıkış kartı artık bulunmuyor. Mesai durumunu kontrol et.</p>}
        {isError && <button type="button" className="btn-secondary mt-3" onClick={() => refetch()}>Tekrar dene</button>}
        <button type="button" onClick={() => setOpenId(null)} className="mt-4 w-full py-2.5 rounded-lg text-sm font-semibold"
          style={{ border: '1px solid var(--ah-line)' }}>Kapat</button>
      </div>
    </div>}
  </div>
}
