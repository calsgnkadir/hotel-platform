import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState('loading')  // loading | success | error
  const [message, setMessage] = useState('')
  // React StrictMode dev'de useEffect'i 2x calistirir → token tek kullanimlik
  // oldugu icin 2. cagri 'kullanilmis' hatasi alir. useRef ile guard'liyoruz.
  const calledRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setState('error')
      setMessage('Token bulunamadı.')
      return
    }
    if (calledRef.current) return
    calledRef.current = true

    api.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((r) => {
        setState('success')
        setMessage(r.data?.message || 'Email başarıyla doğrulandı.')
      })
      .catch((e) => {
        setState('error')
        setMessage(e?.response?.data?.message || 'Doğrulama başarısız.')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-brand-200 p-8 text-center">
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#0c1726' }}>
          Email Doğrulama
        </h1>

        {state === 'loading' && (
          <div className="py-6">
            <div className="inline-block w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm" style={{ color: '#1e3a5f' }}>Doğrulanıyor...</p>
          </div>
        )}

        {state === 'success' && (
          <>
            <div className="text-5xl mb-3">✓</div>
            <p className="text-sm mb-6" style={{ color: '#0c1726' }}>{message}</p>
            <Link to="/login" className="inline-block px-5 py-2.5 rounded-full text-white font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#b8902d)' }}>
              Giriş Yap
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="text-5xl mb-3">⚠</div>
            <p className="text-sm mb-6" style={{ color: '#0c1726' }}>{message}</p>
            <Link to="/login" className="inline-block px-5 py-2.5 rounded-full text-white font-semibold text-sm"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#b8902d)' }}>
              Giriş Yap
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
