import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import usePageTitle from '../../lib/usePageTitle'

const fmtTime = iso => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })

/**
 * Görevli ekranı — kapıdaki otel görevlisi çalışanın giriş kartını (QR) kendi
 * telefon kamerasıyla okutunca bu sayfa açılır (işletme hesabıyla). Giriş
 * yazılır; ad + fotoğraf gösterilir ki görevli yüzü karşılaştırsın. Kart tek
 * kullanımlık: ikinci okutmada "zaten kullanıldı" uyarısı çıkar.
 */
export default function ScanPassPage() {
  const { token } = useParams()
  usePageTitle('Giriş kartı')
  const [resultState, setState] = useState({ status: 'loading' })
  const request = useRef(null)
  const state = resultState.token === token ? resultState : { status: 'loading' }

  useEffect(() => {
    let active = true
    // Reuse the in-flight request during StrictMode's effect replay, but scan new tokens.
    if (request.current?.token !== token) {
      request.current = { token, promise: hotelApi.scanPass(token) }
    }
    setState({ status: 'loading', token })
    request.current.promise
      .then(result => { if (active) setState({ status: 'ok', token, result }) })
      .catch(err => { if (active) setState({ status: 'error', token, message: extractErrorMessage(err) }) })
    return () => { active = false }
  }, [token])

  const r = state.result
  const tone = state.status === 'error' ? 'danger' : r?.alreadyUsed ? 'warn' : 'ok'

  return (
    <div className="min-h-screen ah-surface flex items-center justify-center px-4"
         style={{ background: 'var(--ah-page)', color: 'var(--ah-ink-2)' }}>
      <div className="card w-full max-w-sm p-6 text-center">
        {state.status === 'loading' && (
          <p className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>Kart okunuyor…</p>
        )}

        {state.status !== 'loading' && (
          <div className="rounded-xl px-4 py-3 mb-4 text-sm font-semibold"
               style={{ background: `var(--ah-${tone}-soft)`, color: `var(--ah-${tone})`, border: `1px solid var(--ah-${tone})` }}>
            {state.status === 'error' ? 'Geçersiz kart'
              : r.alreadyUsed ? `Bu kart zaten kullanıldı · ${fmtTime(r.clockInAt)}`
              : `Giriş yazıldı · ${fmtTime(r.clockInAt)}`}
          </div>
        )}

        {state.status === 'ok' && (
          <>
            {r.photoUrl ? (
              <img src={r.photoUrl} alt={r.fullName}
                   className="w-28 h-28 rounded-full object-cover mx-auto" style={{ border: '1px solid var(--ah-line)' }} />
            ) : (
              <div className="w-28 h-28 rounded-full mx-auto grid place-items-center text-3xl font-semibold"
                   style={{ background: 'var(--ah-brand-soft)', color: 'var(--ah-ink)' }}>
                {(r.fullName || '?').trim().charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-xl font-semibold mt-3" style={{ color: 'var(--ah-ink)' }}>{r.fullName}</h1>
            <p className="text-sm mt-1">{r.listingTitle}</p>
            <p className="text-sm" style={{ color: 'var(--ah-ink-3)' }}>Vardiya: {r.shift}</p>
            <p className="text-xs mt-3" style={{ color: 'var(--ah-ink-4)' }}>
              {r.photoUrl ? 'Fotoğrafla yüzü karşılaştır.' : 'Profil fotoğrafı yok — kimliğine bakabilirsin.'}
            </p>
          </>
        )}

        {state.status === 'error' && (
          <p className="text-sm">{state.message}</p>
        )}

        <Link to="/business?tab=listings" className="inline-block mt-5 text-sm font-semibold underline"
              style={{ color: 'var(--ah-ink)' }}>
          Yoklama listesine git
        </Link>
      </div>
    </div>
  )
}
