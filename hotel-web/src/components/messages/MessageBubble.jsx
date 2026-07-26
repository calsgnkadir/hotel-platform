/**
 * FAZ 17 — Mesaj balonu ve parcalari.
 *
 * MessagesPage.jsx monolitinden cikarildi. Icerik: bubble (attachment +
 * quoted reply + reactions + turn grouping), read receipt, call invite
 * balonu, dosya eki karti, reaction ikon seti.
 *
 * FAZ 25 — Renk uyumu (kullanici istegi): eski teal->altin / gri->krem
 * gradyanlari birakildi. Artik WhatsApp gibi net iki ton:
 *   benim mesajim  = duz teal (#0f766e) + beyaz yazi
 *   karsi taraf    = beyaz kart + koyu ink yazi + ince cizgi
 */
import { useState } from 'react'
import cldImg, { ImgSize } from '../../lib/cldImg'
import { formatTime, parseCallInvite, pdfThumbnailUrl, fileTypeMeta } from './utils'

const BRAND = '#0f766e'
const BRAND_DARK = '#0b5d57'

/* ── FAZ 11.W3.3 — Reaction SVG preset (emoji yasak — proje kurali) ── */
const REACTION_ICONS = {
  heart:       <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>,
  check:       <polyline points="20 6 9 17 4 12"/>,
  question:    <><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  'thumbs-up': <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>,
  alert:       <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  x:           <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
}
export const REACTION_ORDER = ['heart', 'check', 'question', 'thumbs-up', 'alert', 'x']

export function ReactionIcon({ type, size = 12, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {REACTION_ICONS[type] || REACTION_ICONS.check}
    </svg>
  )
}

/* WhatsApp-style cift tik — sadece benim mesajimda (teal zemin), beyaz tik. */
function ReadReceipt({ isRead }) {
  const color = isRead ? '#ffffff' : 'rgba(255, 255, 255, 0.55)'
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
         aria-label={isRead ? 'Okundu' : 'Gönderildi'}>
      <path d="m5 12 4 4 6-6" />
      <path d="m11 16 6-6 2 2" opacity="0.85" />
    </svg>
  )
}

