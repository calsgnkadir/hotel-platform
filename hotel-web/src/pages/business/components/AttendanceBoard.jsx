import { useState } from 'react'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'

const STATUS_STYLE = {
  'Tamamladı':  { bg: 'var(--ah-ok-soft)',     fg: 'var(--ah-ok)' },
  'İşte':       { bg: 'var(--ah-info-soft)',   fg: 'var(--ah-info)' },
  'Bekleniyor': { bg: 'var(--ah-warn-soft)',   fg: 'var(--ah-warn)' },
  'Gelmedi':    { bg: 'var(--ah-danger-soft)', fg: 'var(--ah-danger)' },
}

/**
 * Yoklama panosu (işletme). Girişler çalışanın kişisel QR kartı okutulunca düşer.
 *
 *  data         : backend AttendanceDto
 *  onMarkArrived: async (applicationId, shiftSlotId) => void
 *  onDownload   : opsiyonel — Excel indir
 */
export default function AttendanceBoard({ data, onMarkArrived, onDownload }) {
  const [busyId, setBusyId] = useState(null)
  const rows = data.rows || []

  async function mark(applicationId, shiftSlotId) {
    setBusyId(applicationId)
    try {
      await onMarkArrived(applicationId, shiftSlotId)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
      {/* Nasıl çalışır — QR çalışanın telefonunda; görevli okutur */}
      <div className="rounded-xl p-3 text-xs space-y-2 self-start"
           style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)', color: 'var(--ah-ink-2)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--ah-ink)' }}>Kapıda giriş</div>
        <p>Her çalışanın uygulamasında vardiya günü kişisel <b>giriş kartı (QR)</b> çıkar.</p>
        <p>Kapıdaki görevli kendi telefon kamerasıyla okutur — giriş saati bu listeye düşer, çalışanın adı ve fotoğrafı görünür.</p>
        <p>Kart tek kullanımlık: ikinci okutmada "zaten kullanıldı" uyarısı çıkar.</p>
        <p>Telefonu olmayanı listeden <b>Geldi</b> ile işaretle.</p>
        {data.meetingPoint && (
          <p className="pt-1 border-t whitespace-pre-line" style={{ borderColor: 'var(--ah-line)' }}>
            <span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Toplanma: </span>
            {data.meetingPoint}
            {data.meetingMinutesBefore ? ` (vardiyadan ${data.meetingMinutesBefore} dk önce)` : ''}
          </p>
        )}
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
                <li key={`${r.applicationId}-${r.shiftSlotId}`} className="py-2 flex items-center gap-3">
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
                  {r.canCheckIn && r.status === 'Bekleniyor' && (
                    <button type="button" onClick={() => mark(r.applicationId, r.shiftSlotId)}
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
