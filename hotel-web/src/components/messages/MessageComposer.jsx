/**
 * FAZ 20 — Composer: alintili yanit basligi + hizli yanit cipleri + form.
 *
 * MessageThread'den cikarildi (FAZ 17'de "sonraki adim" olarak not edilmisti).
 * Buradaki state SADECE yazma eylemine ait: taslak metin ve ses kaydi.
 * Gonderimin kendisi useMessageSend hook'unda — bu dosya "ne yaziliyor"u
 * bilir, "nasil gonderiliyor"u bilmez.
 *
 * onRecordingChange: thread surukle-birak'i kayit sirasinda bloklamak icin
 * kayit durumunu bilmek zorunda (overlay thread genisliginde, kayit ise
 * composer'in isi) — tek baglanti noktasi bu.
 */
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'
import { wsPublish } from '../../lib/websocket'

export default function MessageComposer({
  conversation,
  replyTo,
  onClearReply,
  role,
  messageCount,
  sending,
  sendText,
  sendFile,
  sendCall,
  onRecordingChange,
}) {
  const [draft, setDraft] = useState('')
  const fileInputRef = useRef(null)

  // ── Sesli mesaj kaydı (MediaRecorder API) ──
  const [recording, setRecording] = useState(false)
  const [recDuration, setRecDuration] = useState(0)
  const recorderRef = useRef(null)
  const recChunksRef = useRef([])
  const recTimerRef = useRef(null)

  // Kayit durumunu thread'e bildir (drop guard'i icin)
  useEffect(() => { onRecordingChange?.(recording) }, [recording])

  async function handleSend(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    const result = await sendText(content, replyTo?.id || null)
    // 'queued' de basarili sayilir — mesaj kuyrukta, form'u bosalt.
    // Sadece gercek hatada ('failed') taslak korunur ki kullanici kaybetmesin.
    if (result === 'sent' || result === 'queued') {
      setDraft('')
      onClearReply?.()
    }
  }

  async function handleAttach(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (await sendFile(file, draft.trim())) setDraft('')
  }

  // FAZ G.5 — Pano'dan foto/dosya yapıştırma (screenshot kopyalayıp Ctrl+V)
  async function handlePaste(e) {
    if (sending || recording) return
    const items = Array.from(e.clipboardData?.items || [])
    const fileItem = items.find(it => it.kind === 'file')
    if (!fileItem) return  // sadece metin yapıştırma — default davranış
    const file = fileItem.getAsFile()
    if (!file) return
    e.preventDefault()
    // Pano'dan gelen image genelde "image.png" gibi; ad ile orijinali koru
    const stamped = file.name && file.name !== 'image.png'
      ? file
      : new File([file], `pano-${Date.now()}.${(file.type.split('/')[1] || 'png')}`, { type: file.type })
    if (await sendFile(stamped, draft.trim())) setDraft('')
  }

  async function startRecording() {
    if (sending || recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      recChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recChunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        clearInterval(recTimerRef.current)
        const blob = new Blob(recChunksRef.current, { type: mime })
        if (blob.size < 1000) {
          toast.error('Kayıt çok kısa')
          return
        }
        await sendFile(new File([blob], `ses-${Date.now()}.webm`, { type: mime }), '')
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecDuration(0)
      recTimerRef.current = setInterval(() => setRecDuration(d => d + 1), 1000)
    } catch {
      toast.error('Mikrofon izni reddedildi veya kullanılamıyor')
    }
  }

  function stopRecording(cancel = false) {
    if (!recording) return
    setRecording(false)
    const r = recorderRef.current
    if (cancel) {
      // İptal: ondataavailable'ı yutarız
      recChunksRef.current = []
      r.onstop = () => {
        r.stream?.getTracks().forEach(t => t.stop())
        clearInterval(recTimerRef.current)
      }
    }
    r.stop()
  }

  return (
    <>
      {/* FAZ 11.W3.3 — Quoted reply composer stub */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-hairline flex items-center gap-2.5"
             style={{ background: 'rgba(205, 183, 143, 0.04)' }}>
          <div className="w-[3px] self-stretch rounded-full" style={{ background: '#cdb78f' }} />
          <div className="flex-1 min-w-0">
            <div className="type-caption font-semibold" style={{ color: 'var(--accent-action)' }}>
              {replyTo.mine ? 'Kendine yanıt' : replyTo.senderName || 'Yanıt'}
            </div>
            <div className="type-caption truncate">
              {replyTo.content?.trim() || replyTo.attachmentName || 'Ek dosya'}
            </div>
          </div>
          <button type="button" onClick={onClearReply}
                  className="w-6 h-6 grid place-items-center rounded-full text-ivory-600 hover:text-ivory-200"
                  title="Yanıtı iptal et">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* FAZ G.6 — Bağlamlı hızlı yanıt çipleri */}
      {!recording && !sending && !replyTo && (
        <QuickReplyChips
          role={role}
          listingTitle={conversation?.listingTitle}
          onPick={(text) => setDraft(d => d ? d + ' ' + text : text)}
          messageCount={messageCount}
        />
      )}

      {/* Kompozer — dosya ekle + metin + sesli mesaj + gönder */}
      <form onSubmit={handleSend} className="px-3 py-3 border-t border-hairline flex items-center gap-2 flex-shrink-0">
        {/* Kayıt modu: özel UI (brick signal, dark theme) */}
        {recording ? (
          <>
            <button type="button" onClick={() => stopRecording(true)}
                    className="w-10 h-10 grid place-items-center rounded-full transition-colors shrink-0"
                    style={{ background: 'rgba(205, 183, 143, 0.08)', color: 'var(--text-secondary)', border: '1px solid rgba(205, 183, 143, 0.18)' }}
                    title="İptal">
              ×
            </button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(180, 106, 85, 0.12)', border: '1px solid rgba(180, 106, 85, 0.32)' }}>
              <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: '#b46a55' }} />
              <span className="type-body font-mono" style={{ color: '#d39481' }}>
                Kayıt {fmtDuration(recDuration)}
              </span>
              <span className="type-caption ml-auto">Göndermek için durdur</span>
            </div>
            <button type="button" onClick={() => stopRecording(false)}
                    disabled={sending}
                    className="type-overline px-4 py-2 rounded-lg text-white flex-shrink-0 transition-colors disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #b46a55 0%, #8f4e3d 100%)', border: '1px solid rgba(180, 106, 85, 0.45)' }}>
              Durdur
            </button>
          </>
        ) : (
          <>
            {/* Dosya ekle butonu */}
            <input ref={fileInputRef} type="file"
                   accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.mp3,.m4a,.ogg,.wav,.webm"
                   onChange={handleAttach} className="hidden" />
            <IconButton onClick={() => fileInputRef.current?.click()} disabled={sending}
                        title="Dosya / Foto ekle"
                        d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />

            {/* Sesli mesaj kayıt başlat */}
            <IconButton onClick={startRecording} disabled={sending}
                        title="Sesli mesaj kaydet"
                        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />

            {/* Sesli arama (Jitsi) */}
            <IconButton onClick={() => sendCall('audio')} disabled={sending}
                        title="Sesli arama başlat (Jitsi)"
                        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />

            {/* Görüntülü arama (Jitsi) */}
            <IconButton onClick={() => sendCall('video')} disabled={sending}
                        title="Görüntülü arama başlat (Jitsi)"
                        d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />

            <div className="relative flex-1 min-w-0">
              <input type="text" value={draft}
                onChange={e => {
                  setDraft(e.target.value)
                  if (conversation?.id) {
                    wsPublish(`/app/chat.typing/${conversation.id}`, {})
                  }
                }}
                onPaste={handlePaste}
                placeholder="Mesaj yaz veya foto yapıştır..." maxLength={2000}
                className="input text-sm w-full" disabled={sending} />
              {/* FAZ G.7 — Karakter sayacı (sadece 1500'den sonra görünür) */}
              {draft.length >= 1500 && (
                <span style={{
                  position: 'absolute',
                  right: 10, bottom: -16,
                  fontSize: 10,
                  color: draft.length >= 1900 ? '#ef6461' : draft.length >= 1800 ? '#d97706' : '#94a3b8',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 600,
                }}>
                  {draft.length} / 2000
                </span>
              )}
            </div>
            <SendButton sending={sending} disabled={!draft.trim() || sending} />
          </>
        )}
      </form>
    </>
  )
}