/* ── Dosya eki: PDF/DOC/diğer için ayrı ikon + renk chip (FAZ D5) ── */
function FileAttachment({ m }) {
  const mine = m.mine
  const name = m.attachmentName || 'Dosya'
  const ext = (name.split('.').pop() || '').toLowerCase()
  const meta = fileTypeMeta(ext)
  // FAZ D5 son adım: PDF için Cloudinary'den ilk sayfa thumbnail dene
  const [thumbFailed, setThumbFailed] = useState(false)
  const pdfThumb = ext === 'pdf' ? pdfThumbnailUrl(m.attachmentUrl) : null
  const showThumb = pdfThumb && !thumbFailed

  return (
    <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer"
       className="flex items-center gap-2.5 px-3 py-2.5 border-b"
       style={{ borderColor: mine ? 'rgba(255, 255, 255, 0.16)' : 'var(--ah-line)' }}>
      {showThumb ? (
        <img src={pdfThumb}
             alt="PDF önizleme" onError={() => setThumbFailed(true)}
             loading="lazy" decoding="async"
             className="w-12 h-16 rounded-md object-cover flex-shrink-0"
             style={{ border: `1px solid ${meta.border}`, background: meta.bg }} />
      ) : (
        <div className="w-9 h-11 rounded-md flex flex-col items-center justify-center flex-shrink-0 relative"
             style={{ background: meta.bg, border: `1px solid ${meta.border}` }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke={meta.iconColor} strokeWidth={1.6} className="w-4 h-4 -mb-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d={meta.iconPath} />
          </svg>
          <span className="text-[8px] font-bold tracking-wider" style={{ color: meta.iconColor }}>
            {meta.label}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate text-[13px]">{name}</div>
        <div className="text-[10px]" style={{ color: mine ? 'rgba(255, 255, 255, 0.6)' : 'var(--ah-ink-4)' }}>
          {m.attachmentSize ? `${(m.attachmentSize / 1024).toFixed(0)} KB · ` : ''}indirmek için tıkla
        </div>
      </div>
    </a>
  )
}

/* ── Jitsi arama daveti — özel mesaj balonu ── */
function CallInviteBubble({ m, type, url }) {
  const mine = m.mine
  const isVideo = type === 'video'
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl text-sm overflow-hidden
        ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
        style={{
          background: mine ? BRAND : '#ffffff',
          color: mine ? '#ffffff' : 'var(--ah-ink)',
          border: `1px solid ${mine ? BRAND : 'var(--ah-line)'}`,
          boxShadow: mine ? '0 1px 2px rgba(15, 118, 110, 0.20)' : '0 1px 2px rgba(18, 32, 31, 0.06)',
        }}>
        <div className="flex items-center gap-3 px-4 py-3"
             style={{ background: mine ? 'rgba(255, 255, 255, 0.08)' : 'var(--ah-page)' }}>
          <div className="w-10 h-10 rounded-full grid place-items-center shrink-0"
               style={{
                 background: mine ? 'rgba(255, 255, 255, 0.14)' : 'var(--ah-brand-soft)',
                 color: mine ? '#ffffff' : BRAND,
               }}>
            {isVideo ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">
              {isVideo ? 'Görüntülü Arama' : 'Sesli Arama'}
            </div>
            <div className="text-[11px]" style={{ color: mine ? 'rgba(255, 255, 255, 0.65)' : 'var(--ah-ink-4)' }}>
              {mine ? 'Sen davet ettin' : 'Sana davet'} · {formatTime(m.sentAt)}
            </div>
          </div>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
           className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border-t transition-opacity hover:opacity-90"
           style={{
             background: BRAND_DARK,
             color: '#ffffff',
             borderColor: mine ? 'rgba(255, 255, 255, 0.14)' : 'var(--ah-line)',
           }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          Aramaya Katıl
        </a>
      </div>
    </div>
  )
}

/**
 * Tek mesaj balonu — attachment + quoted reply + reactions + turn grouping.
 * showMeta: turn boundary'de gonderen adi + saat header'i gosterilir.
 */
export default function MessageBubble({ m, showMeta = true, onReply, onReact }) {
  const mine = m.mine
  const isImage = m.attachmentType === 'image'
  const isAudio = m.attachmentType === 'audio'
  const isFile  = m.attachmentType === 'file'
  const hasAttach = !!m.attachmentUrl
  const [pickerOpen, setPickerOpen] = useState(false)

  // Sesli/Görüntülü arama davet mesajı?
  const call = !hasAttach ? parseCallInvite(m.content) : null
  if (call) return <CallInviteBubble m={m} type={call.type} url={call.url} />

  const reactions = m.reactions || []
  const innerBg = mine ? 'rgba(255, 255, 255, 0.10)' : 'var(--ah-page)'

  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {/* FAZ 11.W3.2 — Turn header: gonderen + saat, sadece turn boundary'de */}
      {showMeta && !mine && (
        <div className="type-caption mb-1 px-1" style={{ color: 'var(--ah-ink-4)' }}>
          {m.senderName} · {formatTime(m.sentAt)}
        </div>
      )}

      <div className="relative group/msg max-w-[75%]">
        {/* Hover action bar — yanitla + reaksiyon */}
        <div className={`absolute top-1 ${mine ? '-left-16' : '-right-16'} flex items-center gap-1
                         opacity-0 group-hover/msg:opacity-100 transition-opacity z-10`}>
          <button type="button" onClick={() => onReply?.(m)}
                  title="Yanıtla"
                  className="w-7 h-7 grid place-items-center rounded-full"
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--ah-line)',
                    color: BRAND,
                    boxShadow: '0 1px 3px rgba(18, 32, 31, 0.10)',
                  }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
            </svg>
          </button>
          <div className="relative">
            <button type="button" onClick={() => setPickerOpen(v => !v)}
                    title="Reaksiyon ekle"
                    className="w-7 h-7 grid place-items-center rounded-full"
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--ah-line)',
                      color: BRAND,
                      boxShadow: '0 1px 3px rgba(18, 32, 31, 0.10)',
                    }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            {/* Reaksiyon secici popover */}
            {pickerOpen && (
              <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-full z-20"
                   style={{
                     background: '#ffffff',
                     border: '1px solid var(--ah-line)',
                     boxShadow: '0 8px 24px rgba(18, 32, 31, 0.14)',
                   }}>
                {REACTION_ORDER.map(r => (
                  <button key={r} type="button"
                          onClick={() => { setPickerOpen(false); onReact?.(m, r) }}
                          title={r}
                          className="w-7 h-7 grid place-items-center rounded-full transition-all hover:scale-125"
                          style={{ color: BRAND }}>
                    <ReactionIcon type={r} size={14} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bubble */}
        <div className={`rounded-2xl text-sm overflow-hidden
          ${mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
          style={{
            background: mine ? BRAND : '#ffffff',
            color: mine ? '#ffffff' : 'var(--ah-ink)',
            border: `1px solid ${mine ? BRAND : 'var(--ah-line)'}`,
            boxShadow: mine ? '0 1px 2px rgba(15, 118, 110, 0.20)' : '0 1px 2px rgba(18, 32, 31, 0.06)',
          }}>

          {/* FAZ 11.W3.3 — Quoted reply stub */}
          {m.parentMessageId && (
            <div className="mx-2 mt-2 px-2.5 py-1.5 rounded-lg border-l-2"
                 style={{
                   background: innerBg,
                   borderLeftColor: mine ? 'rgba(255, 255, 255, 0.55)' : BRAND,
                 }}>
              <div className="text-[10px] font-semibold" style={{ color: mine ? 'rgba(255, 255, 255, 0.9)' : BRAND }}>
                {m.parentSenderName || 'Mesaj'}
              </div>
              <div className="text-[11px] truncate" style={{ color: mine ? 'rgba(255, 255, 255, 0.7)' : 'var(--ah-ink-3)' }}>
                {m.parentPreview || 'Silinmiş mesaj'}
              </div>
            </div>
          )}

          {/* Attachment */}
          {hasAttach && isImage && (
            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img src={cldImg(m.attachmentUrl, { w: ImgSize.card })} alt={m.attachmentName || 'foto'}
                   loading="lazy" decoding="async"
                   className="max-h-72 w-auto object-contain"
                   style={{ background: innerBg }} />
            </a>
          )}
          {hasAttach && isAudio && (
            <div className="flex items-center gap-2 px-3 py-2.5"
                 style={{ background: innerBg }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor"
                   className="w-5 h-5 shrink-0" style={{ color: mine ? 'rgba(255, 255, 255, 0.7)' : 'var(--ah-ink-4)' }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
              <audio controls preload="metadata" src={m.attachmentUrl} className="h-8 max-w-[200px]" />
            </div>
          )}
          {hasAttach && isFile && <FileAttachment m={m} />}

          {/* Metin (varsa) */}
          {m.content && m.content.trim() && (
            <div className="px-3.5 py-2 whitespace-pre-wrap break-words">{m.content}</div>
          )}

          {/* Zaman + read receipt */}
          <div className="text-[10px] px-3 pb-1 text-right inline-flex items-center justify-end gap-1 w-full"
               style={{ color: mine ? 'rgba(255, 255, 255, 0.72)' : 'var(--ah-ink-4)' }}>
            <span>{formatTime(m.sentAt)}</span>
            {mine && <ReadReceipt isRead={m.isRead} />}
          </div>
        </div>

        {/* FAZ 11.W3.3 — Reaksiyon chip'leri (bubble altina overlap) */}
        {reactions.length > 0 && (
          <div className={`flex items-center gap-1 -mt-1.5 relative z-[1] ${mine ? 'justify-end pr-2' : 'pl-2'}`}>
            {reactions.map(r => (
              <button key={r.reaction} type="button"
                      onClick={() => onReact?.(m, r.reaction)}
                      title={r.reaction}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] tabular-nums transition-all hover:scale-110"
                      style={{
                        background: r.mine ? 'var(--ah-brand-soft)' : '#ffffff',
                        border: `1px solid ${r.mine ? BRAND : 'var(--ah-line)'}`,
                        color: BRAND,
                      }}>
                <ReactionIcon type={r.reaction} size={10} />
                {r.count > 1 && <span className="font-semibold">{r.count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
