import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'

const STATUS_STYLE = {
  'Tamamladı':  { bg: 'var(--ah-ok-soft)',     fg: 'var(--ah-ok)' },
  'İşte':       { bg: 'var(--ah-info-soft)',   fg: 'var(--ah-info)' },
  'Bekleniyor': { bg: 'var(--ah-warn-soft)',   fg: 'var(--ah-warn)' },
  'Gelmedi':    { bg: 'var(--ah-danger-soft)', fg: 'var(--ah-danger)' },
}

/**
 * Yoklama panosu (işletme). QR = işletmenin kalıcı giriş QR'ı.
 *
 *  data         : backend AttendanceDto
 *  canMark      : "Geldi" butonu gösterilsin mi (sadece vardiya günü)
 *  onMarkArrived: async (applicationId) => void
 *  onDownload   : opsiyonel — Excel indir
 */
export default function AttendanceBoard({ data, canMark, onMarkArrived, onDownload }) {
  const [busyId, setBusyId] = useState(null)
  const rows = data.rows || []

  async function mark(applicationId) {
    setBusyId(applicationId)
    try {
      await onMarkArrived(applicationId)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
      {/* QR — toplanma noktasında göster ya da yazdırıp as */}
      <div className="text-center">
        <div className="inline-block p-3 rounded-xl bg-white" style={{ border: '1px solid var(--ah-line)' }}>
          <QRCodeSVG value={data.checkinUrl} size={188} level="M" />
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--ah-ink-3)' }}>
          Kalıcı giriş QR'ın — yazdırıp personel girişine as. Gelen herkes okutup adını yazar.
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
          {onDownload && (
            <button type="button" onClick={onDownload}
                    className="ml-auto text-xs font-semibold underline print:hidden" style={{ color: 'var(--ah-ink)' }}>
              Excel indir
            </button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>Bu tarihte kabul edilmiş aday yok.</p>
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
                  {canMark && r.status === 'Bekleniyor' && (
                    <button type="button" onClick={() => mark(r.applicationId)}
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
  )
}