/** Kayit suresi: 65 -> "1:05" */
export function fmtDuration(s) {
  const m = Math.floor(s / 60)
  const ss = String(s % 60).padStart(2, '0')
  return `${m}:${ss}`
}

/* Composer'daki 4 yuvarlak ikon butonu ayni; sadece ikon path'i degisiyordu. */
function IconButton({ onClick, disabled, title, d }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
            className="tier-raised tier-raised-hover w-10 h-10 grid place-items-center disabled:opacity-50 shrink-0"
            style={{ borderRadius: '999px', color: 'var(--text-secondary)' }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
           strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
      </svg>
    </button>
  )
}

/* ─────────── FAZ G.7 — Send button (altın gradient + sent flash) ─────────── */
function SendButton({ sending, disabled }) {
  return (
    <button type="submit"
      disabled={disabled}
      title={disabled && !sending ? 'Mesaj yaz' : 'Gönder (Enter)'}
      style={{
        position: 'relative',
        padding: '0 18px', height: 40,
        borderRadius: 10,
        // Send = filled amber CTA (sayfada tek accent-filled element kurali):
        // uzun bir konusmada bu buton sohbet penceresi icindeki ana eylem.
        background: disabled
          ? 'rgba(146, 134, 120, 0.20)'
          : 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
        color: disabled ? 'var(--text-faint)' : '#1a1208',
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: '0.02em',
        border: disabled ? '1px solid rgba(205, 183, 143, 0.10)' : '1px solid rgba(205, 183, 143, 0.45)',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 6px 18px rgba(205, 183, 143, 0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
        transition: 'transform 150ms, box-shadow 200ms, background 200ms',
      }}
      onMouseDown={e => !disabled && (e.currentTarget.style.transform = 'translateY(1px) scale(0.98)')}
      onMouseUp={e => (e.currentTarget.style.transform = '')}
      onMouseLeave={e => (e.currentTarget.style.transform = '')}>
      {sending ? (
        <span className="inline-flex items-center gap-1.5">
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            animation: 'sb-spin 700ms linear infinite',
          }} />
          <span>Gönderiliyor…</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          Gönder
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M3 12 21 3 14 21l-3-8-8-1Z" stroke="#1a1208" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      <style>{`
        @keyframes sb-spin { to { transform: rotate(360deg); } }
      `}</style>
    </button>
  )
}

/* ─────────── FAZ G.6 — Bağlamlı hızlı yanıt çipleri ─────────── */
export function QuickReplyChips({ role, listingTitle, onPick, messageCount }) {
  // Sadece ilk birkaç mesajda göster — uzun sohbette gürültü olur
  if (messageCount > 6) return null

  const isBiz = role === 'BUSINESS_OWNER'
  const chips = isBiz
    ? [
        'Hafta sonu uygun musun?',
        'Saat 14:00\'te işbaşı yapabilir misin?',
        'Hangi tarihler müsaitsin?',
        'Daha önce benzer bir yerde çalıştın mı?',
        'Yarın 09:00\'da görüşmeye gelir misin?',
      ]
    : [
        'Müsaitim, detay verir misiniz?',
        'Hangi gün başlıyor?',
        'Ücret günlük mü saatlik mi?',
        'Adresi paylaşır mısınız?',
        'Teşekkürler, dönüş yapacağım.',
      ]

  return (
    <div className="px-3 pb-2 pt-1 border-t border-cream-200 dark:border-cream-300 flex-shrink-0">
      <div className="text-[9px] uppercase tracking-widest text-ink-400 mb-1.5 flex items-center gap-1.5">
        <span style={{ color: '#d4a853' }}>·</span>
        <span>Hızlı yanıt</span>
        {listingTitle && (
          <span className="truncate text-ink-500" style={{ maxWidth: 200 }}>
            · {listingTitle}
          </span>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-3 px-3"
           style={{ scrollbarWidth: 'thin' }}>
        {chips.map((text, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick?.(text)}
            className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(205, 183, 143, 0.08)',
              color: '#1b1815',
              border: '1px solid rgba(205, 183, 143, 0.22)',
              flexShrink: 0,
            }}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}
