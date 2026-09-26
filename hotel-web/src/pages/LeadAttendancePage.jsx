import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'
import usePageTitle from '../lib/usePageTitle'
import AttendanceBoard from './business/components/AttendanceBoard'

/**
 * Ekip başı yoklama sayfası — hesap gerekmez. İşletme yoklama ekranındaki
 * "Ekip başı linki"ni WhatsApp'tan gönderir; link sadece o ilan + o gün için
 * geçerlidir. QR'ı gösterir, geleni sayar, telefonu olmayanı "Geldi" işaretler.
 */
export default function LeadAttendancePage() {
  const { token } = useParams()
  usePageTitle('Ekip başı yoklama')
  const queryClient = useQueryClient()
  const today = new Date().toLocaleDateString('en-CA')
  const queryKey = ['lead-attendance', token]

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => hotelApi.getLeadAttendance(token),
    refetchInterval: 15000,
    retry: 0,
  })

  async function markArrived(applicationId) {
    await hotelApi.leadCheckIn(token, applicationId)
    await queryClient.invalidateQueries({ queryKey })
  }

  return (
    <div className="min-h-screen ah-surface" style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <header className="px-4 py-3 border-b print:hidden"
              style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <span className="font-bold" style={{ color: 'var(--ah-ink)' }}>Kadrom</span>
          <span className="text-xs" style={{ color: 'var(--ah-ink-4)' }}>· Ekip başı yoklama</span>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5">
        {isLoading && <p className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>Yükleniyor…</p>}
        {error && (
          <div className="card p-6 text-center">
            <p className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Link açılamadı</p>
            <p className="text-sm mt-1" style={{ color: 'var(--ah-ink-2)' }}>{extractErrorMessage(error)}</p>
            <p className="text-xs mt-3" style={{ color: 'var(--ah-ink-4)' }}>İşletmeden bugünün linkini iste.</p>
          </div>
        )}
        {data && (
          <div className="card p-5">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--ah-ink)' }}>{data.listingTitle}</h1>
            <p className="text-sm mb-4" style={{ color: 'var(--ah-ink-3)' }}>
              {new Date(data.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
            </p>
            <AttendanceBoard data={data} canMark={data.date === today} onMarkArrived={markArrived} />
          </div>
        )}
      </main>
    </div>
  )
}
