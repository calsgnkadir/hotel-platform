/**
 * Belgeyi sohbetten gönder.
 *
 * İşletme belgeyi (adli sicil, hijyen raporu...) sohbette normal mesajla ister;
 * aday kompozerdeki belge menüsünden yüklü belgesini tek tıkla gönderir.
 * Paylaşım = o başvuru için o belge tipine izin; işletme karttaki "Görüntüle"
 * ile açar (erişim kontrolü backend'de). Ayrı "talep → onay" adımı yok.
 *
 * Mesaj token'ı (backend ChatDocumentService üretir): [DOC_SHARED:42:CRIMINAL_RECORD]
 */
import { useState } from 'react'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import toast from 'react-hot-toast'
import { formatTime } from './utils'

export const CHAT_DOC_LABELS = {
  CRIMINAL_RECORD:     'Adli sicil kaydı',
  HEALTH_CERTIFICATE:  'Hijyen / sağlık belgesi',
  IDENTITY_DOCUMENT:   'Kimlik',
  CV:                  'CV',
  STUDENT_CERTIFICATE: 'Öğrenci belgesi',
  TRANSCRIPT:          'Transkript',
}

export function parseDocToken(content) {
  if (!content) return null
  const m = content.match(/^\[DOC_SHARED:(\d+):([A-Z_]+)\]$/)
  return m ? { documentId: Number(m[1]), type: m[2] } : null
}

const DOC_ICON = 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'

/** Sohbet içindeki "belge paylaşıldı" kartı. */
export function DocumentCardBubble({ m, doc }) {
  const mine = m.mine
  const label = CHAT_DOC_LABELS[doc.type] || 'Belge'
  const [busy, setBusy] = useState(false)

  async function handleView() {
    setBusy(true)
    try {
      await hotelApi.viewDocument(doc.documentId)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl text-sm overflow-hidden ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
           style={{
             background: mine ? '#1f2937' : '#ffffff',
             color: mine ? '#ffffff' : 'var(--ah-ink)',
             border: `1px solid ${mine ? '#1f2937' : 'var(--ah-line)'}`,
           }}>
        <div className="flex items-center gap-3 px-4 py-3"
             style={{ background: mine ? 'rgba(255, 255, 255, 0.08)' : 'var(--ah-page)' }}>
          <div className="w-10 h-10 rounded-full grid place-items-center shrink-0"
               style={{ background: mine ? 'rgba(255, 255, 255, 0.14)' : 'var(--ah-brand-soft)', color: mine ? '#ffffff' : '#1f2937' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" strokeWidth={1.8}
                 stroke="currentColor" className="w-5 h-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={DOC_ICON} />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">{label}</div>
            <div className="text-[11px]" style={{ color: mine ? 'rgba(255, 255, 255, 0.65)' : 'var(--ah-ink-4)' }}>
              {mine ? 'Gönderdin — işletme görebilir' : 'Aday belgeyi gönderdi'} · {formatTime(m.sentAt)}
            </div>
          </div>
        </div>
        <button type="button" onClick={handleView} disabled={busy}
                className="w-full px-4 py-2.5 text-sm font-semibold border-t transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: '#111827', color: '#ffffff', borderColor: mine ? 'rgba(255, 255, 255, 0.14)' : 'var(--ah-line)' }}>
          {busy ? 'Bekle…' : 'Görüntüle'}
        </button>
      </div>
    </div>
  )
}
