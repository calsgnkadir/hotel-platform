import { useEffect, useRef, useState } from 'react'
import api from '../../api/client'

export default function PrivateAttachment({ message }) {
  const [url, setUrl] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const active = useRef(true)
  const objectUrl = useRef(null)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
    }
  }, [])

  async function load() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      // Construct a trusted API path: never fetch a stored external attachment URL.
      if (!/^\/api\/messages\/conversations\/\d+\/messages\/\d+\/attachment$/.test(message.attachmentUrl)) {
        throw new Error('Eski dosyanın güvenli depolamaya taşınması gerekiyor. Yeniden paylaşılmasını isteyebilirsiniz.')
      }
      const { data } = await api.get(message.attachmentUrl, { responseType: 'blob' })
      if (!active.current) return
      objectUrl.current = URL.createObjectURL(data)
      setUrl(objectUrl.current)
    } catch (err) {
      let text = err.message || 'Dosya alınamadı. Tekrar deneyin.'
      if (err.response?.data instanceof Blob) {
        try { text = JSON.parse(await err.response.data.text()).message || text } catch { /* generic error */ }
      }
      if (active.current) setError(text)
    } finally {
      if (active.current) setBusy(false)
    }
  }

  return <div className="px-3 py-2.5 space-y-2">
    <div className="text-sm font-semibold break-all">{message.attachmentName || 'Dosya'}</div>
    {message.attachmentSize > 0 && <div className="text-xs opacity-75">{Math.ceil(message.attachmentSize / 1024)} KB</div>}
    {!url && <button type="button" onClick={load} disabled={busy} className="underline text-sm disabled:opacity-60">
      {busy ? 'Dosya açılıyor…' : 'Dosyayı aç'}
    </button>}
    {error && <p role="alert" className="text-xs">{error}</p>}
    {url && message.attachmentType === 'image' && <img src={url} alt={message.attachmentName || 'Sohbet fotoğrafı'} className="max-h-72 max-w-full object-contain" />}
    {url && message.attachmentType === 'audio' && <audio controls src={url} className="max-w-full" />}
    {url && <a href={url} download={message.attachmentName || 'dosya'} className="block underline text-sm">Dosyayı indir</a>}
  </div>
}
