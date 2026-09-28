import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import useFocusTrap from '../../../lib/useFocusTrap'
import AttendanceBoard from '../components/AttendanceBoard'

/**
 * Yoklama (işletme). Görevli çalışanın kişisel kartını okutur;
 * telefonu olmayanı ilgili vardiyanın "Geldi" düğmesiyle işaretler.
 */
export default function AttendanceModal({ listing, onClose }) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' })
  const [date, setDate] = useState(today)
  const queryClient = useQueryClient()
  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, true, onClose)

  const queryKey = ['attendance', listing.id, date]
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => hotelApi.getAttendance(listing.id, date),
    refetchInterval: 15000,
  })

  async function markArrived(applicationId, shiftSlotId) {
    await hotelApi.manualCheckIn(applicationId, shiftSlotId)
    await queryClient.invalidateQueries({ queryKey })
  }

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
          <div className="p-5 space-y-5">
            <AttendanceBoard
              data={data}
              onMarkArrived={markArrived}
              onDownload={() => hotelApi.downloadRoster(listing.id, date).catch(e => toast.error(extractErrorMessage(e)))}
            />

          </div>
        )}
      </div>
    </div>
  )
}
