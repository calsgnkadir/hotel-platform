import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import usePageTitle from '../../lib/usePageTitle'

/**
 * Giriş QR'ı — işletmenin personel girişinde asılı kalıcı QR bu sayfayı açar.
 *  - Aday hesabıyla girişliyse: giriş otomatik yazılır.
 *  - Değilse: ad soyad sorulur; bugünün listesinde varsa giriş yazılır.
 *    Aynı isimden birden fazla kişi varsa telefonun son 4 hanesi istenir.
 */
export default function CheckInPage() {
  const { token } = useParams()
  const { user, loading: authLoading } = useAuth()
  usePageTitle('Giriş')
  const [businessName, setBusinessName] = useState('')
  const [state, setState] = useState({ status: 'idle' })
  const [fullName, setFullName] = useState('')
  const [phoneLast4, setPhoneLast4] = useState('')
  const [needPhone, setNeedPhone] = useState(false)
  const autoStarted = useRef(false)

  useEffect(() => {
    hotelApi.getCheckInInfo(token)
      .then(d => setBusinessName(d.businessName))
      .catch(err => setState({ status: 'error', message: extractErrorMessage(err) }))
  }, [token])

  // Aday girişliyse ad sormadan otomatik (StrictMode çift çağrısında tek istek)
  useEffect(() => {
    if (authLoading || autoStarted.current || user?.role !== 'CANDIDATE') return
    autoStarted.current = true
    setState({ status: 'loading' })
    hotelApi.candidateCheckIn(token)
      .then(result => setState({ status: 'ok', result }))
      .catch(err => setState({ status: 'error', message: extractErrorMessage(err) }))
  }, [authLoading, user, token])

  async function submitName(e) {
    e.preventDefault()
    if (fullName.trim().length < 3) return
    setState({ status: 'loading' })
    try {
      const result = await hotelApi.checkInByName(token, fullName.trim(), needPhone ? phoneLast4 : null)
      if (result.needPhone) {
        setNeedPhone(true)
        setState({ status: 'idle' })
        return
      }
      setState({ status: 'ok', result })
    } catch (err) {
      setState({ status: 'form-error', message: extractErrorMessage(err) })
    }
  }

  const time = state.result?.clockInAt
    ? new Date(state.result.clockInAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null
  const showForm = user?.role !== 'CANDIDATE' && ['idle', 'form-error'].includes(state.status)

  return (
    <div className="min-h-screen ah-surface flex items-center justify-center px-4"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <div className="card w-full max-w-sm p-6">
        <div className="text-center mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.06em]" style={{ color: 'var(--ah-ink-4)' }}>
            Personel girişi
          </div>
          <div className="text-lg font-semibold mt-0.5" style={{ color: 'var(--ah-ink)' }}>
            {businessName || '…'}
          </div>
        </div>

        {showForm && (
          <form onSubmit={submitName} className="space-y-3">
            <div>
              <label className="label" htmlFor="ci-name">Adın soyadın</label>
              <input id="ci-name" className="input" value={fullName} autoFocus autoComplete="name"
                     onChange={e => setFullName(e.target.value)} placeholder="Listede yazdığı gibi" />
            </div>
            {needPhone && (
              <div>
                <label className="label" htmlFor="ci-phone">Telefonunun son 4 hanesi</label>
                <input id="ci-phone" className="input" inputMode="numeric" maxLength={4}
                       value={phoneLast4} onChange={e => setPhoneLast4(e.target.value.replace(/\D/g, ''))}
                       placeholder="örn. 4521" />
                <p className="text-[11px] mt-1" style={{ color: 'var(--ah-ink-4)' }}>
                  Bugünün listesinde bu isimden birden fazla kişi var.
                </p>
              </div>
            )}
            {state.status === 'form-error' && (
              <p className="text-sm rounded-lg p-2.5"
                 style={{ background: 'var(--ah-danger-soft)', color: 'var(--ah-danger)' }}>
                {state.message}
              </p>
            )}
            <button type="submit" className="w-full py-2.5 rounded-lg text-sm font-semibold text-white"
                    style={{ background: '#1f2937' }}>
              Giriş yap
            </button>
            <p className="text-[11px] text-center" style={{ color: 'var(--ah-ink-4)' }}>
              Kadrom hesabın varsa <Link to="/login" state={{ from: { pathname: `/checkin/${token}` } }}
                className="underline font-semibold" style={{ color: 'var(--ah-ink)' }}>giriş yap</Link>, ad sormadan kaydolur.
            </p>
          </form>
        )}

        {state.status === 'loading' && (
          <p className="text-sm text-center" style={{ color: 'var(--ah-ink-3)' }}>Giriş kaydediliyor…</p>
        )}

        {state.status === 'ok' && (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-4"
                 style={{ background: 'var(--ah-ok-soft)', color: 'var(--ah-ok)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                   strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--ah-ink)' }}>
              {state.result.alreadyCheckedIn ? 'Girişin zaten kayıtlı' : `Hoş geldin, ${(state.result.fullName || '').split(' ')[0]}`}
            </h1>
            <p className="text-3xl font-semibold tabular-nums mt-2" style={{ color: 'var(--ah-ink)' }}>{time}</p>
            <p className="text-sm mt-3">{state.result.listingTitle}</p>
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
          </div>
        )}

        {state.status === 'error' && (
          <div className="text-center">
            <h1 className="text-lg font-semibold" style={{ color: 'var(--ah-ink)' }}>Giriş yapılamadı</h1>
            <p className="text-sm mt-2">{state.message}</p>
            <p className="text-xs mt-4" style={{ color: 'var(--ah-ink-4)' }}>
              Sorun sürerse işletmeye adını söyle; seni listeden elle işaretleyebilir.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
