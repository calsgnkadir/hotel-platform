import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import usePageTitle from '../../lib/usePageTitle'

/**
 * QR yoklama — aday toplanma noktasındaki QR'ı telefon kamerasıyla okutur,
 * bu sayfa açılır ve giriş kaydı otomatik yapılır. (Giriş yapmamışsa
 * ProtectedRoute önce login'e götürür, sonra buraya geri döner.)
 */
export default function CheckInPage() {
  const { token } = useParams()
  usePageTitle('Yoklama')
  const [state, setState] = useState({ status: 'loading' })
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return   // StrictMode çift çağrısında tek istek
    started.current = true
    hotelApi.candidateCheckIn(token)
      .then(result => setState({ status: 'ok', result }))
      .catch(err => setState({ status: 'error', message: extractErrorMessage(err) }))
  }, [token])

  const time = state.result?.clockInAt
    ? new Date(state.result.clockInAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="min-h-screen ah-surface flex items-center justify-center px-4"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <div className="card w-full max-w-sm p-6 text-center">
        {state.status === 'loading' && (
          <p className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>Giriş kaydediliyor…</p>
        )}

        {state.status === 'ok' && (
          <>
            <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-4"
                 style={{ background: 'var(--ah-ok-soft)', color: 'var(--ah-ok)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--ah-ink)' }}>
              {state.result.alreadyCheckedIn ? 'Girişin zaten kayıtlı' : 'Giriş yapıldı'}
            </h1>
            <p className="text-3xl font-semibold tabular-nums mt-2" style={{ color: 'var(--ah-ink)' }}>{time}</p>
            <p className="text-sm mt-3" style={{ color: 'var(--ah-ink-2)' }}>
              <strong style={{ color: 'var(--ah-ink)' }}>{state.result.businessName}</strong>
              {' · '}{state.result.listingTitle}
            </p>
            {state.result.shift && (
              <p className="text-sm mt-1" style={{ color: 'var(--ah-ink-3)' }}>Vardiya: {state.result.shift}</p>
            )}
            {state.result.meetingPoint && (
              <p className="text-sm mt-3 rounded-lg p-3 text-left whitespace-pre-line"
                 style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)' }}>
                <span className="font-semibold" style={{ color: 'var(--ah-ink)' }}>Toplanma: </span>
                {state.result.meetingPoint}
              </p>
            )}
            <p className="text-xs mt-4" style={{ color: 'var(--ah-ink-4)' }}>
              Ekip başına görün. Çıkışı panelden "Mesaiyi bitir" ile yaparsın.
            </p>
          </>
        )}

        {state.status === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-4"
                 style={{ background: 'var(--ah-danger-soft)', color: 'var(--ah-danger)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" className="w-7 h-7" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--ah-ink)' }}>Giriş yapılamadı</h1>
            <p className="text-sm mt-2" style={{ color: 'var(--ah-ink-2)' }}>{state.message}</p>
            <p className="text-xs mt-4" style={{ color: 'var(--ah-ink-4)' }}>
              Sorun sürerse ekip başına adını söyle; seni listeden elle işaretleyebilir.
            </p>
          </>
        )}

        <Link to="/candidate?tab=applications" className="inline-block mt-5 text-sm font-semibold underline"
              style={{ color: 'var(--ah-ink)' }}>
          Başvurularıma git
        </Link>
      </div>
    </div>
  )
}
