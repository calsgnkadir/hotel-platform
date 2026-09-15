// Telefon doğrulama (OTP) — opsiyonel. Kendi durumunu çeker; kayıt akışını etkilemez.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../api/hotel'
import { extractErrorMessage } from '../api/client'

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function PhoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

export default function PhoneVerifyCard() {
  const [status, setStatus] = useState(null)   // { phone, verified, hasPhone }
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')

  async function load() {
    setLoading(true)
    try { setStatus(await hotelApi.getPhoneStatus()) }
    catch { setStatus(null) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function handleSend() {
    setSending(true)
    try {
      await hotelApi.sendPhoneCode()
      setCodeSent(true)
      toast.success('Doğrulama kodu gönderildi.')
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setSending(false) }
  }

  async function handleVerify(e) {
    e?.preventDefault?.()
    if (code.trim().length < 4) { toast.error('Kodu gir'); return }
    setVerifying(true)
    try {
      const res = await hotelApi.verifyPhoneCode(code.trim())
      setStatus(res)
      if (res.verified) { toast.success('Telefonun doğrulandı.'); setCodeSent(false); setCode('') }
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setVerifying(false) }
  }

  if (loading || !status) {
    return (
      <div className="card p-5" style={{ color: 'var(--ah-ink-3)', fontSize: 13 }}>
        Telefon durumu yükleniyor…
      </div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: 'var(--ah-ink-3)' }}><PhoneIcon /></span>
        <h3 className="font-display text-[16px] font-semibold" style={{ color: 'var(--ah-ink)' }}>Telefon Doğrulama</h3>
      </div>

      {status.verified ? (
        <div className="flex items-center gap-2 mt-2 text-[13.5px]" style={{ color: 'var(--ah-ink-2)' }}>
          <span className="inline-flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 22, height: 22, background: 'var(--ah-brand)', color: '#fff' }}>
            <CheckIcon />
          </span>
          <span><b>Doğrulandı</b>{status.phone ? ` · ${status.phone}` : ''}</span>
        </div>
      ) : !status.hasPhone ? (
        <p className="text-[13px] mt-2" style={{ color: 'var(--ah-ink-3)' }}>
          Önce “Bilgilerim” sekmesinden telefon numaranı ekle; sonra buradan doğrulayabilirsin.
        </p>
      ) : (
        <>
          <p className="text-[13px] mt-1" style={{ color: 'var(--ah-ink-3)' }}>
            Numaran{status.phone ? ` (${status.phone})` : ''} için SMS ile kod gönderelim.
            Doğrulanan adaylar işletmelerde daha güvenilir görünür.
          </p>

          {!codeSent ? (
            <button type="button" onClick={handleSend} disabled={sending}
              className="mt-3 px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
              style={{ background: 'var(--ah-brand-gradient)', boxShadow: 'var(--elev-1)' }}>
              {sending ? 'Gönderiliyor…' : 'Kod gönder'}
            </button>
          ) : (
            <form onSubmit={handleVerify} className="mt-3 space-y-2">
              <label className="text-[12px] font-semibold" style={{ color: 'var(--ah-ink-3)' }}>SMS ile gelen 6 haneli kod</label>
              <div className="flex items-center gap-2 flex-wrap">
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                       value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                       placeholder="______"
                       className="input text-center tracking-[0.4em] font-mono"
                       style={{ width: 140, letterSpacing: '0.4em' }} />
                <button type="submit" disabled={verifying}
                  className="px-4 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-60"
                  style={{ background: 'var(--ah-brand)' }}>
                  {verifying ? 'Doğrulanıyor…' : 'Doğrula'}
                </button>
                <button type="button" onClick={handleSend} disabled={sending}
                  className="px-3 py-2 text-sm font-semibold rounded-lg disabled:opacity-60"
                  style={{ background: '#fff', color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line-2)' }}>
                  Tekrar gönder
                </button>
              </div>
              <p className="text-[11.5px]" style={{ color: 'var(--ah-ink-4)' }}>
                Kod gelmezse bir dakika sonra tekrar iste. 10 dakika geçerli.
              </p>
            </form>
          )}
        </>
      )}
    </div>
  )
}
