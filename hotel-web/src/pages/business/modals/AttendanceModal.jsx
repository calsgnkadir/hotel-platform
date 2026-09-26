import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import useFocusTrap from '../../../lib/useFocusTrap'

const STATUS_STYLE = {
  'Tamamladı':  { bg: 'var(--ah-ok-soft)',     fg: 'var(--ah-ok)' },
  'İşte':       { bg: 'var(--ah-info-soft)',   fg: 'var(--ah-info)' },
  'Bekleniyor': { bg: 'var(--ah-warn-soft)',   fg: 'var(--ah-warn)' },
  'Gelmedi':    { bg: 'var(--ah-danger-soft)', fg: 'var(--ah-danger)' },
}

/**
 * Yoklama (ekip başı ekranı). Toplanma noktasında QR'ı göster/yazdır; adaylar
 * telefon kamerasıyla okutup giriş yapar. Liste 15 sn'de bir yenilenir;
 * telefonu olmayanı "Geldi" ile elle işaretle.
 */
export default function AttendanceModal({ listing, onClose }) {
  const today = new Date().toLocaleDateString('en-CA')   // YYYY-MM-DD (yerel)
  const [date, setDate] = useState(today)
  const [busyId, setBusyId] = useState(null)
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, true, onClose)

  const queryKey = ['attendance', listing.id, date]
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => hotelApi.getAttendance(listing.id, date),
    refetchInterval: date === today ? 15000 : false,
  })

  async function markArrived(applicationId) {
    setBusyId(applicationId)
    try {
      await hotelApi.manualCheckIn(applicationId)
      await queryClient.invalidateQueries({ queryKey })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const rows = data?.rows || []
  const isToday = date === today

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="attendance-title"
           className="modal-content max-h-[92vh] overflow-y-auto" style={{ maxWidth: 720 }}
           onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-hairline flex items-start justify-between gap-3 print:hidden">
          <div className="min-w-0">
            <h2 id="attendance-title" className="text-lg font-bold" style={{ color: 'var(--ah-ink)' }}>Yoklama</h2>
            <p className="text-sm truncate" style={{ color: 'var(--ah-ink-3)' }}>{listing.title}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
                   className="input text-sm !py-1.5" aria-label="Tarih" />
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg"
                    style={{ border: '1px solid var(--ah-line)', color: 'var(--ah-ink-2)' }}>
              Kapat
            </button>
          </div>
        </div>

        {isLoading && <p className="p-6 text-sm" style={{ color: 'var(--ah-ink-3)' }}>Yükleniyor…</p>}
        {error && <p className="p-6 text-sm" style={{ color: 'var(--ah-danger)' }}>{extractErrorMessage(error)}</p>}

        {data && (
          <div className="p-5 grid gap-5 sm:grid-cols-[220px_1fr]">
            {/* QR — toplanma noktasında göster ya da yazdırıp as */}
            <div className="text-center">
              <div className="inline-block p-3 rounded-xl bg-white" style={{ border: '1px solid var(--ah-line)' }}>
                <QRCodeSVG value={data.checkinUrl} size={188} level="M" />
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--ah-ink-3)' }}>
                {isToday ? 'Adaylar telefon kamerasıyla okutsun' : 'Sadece bu tarihte geçerli'}
              </p>
              {data.meetingPoint && (
                <p className="text-xs mt-2 text-left rounded-lg p-2 whitespace-pre-line"
                   style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)', color: 'var(--ah-ink-2)' }}>
                  <span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Toplanma: </span>
                  {data.meetingPoint}
                  {data.meetingMinutesBefore ? ` (vardiyadan ${data.meetingMinutesBefore} dk önce)` : ''}
                </p>
              )}
              <button type="button" onClick={() => window.print()}
                      className="mt-3 text-xs font-semibold underline print:hidden" style={{ color: 'var(--ah-ink)' }}>
                QR'ı yazdır
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-semibold tabular-nums" style={{ color: 'var(--ah-ink)' }}>
                  {data.arrived}
                </span>
                <span className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>/ {data.expected} geldi</span>
                <button type="button" onClick={() => hotelApi.downloadRoster(listing.id, date).catch(e => toast.error(extractErrorMessage(e)))}
                        className="ml-auto text-xs font-semibold underline print:hidden" style={{ color: 'var(--ah-ink)' }}>
                  Excel indir
                </button>
              </div>

              {rows.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>
                  Bu tarihte kabul edilmiş aday yok.
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--ah-line)' }}>
                  {rows.map(r => {
                    const st = STATUS_STYLE[r.status] || STATUS_STYLE['Bekleniyor']
                    return (
                      <li key={`${r.applicationId}-${r.shift}`} className="py-2 flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate" style={{ color: 'var(--ah-ink)' }}>{r.fullName}</div>
                          <div className="text-[11px]" style={{ color: 'var(--ah-ink-4)' }}>
                            {r.shift}{r.phone ? ` · ${r.phone}` : ''}{r.clockIn ? ` · giriş ${r.clockIn}` : ''}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: st.bg, color: st.fg }}>
                          {r.status}
                        </span>
                        {isToday && r.status === 'Bekleniyor' && (
                          <button type="button" onClick={() => markArrived(r.applicationId)}
                                  disabled={busyId === r.applicationId}
                                  className="text-xs font-semibold px-2.5 py-1 rounded-lg disabled:opacity-60 print:hidden"
                                  style={{ background: '#1f2937', color: '#ffffff' }}>
                            Geldi
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
