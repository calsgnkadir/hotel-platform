import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../api/client'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState('loading')  // loading | success | error
  const [message, setMessage] = useState('')
  // React StrictMode dev'de useEffect'i 2x calistirir token tek kullanimlik
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
    <div className="min-h-screen flex items-center justify-center p-4 text-white relative z-10">
      <div className="w-full max-w-md p-8 text-center"
           style={{
             background: '#1b1815',
             borderRadius: '12px',
             border: 'none',
             boxShadow: '0 32px 72px rgba(0, 0, 0, 0.45)',
           }}>
        <h1 className="text-2xl font-bold mb-3" style={{ color: '#f5efe2' }}>
          Email Doğrulama
        </h1>

        {state === 'loading' && (
          <div className="py-6">
            <div className="inline-block w-8 h-8 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm" style={{ color: '#928678' }}>Doğrulanıyor...</p>
          </div>
        )}

        {state === 'success' && (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#7a9f7a" strokeWidth={2} className="w-12 h-12 mb-3 mx-auto"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            <p className="text-sm mb-6" style={{ color: '#f5efe2' }}>{message}</p>
            <Link to="/login" className="inline-block px-5 py-2.5 rounded-full text-white font-semibold text-sm"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    color: '#1a1208',
                    boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
                  }}>
              Giriş Yap
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} className="w-12 h-12 mb-3 mx-auto"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
            <p className="text-sm mb-6" style={{ color: '#f5efe2' }}>{message}</p>
            <Link to="/login" className="inline-block px-5 py-2.5 rounded-full text-white font-semibold text-sm"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    color: '#1a1208',
                    boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
                  }}>
              Giriş Yap
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
