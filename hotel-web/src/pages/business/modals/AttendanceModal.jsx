import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import useFocusTrap from '../../../lib/useFocusTrap'
import AttendanceBoard from '../components/AttendanceBoard'

/**
 * Yoklama (işletme). Toplanma noktasında QR'ı göster/yazdır; herkes telefonuyla
 * okutup giriş yapar. Liste 15 sn'de bir yenilenir; telefonu olmayanı "Geldi"
 * ile işaretle. Sahada işletme yoksa "Ekip başı linki"ni WhatsApp'tan gönder:
 * ekip başı hesap açmadan aynı ekranı kullanır (sadece o ilan + o gün).
 */
export default function AttendanceModal({ listing, onClose }) {
  const today = new Date().toLocaleDateString('en-CA')   // YYYY-MM-DD (yerel)
  const [date, setDate] = useState(today)
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
    await hotelApi.manualCheckIn(applicationId)
    await queryClient.invalidateQueries({ queryKey })
  }

  async function copyLeadLink() {
    try {
      await navigator.clipboard.writeText(data.leadUrl)
      toast.success('Ekip başı linki kopyalandı')
    } catch {
      toast.error('Kopyalanamadı — linki elle seç')
    }
  }

  const waText = data?.leadUrl
    ? encodeURIComponent(`${listing.title} — ${date} yoklama linki (ekip başı): ${data.leadUrl}`)
    : ''

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
              canMark={date === today}
              onMarkArrived={markArrived}
              onDownload={() => hotelApi.downloadRoster(listing.id, date).catch(e => toast.error(extractErrorMessage(e)))}
            />

            {/* Ekip başı: hesapsız link — sahadaki sorumluya gönder */}
            {data.leadUrl && (
              <div className="rounded-xl p-3 print:hidden"
                   style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--ah-ink)' }}>Ekip başı linki</div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
                  Sahadaki sorumluya gönder: hesap açmadan bu QR'ı gösterir, kimin geldiğini görür,
                  telefonu olmayanı "Geldi" işaretler. Sadece bu ilan ve {date} için geçerli.
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <button type="button" onClick={copyLeadLink}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ background: '#1f2937', color: '#ffffff' }}>
                    Linki kopyala
                  </button>
                  <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer"
                     className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                     style={{ border: '1px solid var(--ah-line)', color: 'var(--ah-ink)' }}>
                    WhatsApp ile gönder
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
