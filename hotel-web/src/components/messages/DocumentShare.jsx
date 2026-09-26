/**
 * Belgeyi sohbetten iste / gönder.
 *
 * İşletme "Belge iste" der → sohbete istek kartı düşer. Aday karttaki
 * "Belgeyi gönder" ile (ya da kompozerdeki belge menüsünden kendiliğinden)
 * yüklü belgesini paylaşır. Paylaşım = o başvuru için o belge tipine izin;
 * işletme "Görüntüle" ile açar (erişim kontrolü backend'de).
 *
 * Mesaj token'ları (backend ChatDocumentService üretir):
 *   [DOC_REQUEST:CRIMINAL_RECORD]
 *   [DOC_SHARED:42:CRIMINAL_RECORD]
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

/** İşletmenin sohbette en sık istediği belgeler (sırası önemli). */
const REQUESTABLE = ['CRIMINAL_RECORD', 'HEALTH_CERTIFICATE', 'IDENTITY_DOCUMENT', 'CV']

export function parseDocToken(content) {
  if (!content) return null
  let m = content.match(/^\[DOC_REQUEST:([A-Z_]+)\]$/)
  if (m) return { kind: 'request', type: m[1] }
  m = content.match(/^\[DOC_SHARED:(\d+):([A-Z_]+)\]$/)
  if (m) return { kind: 'shared', documentId: Number(m[1]), type: m[2] }
  return null
}

const DOC_ICON = 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'

/** Sohbet içindeki istek / paylaşım kartı. */
export function DocumentCardBubble({ m, doc, role, onShareType }) {
  const mine = m.mine
  const label = CHAT_DOC_LABELS[doc.type] || 'Belge'
  const isRequest = doc.kind === 'request'
  const [busy, setBusy] = useState(false)

  const title = isRequest ? `${label} istendi` : `${label} paylaşıldı`
  const sub = isRequest
    ? (mine ? 'Adaydan istedin' : 'Yüklü belgeni tek tıkla gönderebilirsin')
    : (mine ? 'İşletme artık bu belgeyi görebilir' : 'Aday belgeyi paylaştı')

  async function handleAction() {
    setBusy(true)
    try {
      if (isRequest) await onShareType?.(doc.type)
      else await hotelApi.viewDocument(doc.documentId)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const showAction = isRequest ? (!mine && role === 'CANDIDATE') : true

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
            <div className="font-semibold text-sm">{title}</div>
            <div className="text-[11px]" style={{ color: mine ? 'rgba(255, 255, 255, 0.65)' : 'var(--ah-ink-4)' }}>
              {sub} · {formatTime(m.sentAt)}
            </div>
          </div>
        </div>
        {showAction && (
          <button type="button" onClick={handleAction} disabled={busy}
                  className="w-full px-4 py-2.5 text-sm font-semibold border-t transition-opacity hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#111827', color: '#ffffff', borderColor: mine ? 'rgba(255, 255, 255, 0.14)' : 'var(--ah-line)' }}>
            {busy ? 'Bekle…' : isRequest ? 'Belgeyi gönder' : 'Görüntüle'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Kompozerdeki belge menüsü.
 *  - İşletme: hangi belgeyi isteyeceğini seçer.
 *  - Aday: yüklü belgelerinden birini gönderir.
 */
export function DocumentMenu({ role, onRequest, onShare, onClose }) {
  const isBiz = role === 'BUSINESS_OWNER'
  const [docs, setDocs] = useState(null)

  useEffect(() => {
    if (isBiz) return
    hotelApi.getMyDocuments().then(setDocs).catch(() => setDocs([]))
  }, [isBiz])

  function pick(fn) {
    onClose?.()
    fn()
  }

  const itemCls = 'w-full text-left px-3 py-2 text-sm rounded-md hover:bg-[var(--ah-page)]'

  return (
    <div role="menu" className="absolute bottom-12 left-0 z-30 w-64 rounded-xl p-1.5 shadow-lg"
         style={{ background: 'var(--ah-card, #ffffff)', border: '1px solid var(--ah-line)' }}>
      <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.06em]"
           style={{ color: 'var(--ah-ink-4)' }}>
        {isBiz ? 'Adaydan belge iste' : 'Belge paylaş'}
      </div>
      {isBiz && REQUESTABLE.map(t => (
        <button key={t} type="button" role="menuitem" className={itemCls}
                style={{ color: 'var(--ah-ink)' }} onClick={() => pick(() => onRequest(t))}>
          {CHAT_DOC_LABELS[t]}
        </button>
      ))}
      {!isBiz && docs === null && (
        <div className="px-3 py-2 text-sm" style={{ color: 'var(--ah-ink-4)' }}>Yükleniyor…</div>
      )}
      {!isBiz && docs?.length === 0 && (
        <div className="px-3 py-2 text-sm" style={{ color: 'var(--ah-ink-3)' }}>
          Henüz belge yüklemedin.{' '}
          <Link to="/candidate?tab=documents" className="font-semibold underline" style={{ color: 'var(--ah-ink)' }}>
            Belgelerim
          </Link>
        </div>
      )}
      {!isBiz && docs?.map(d => (
        <button key={d.id} type="button" role="menuitem" className={itemCls}
                onClick={() => pick(() => onShare(d.id))}>
          <div className="font-medium" style={{ color: 'var(--ah-ink)' }}>
            {CHAT_DOC_LABELS[d.type] || d.type}
            {d.expired && <span className="ml-1.5 text-[11px]" style={{ color: 'var(--ah-danger)' }}>süresi dolmuş</span>}
          </div>
          <div className="text-[11px] truncate" style={{ color: 'var(--ah-ink-4)' }}>{d.originalFileName}</div>
        </button>
      ))}
    </div>
  )
}

/**
 * İstek kartındaki "Belgeyi gönder": o tipteki en yeni, süresi dolmamış belgeyi
 * seçer. Yoksa adayı Belgelerim'e yönlendirir.
 */
export async function pickDocumentForType(type) {
  const docs = await hotelApi.getMyDocuments()
  const candidates = (docs || [])
    .filter(d => d.type === type && !d.expired)
    .sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''))
  return candidates[0] || null
}
