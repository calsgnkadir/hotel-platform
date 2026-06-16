import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as hotelApi from '../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { keys } from '../lib/queryClient'
import cldImg, { ImgSize } from '../lib/cldImg'
import EmptyState from '../components/EmptyState'
import ReportModal from '../components/ReportModal'  // FAZ 5.8
import { SkeletonConversationList, SkeletonMessages } from '../components/Skeleton'
import { wsSubscribe, wsPublish } from '../lib/websocket'
import useWsConnected, { useWsReconnectInvalidate } from '../lib/useWsConnected'
import { useOnline } from '../lib/presence'

/** Mesaj zamanını dilbilime yakın formatla. */
function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMin = (Date.now() - d.getTime()) / 60000
  if (diffMin < 1)  return 'şimdi'
  if (diffMin < 60) return `${Math.floor(diffMin)} dk`
  const diffH = diffMin / 60
  if (diffH < 24)   return `${Math.floor(diffH)} sa`
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

/* ── Tek sohbet öğesi (sol panel) ── */
function ConversationItem({ conv, isActive, onClick }) {
  const online = useOnline(conv.otherPartyId)  // FAZ 1/#60
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-cream-200 dark:border-cream-300 hover:bg-cream-50 dark:hover:bg-slate-800 transition-colors
        ${isActive ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          {conv.otherPartyAvatarUrl ? (
            <img src={cldImg(conv.otherPartyAvatarUrl, { w: ImgSize.avatarSm })} alt={conv.otherPartyName}
              loading="lazy" decoding="async"
              className="w-10 h-10 rounded-full object-cover border border-cream-300" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-cream-100 dark:bg-ink-700 border border-cream-300 dark:border-ink-700">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-ink-400 dark:text-ink-500">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
          )}
          {/* FAZ 1/#60 — Online dot sağ alt */}
          {online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white"
                  title="Çevrimiçi" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm text-ink-800 dark:text-ink-900 truncate">
              {conv.otherPartyName}
            </div>
            <div className="text-[10px] text-ink-400 dark:text-ink-500 flex-shrink-0">
              {formatRelative(conv.lastMessageAt)}
            </div>
          </div>
          {conv.listingTitle && (
            <div className="text-[10px] text-brand-700 dark:text-brand-700 truncate mt-0.5">
              {conv.listingTitle}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-ink-800 dark:text-ink-900 font-medium' : 'text-ink-500 dark:text-ink-400'}`}>
              {conv.lastMessagePreview || <span className="italic text-ink-400 dark:text-ink-500">Henüz mesaj yok</span>}
            </div>
            {conv.unreadCount > 0 && (
              <span className="flex-shrink-0 text-[10px] font-bold text-white rounded-full px-1.5 min-w-[18px] text-center bg-brand-700">
                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

/* ── Jitsi call davet mesajı tanımlanır mı? ── */
function parseCallInvite(content) {
  if (!content) return null
  // Format: "[CALL:audio]https://meet.jit.si/xxx"  veya  "[CALL:video]https://meet.jit.si/xxx"
  const m = content.match(/^\[CALL:(audio|video)\]\s*(https?:\/\/[^\s]+)$/)
  if (!m) return null
  return { type: m[1], url: m[2] }
}

/* ── Tek mesaj balonu (attachment render dahil) ── */
function MessageBubble({ m }) {
  const isImage = m.attachmentType === 'image'
  const isAudio = m.attachmentType === 'audio'
  const isFile  = m.attachmentType === 'file'
  const hasAttach = !!m.attachmentUrl

  // Sesli/Görüntülü arama davet mesajı?
  const call = !hasAttach ? parseCallInvite(m.content) : null
  if (call) return <CallInviteBubble m={m} type={call.type} url={call.url} />


  return (
    <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
      {/* Tüm balonlar açık mor (kullanici isteği). Mine biraz daha koyu (purple-300), karşı taraf en açık (purple-100). */}
      <div className={`max-w-[75%] rounded-2xl text-sm shadow-sm overflow-hidden
        ${m.mine ? 'rounded-br-md' : 'rounded-bl-md'}`}
        style={{
          background: m.mine
            ? 'linear-gradient(135deg, #c4b5fd 0%, #a78bfa 100%)'   /* purple-300 → purple-400 */
            : 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',   /* purple-100 → purple-200 */
          color: '#3b0764',  /* koyu mor yazı — kontrast garantili */
          border: '1px solid rgba(168, 85, 247, 0.35)',
        }}>

        {/* Attachment */}
        {hasAttach && isImage && (
          <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img src={cldImg(m.attachmentUrl, { w: ImgSize.card })} alt={m.attachmentName || 'foto'}
                 loading="lazy" decoding="async"
                 className="max-h-72 w-auto object-contain bg-cream-100 dark:bg-ink-800" />
          </a>
        )}
        {hasAttach && isAudio && (
          <div className={`flex items-center gap-2 px-3 py-2.5 ${m.mine ? 'bg-brand-800/30' : 'bg-cream-100 dark:bg-ink-800/40'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.8} stroke="currentColor"
                 className={`w-5 h-5 shrink-0 ${m.mine ? 'text-white' : 'text-ink-500'}`}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            </svg>
            <audio controls preload="metadata" src={m.attachmentUrl} className="h-8 max-w-[200px]" />
          </div>
        )}
        {hasAttach && isFile && (
          <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer"
             className={`flex items-center gap-2 px-3 py-2.5 border-b ${m.mine ? 'border-white/20' : 'border-cream-300 dark:border-ink-700'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.8} stroke="currentColor"
                 className={`w-5 h-5 shrink-0 ${m.mine ? 'text-white' : 'text-ink-500'}`}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-[13px]">{m.attachmentName || 'Dosya'}</div>
              {m.attachmentSize && (
                <div className={`text-[10px] ${m.mine ? 'text-white/70' : 'text-ink-400'}`}>
                  {(m.attachmentSize / 1024).toFixed(0)} KB · indirmek için tıkla
                </div>
              )}
            </div>
          </a>
        )}

        {/* Metin (varsa) */}
        {m.content && m.content.trim() && (
          <div className="px-3.5 py-2 whitespace-pre-wrap break-words">{m.content}</div>
        )}

        {/* Zaman */}
        <div className="text-[10px] px-3 pb-1 text-right" style={{ color: 'rgba(59, 7, 100, 0.60)' }}>
          {formatTime(m.sentAt)}{m.mine && m.isRead ? ' · görüldü' : ''}
        </div>
      </div>
    </div>
  )
}

/* ── Jitsi arama daveti — özel mesaj balonu ── */
function CallInviteBubble({ m, type, url }) {
  const isVideo = type === 'video'
  return (
    <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl text-sm shadow-sm overflow-hidden border
        ${m.mine
          ? 'bg-brand-700 border-brand-600 text-white rounded-br-md'
          : 'bg-white dark:bg-ink-700 border-cream-300 dark:border-ink-700 text-ink-700 dark:text-ink-800 rounded-bl-md'}`}>
        <div className={`flex items-center gap-3 px-4 py-3 ${m.mine ? 'bg-brand-800/40' : 'bg-cream-100 dark:bg-ink-800/40'}`}>
          <div className={`w-10 h-10 rounded-full grid place-items-center shrink-0
                           ${m.mine ? 'bg-white/15' : 'bg-brand-500/20'}`}>
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
            <div className={`text-[11px] ${m.mine ? 'text-white/70' : 'text-ink-500'}`}>
              {m.mine ? 'Sen davet ettin' : 'Sana davet'} · {formatTime(m.sentAt)}
            </div>
          </div>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
           className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold border-t
                       ${m.mine
                         ? 'bg-white text-brand-700 hover:bg-brand-50 border-white/20'
                         : 'bg-brand-700 text-white hover:bg-brand-800 border-cream-300 dark:border-ink-700'}`}>
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

/* ── Sohbet penceresi (sağ panel) ── */
function ChatWindow({ conversation, onBack, onMessageSent }) {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const fileInputRef = useRef(null)
  const lastSeenIdRef = useRef(0)
  const scrollAnchorRef = useRef(null)
  const queryClient = useQueryClient()
  const wsOk = useWsConnected()  // FAZ 4.8 — WS bağlıyken polling KAPALI

  // F0.10 + FAZ 1/#12 — Mesajlar useQuery
  // WS aktifken push gelir; sadece WS kopuksa 30sn fallback polling devreye girer.
  const { data: messagesData, isLoading: loading } = useQuery({
    queryKey: keys.conversations.messages(conversation?.id),
    queryFn: () => hotelApi.getConversationMessages(conversation.id, { size: 100 }),
    enabled: !!conversation,
    refetchInterval: conversation && !wsOk ? 30000 : false,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  })

  // FAZ 1/#12 — WS: yeni mesaj gelince anlık cache invalidate
  // FAZ 1/#60 — Karşı taraf 'yazıyor' sinyali
  const [otherTyping, setOtherTyping] = useState(false)
  const typingTimeoutRef = useRef(null)

  useEffect(() => {
    if (!conversation) return
    const subMsg = wsSubscribe('/user/queue/messages', (payload) => {
      if (payload?.conversationId === conversation.id) {
        queryClient.invalidateQueries({ queryKey: keys.conversations.messages(conversation.id) })
      }
      // Her durumda sohbet listesi de yenilensin (preview/lastMessageAt)
      queryClient.invalidateQueries({ queryKey: keys.conversations.list() })
      queryClient.invalidateQueries({ queryKey: keys.conversations.unreadCount() })
    })
    // FIX: User-destination yerine topic broadcast (Spring SimpUserRegistry sorununu bypass).
    const subTyping = wsSubscribe(`/topic/typing.${conversation.id}`, (payload) => {
      // FIX: Number() normalize — kendi yazdigimizi gozardi et (id tip uyumsuzlugu)
      const myId = Number(user?.id)
      const fromId = Number(payload?.userId)
      if (myId && fromId && myId === fromId) return
      if (payload?.conversationId !== conversation.id) return
      setOtherTyping(true)
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000)
    })
    return () => {
      subMsg.unsubscribe()
      subTyping.unsubscribe()
      clearTimeout(typingTimeoutRef.current)
    }
  }, [conversation?.id, queryClient])

  // Backend page'i son→eski. UI eski→yeni istiyor.
  const messages = (messagesData?.content ?? []).slice().reverse()

  // Yeni mesaj geldiyse: okundu işaretle + scroll
  useEffect(() => {
    if (!conversation || messages.length === 0) return
    const newest = messages[messages.length - 1]
    if (newest && newest.id !== lastSeenIdRef.current) {
      lastSeenIdRef.current = newest.id
      if (!newest.mine && !newest.isRead) {
        hotelApi.markConversationRead(conversation.id).then(() => onMessageSent?.()).catch(() => {})
      }
      setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, conversation, onMessageSent])

  // Sohbet değiştiğinde: lastSeen reset + okundu işaretle
  useEffect(() => {
    lastSeenIdRef.current = 0
    if (conversation) {
      hotelApi.markConversationRead(conversation.id).catch(() => {})
    }
  }, [conversation?.id])

  // Yeni mesajı cache'in başına ekle (optimistic update — anında UI'a yansır)
  // Backend page'i en yeniden eskiye sıralıyor → content[0] en yeni
  function appendMsg(msg) {
    if (!conversation) return
    queryClient.setQueryData(keys.conversations.messages(conversation.id), (old) => {
      if (!old) return { content: [msg] }
      return { ...old, content: [msg, ...old.content] }
    })
  }

  async function handleSend(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const msg = await hotelApi.sendMessage(conversation.id, content)
      appendMsg(msg)
      setDraft('')
      lastSeenIdRef.current = msg.id
      setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      onMessageSent?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  async function handleAttach(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || sending) return
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Dosya 15 MB\'dan büyük')
      return
    }
    setSending(true)
    try {
      const msg = await hotelApi.sendMessageAttachment(conversation.id, file, draft.trim())
      appendMsg(msg)
      setDraft('')
      lastSeenIdRef.current = msg.id
      setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      onMessageSent?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  // ── Sesli mesaj kaydı (MediaRecorder API) ──
  const [recording, setRecording] = useState(false)
  const [recDuration, setRecDuration] = useState(0)
  const recorderRef = useRef(null)
  const recChunksRef = useRef([])
  const recTimerRef = useRef(null)

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
        // Stream kapat
        stream.getTracks().forEach(t => t.stop())
        clearInterval(recTimerRef.current)
        const blob = new Blob(recChunksRef.current, { type: mime })
        if (blob.size < 1000) {
          toast.error('Kayıt çok kısa')
          return
        }
        const file = new File([blob], `ses-${Date.now()}.webm`, { type: mime })
        setSending(true)
        try {
          const msg = await hotelApi.sendMessageAttachment(conversation.id, file, '')
          appendMsg(msg)
          lastSeenIdRef.current = msg.id
          setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
          onMessageSent?.()
        } catch (err) {
          toast.error(extractErrorMessage(err))
        } finally {
          setSending(false)
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecDuration(0)
      recTimerRef.current = setInterval(() => setRecDuration(d => d + 1), 1000)
    } catch (err) {
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

  function fmtDuration(s) {
    const m = Math.floor(s / 60)
    const ss = String(s % 60).padStart(2, '0')
    return `${m}:${ss}`
  }

  // ── Drag & Drop dosya bırakma (ADIM 4) ──
  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)  // nested dragenter/leave için sayaç

  function handleDragEnter(e) {
    e.preventDefault()
    e.stopPropagation()
    // Sadece dosya sürükleniyorsa overlay aç (text/link sürüklemede açma)
    const hasFiles = Array.from(e.dataTransfer?.types || []).includes('Files')
    if (!hasFiles) return
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setIsDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current -= 1
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0
      setIsDragging(false)
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }

  async function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer?.files || [])
    if (dropped.length === 0 || sending || recording) return

    // Boyut kontrolü — büyük dosyaları ele
    const validFiles = dropped.filter(f => {
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} 15 MB'dan büyük — atlandı`)
        return false
      }
      return true
    })
    if (validFiles.length === 0) return

    setSending(true)
    try {
      // Sırayla upload — paralel yapsak server'ı zorlayabilir
      for (const file of validFiles) {
        try {
          const msg = await hotelApi.sendMessageAttachment(conversation.id, file, '')
          appendMsg(msg)
          lastSeenIdRef.current = msg.id
        } catch (err) {
          toast.error(`${file.name}: ${extractErrorMessage(err)}`)
        }
      }
      setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      onMessageSent?.()
      if (validFiles.length > 1) {
        toast.success(`${validFiles.length} dosya gönderildi`)
      }
    } finally {
      setSending(false)
    }
  }

  // ── Jitsi sesli/görüntülü arama daveti ──
  async function handleCall(type) {
    if (sending || recording) return
    // Rastgele room — tahmin edilemez, sohbet-bazlı isim
    const slug = `ajanshotel-${conversation.id}-${Math.random().toString(36).slice(2, 10)}`
    // Sesli arama için video muted: ?config.startWithVideoMuted=true
    const baseUrl = `https://meet.jit.si/${slug}`
    const callUrl = type === 'audio'
      ? `${baseUrl}#config.startWithVideoMuted=true`
      : baseUrl
    const content = `[CALL:${type}]${callUrl}`
    setSending(true)
    try {
      const msg = await hotelApi.sendMessage(conversation.id, content)
      appendMsg(msg)
      lastSeenIdRef.current = msg.id
      setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      onMessageSent?.()
      // Davet eden için aramayı hemen yeni tabda aç
      window.open(callUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-400 text-sm">
        Sohbet seçin
      </div>
    )
  }

  const initials = (conversation.otherPartyName || '?').charAt(0).toUpperCase()

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-ink-800 relative"
         onDragEnter={handleDragEnter}
         onDragLeave={handleDragLeave}
         onDragOver={handleDragOver}
         onDrop={handleDrop}>
      {/* Drag overlay — dosya sürüklenirken sohbet alanını kaplar */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none
                        bg-brand-900/40 backdrop-blur-sm border-4 border-dashed border-brand-400 rounded-lg">
          <div className="bg-white dark:bg-ink-700 rounded-2xl shadow-2xl px-8 py-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-brand-600 mb-2">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
            </svg>
            <div className="text-base font-bold text-ink-800 dark:text-ink-900">
              Dosyayı buraya bırak
            </div>
            <div className="text-xs text-ink-500 mt-1">
              PDF, JPG, PNG, MP3 — her biri max 15 MB
            </div>
          </div>
        </div>
      )}

      {/* Üst başlık */}
      <div className="px-4 py-3 border-b border-cream-200 dark:border-cream-300 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack}
          className="sm:hidden p-1 -ml-1 text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-800">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        {conversation.otherPartyAvatarUrl ? (
          <img src={cldImg(conversation.otherPartyAvatarUrl, { w: ImgSize.avatarSm })} alt={conversation.otherPartyName}
            loading="lazy" decoding="async"
            className="w-9 h-9 rounded-full object-cover border border-cream-300" />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-cream-100 dark:bg-ink-700 border border-cream-300 dark:border-ink-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-ink-400 dark:text-ink-500">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-ink-800 dark:text-ink-900 text-sm truncate">
            {conversation.otherPartyName}
          </div>
          {conversation.listingTitle && (
            <div className="text-xs text-brand-700 dark:text-brand-700 truncate">
              {conversation.listingTitle}
            </div>
          )}
        </div>
      </div>

      {/* Mesaj akışı */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-cream-50 dark:bg-ink-900">
        {loading ? (
          <SkeletonMessages count={5} />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-ink-400">
            Sohbete ilk mesajı sen yaz
          </div>
        ) : messages.map(m => <MessageBubble key={m.id} m={m} />)}
        {/* FAZ 1/#60 — Karşı taraf yazıyor göstergesi */}
        {otherTyping && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-500 fade-in">
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            <span>{conversation?.otherPartyName || 'Karşı taraf'} yazıyor...</span>
          </div>
        )}
        <div ref={scrollAnchorRef} />
      </div>

      {/* Kompozer — dosya ekle + metin + sesli mesaj + gönder */}
      <form onSubmit={handleSend} className="px-3 py-3 border-t border-cream-200 dark:border-cream-300 flex items-center gap-2 flex-shrink-0">
        {/* Kayıt modu: özel UI */}
        {recording ? (
          <>
            <button type="button" onClick={() => stopRecording(true)}
                    className="w-10 h-10 grid place-items-center rounded-full bg-cream-200 dark:bg-slate-700
                               text-ink-600 dark:text-ink-300 hover:bg-cream-300 transition-colors shrink-0"
                    title="İptal">
              ×
            </button>
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-red-700 dark:text-red-300 font-mono">
                Kayıt {fmtDuration(recDuration)}
              </span>
              <span className="text-[11px] text-ink-500 ml-auto">Göndermek için durdur</span>
            </div>
            <button type="button" onClick={() => stopRecording(false)}
                    disabled={sending}
                    className="px-4 py-2 rounded-lg text-white text-sm font-semibold flex-shrink-0
                               bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">
              Durdur ↑
            </button>
          </>
        ) : (
          <>
            {/* Dosya ekle butonu */}
            <input ref={fileInputRef} type="file"
                   accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.mp3,.m4a,.ogg,.wav,.webm"
                   onChange={handleAttach} className="hidden" />
            <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Dosya / Foto ekle"
                    className="w-10 h-10 grid place-items-center rounded-full bg-cream-100 dark:bg-ink-700
                               hover:bg-cream-200 dark:hover:bg-slate-700 text-ink-600 dark:text-ink-300
                               disabled:opacity-50 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
              </svg>
            </button>

            {/* Sesli mesaj kayıt başlat */}
            <button type="button"
                    onClick={startRecording}
                    disabled={sending}
                    title="Sesli mesaj kaydet"
                    className="w-10 h-10 grid place-items-center rounded-full bg-cream-100 dark:bg-ink-700
                               hover:bg-cream-200 dark:hover:bg-slate-700 text-ink-600 dark:text-ink-300
                               disabled:opacity-50 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </button>

            {/* Sesli arama (Jitsi) */}
            <button type="button"
                    onClick={() => handleCall('audio')}
                    disabled={sending}
                    title="Sesli arama başlat (Jitsi)"
                    className="w-10 h-10 grid place-items-center rounded-full bg-cream-100 dark:bg-ink-700
                               hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-ink-600 dark:text-ink-300
                               hover:text-brand-700 disabled:opacity-50 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
              </svg>
            </button>

            {/* Görüntülü arama (Jitsi) */}
            <button type="button"
                    onClick={() => handleCall('video')}
                    disabled={sending}
                    title="Görüntülü arama başlat (Jitsi)"
                    className="w-10 h-10 grid place-items-center rounded-full bg-cream-100 dark:bg-ink-700
                               hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-ink-600 dark:text-ink-300
                               hover:text-brand-700 disabled:opacity-50 transition-colors shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </button>

            <input type="text" value={draft}
              onChange={e => {
                setDraft(e.target.value)
                // FAZ 1/#60 — Yazıyor sinyali (her tuş vuruşunda; backend timeout 3sn)
                if (conversation?.id) {
                  wsPublish(`/app/chat.typing/${conversation.id}`, {})
                }
              }}
              placeholder="Mesaj yaz..." maxLength={2000}
              className="input text-sm flex-1" disabled={sending} />
            <button type="submit"
              disabled={sending || !draft.trim()}
              className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex-shrink-0 bg-brand-700 hover:bg-brand-800 transition-colors">
              {sending ? '...' : 'Gönder'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}

/* ── Ana sayfa ── */
export default function MessagesPage() {
  const [activeId, setActiveId] = useState(null)
  const [showListMobile, setShowListMobile] = useState(true)
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const wsOk = useWsConnected()  // FAZ 4.8

  // FAZ 4.8 — WS reconnect olunca tek seferlik catch-up
  useWsReconnectInvalidate([
    keys.conversations.list(),
    keys.conversations.unreadCount(),
  ])

  // F0.10 + FAZ 1/#12 — Conversations useQuery
  // WS aktifken push gelir; WS koparsa 60sn fallback polling.
  const { data: convData, isLoading: loading } = useQuery({
    queryKey: keys.conversations.list(),
    queryFn: () => hotelApi.getMyConversations({ size: 50 }),
    refetchInterval: wsOk ? false : 60000,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  })
  const conversations = convData?.content ?? []

  // Arama: kişi adı + listingTitle + son mesaj preview üzerinden filtrele
  const filteredConvs = (() => {
    if (!search.trim()) return conversations
    const q = search.trim().toLowerCase()
    return conversations.filter(c =>
      (c.otherPartyName || '').toLowerCase().includes(q) ||
      (c.listingTitle || '').toLowerCase().includes(q) ||
      (c.lastMessagePreview || '').toLowerCase().includes(q)
    )
  })()

  // Yeni mesaj gönderildiğinde sohbet listesini refetch et (lastMessage preview için)
  function refetchConvs() {
    queryClient.invalidateQueries({ queryKey: keys.conversations.list() })
  }

  const active = conversations.find(c => c.id === activeId) || null

  function selectConversation(c) {
    setActiveId(c.id)
    setShowListMobile(false)
  }

  return (
    <div className="card overflow-hidden" style={{ height: 'calc(100vh - 12rem)', minHeight: 480 }}>
      <div className="flex h-full">
        {/* Sol — Sohbet listesi */}
        <div className={`${showListMobile ? 'flex' : 'hidden sm:flex'} flex-col w-full sm:w-80 sm:min-w-[20rem] border-r border-cream-200 dark:border-cream-300 bg-white dark:bg-ink-800`}>
          <div className="px-4 py-3 border-b border-cream-200 dark:border-cream-300 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-ink-800 dark:text-ink-900">Mesajlar</h3>
              <p className="text-[11px] text-ink-400 dark:text-ink-500">
                {filteredConvs.length}{search ? ` / ${conversations.length}` : ''} sohbet
              </p>
            </div>
            {/* Arama kutusu */}
            <div className="relative">
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                     placeholder="Kişi, ilan veya mesaj ara..."
                     className="input text-xs h-8 pl-7 pr-6" />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={2} stroke="currentColor"
                   className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              {search && (
                <button type="button" onClick={() => setSearch('')}
                        title="Aramayı temizle"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center
                                   text-ink-400 hover:text-ink-700">
                  ×
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <SkeletonConversationList count={4} />
            ) : conversations.length === 0 ? (
              <div className="empty-state py-12 px-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-ink-300 mb-3 mx-auto">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <p className="text-sm text-ink-500">Henüz sohbetin yok</p>
                <p className="text-xs text-ink-400 mt-1">
                  Bir ilana başvurduğunda işletmeyle otomatik sohbet açılır
                </p>
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-ink-400">
                "{search}" araması için sonuç bulunamadı.
              </div>
            ) : filteredConvs.map(c => (
              <ConversationItem key={c.id} conv={c}
                isActive={c.id === activeId}
                onClick={() => selectConversation(c)} />
            ))}
          </div>
        </div>

        {/* Orta — Aktif sohbet */}
        <div className={`${!showListMobile ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0`}>
          <ChatWindow
            conversation={active}
            onBack={() => setShowListMobile(true)}
            onMessageSent={refetchConvs} />
        </div>

        {/* Sağ — Detay paneli (FAZ 1/#48 — sadece desktop xl+) */}
        {active && (
          <ConversationDetailPanel conversation={active} />
        )}
      </div>
    </div>
  )
}

/* FAZ 5.8 — Slack tarzi 3. sutun: sohbet detay paneli (lg+ ekranlarda, dark glass) */
function ConversationDetailPanel({ conversation }) {
  const c = conversation
  const online = useOnline(c?.otherPartyId)
  const [reportOpen, setReportOpen] = useState(false)

  const startedDays = c?.createdAt
    ? Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000)
    : null
  const startedLabel = startedDays == null ? '—'
    : startedDays === 0 ? 'Bugün'
    : startedDays === 1 ? 'Dün'
    : startedDays < 7 ? `${startedDays} gün önce`
    : new Date(c.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  const initial = (c?.otherPartyName?.charAt(0) || '?').toUpperCase()
  const isBiz = c?.otherPartyRole === 'BUSINESS_OWNER'

  return (
    <>
      <div
        className="hidden lg:flex flex-col w-80 min-w-[20rem] border-l overflow-hidden relative"
        style={{
          background: 'linear-gradient(180deg, rgba(20, 14, 38, 0.92) 0%, rgba(15, 10, 30, 0.92) 100%)',
          borderColor: 'rgba(168, 85, 247, 0.18)',
          zIndex: 5,  // FAZ 5.8 polish — ReportModal (z-50) ile catismayi onler
        }}
      >
        {/* Avatar + isim header — Bebas + radial glow */}
        <div className="relative px-5 py-6 text-center border-b" style={{ borderColor: 'rgba(168, 85, 247, 0.14)' }}>
          {/* Dekoratif glow */}
          <div
            aria-hidden
            className="absolute pointer-events-none inset-0"
            style={{
              background:
                'radial-gradient(circle 200px at 50% 0%, rgba(168, 85, 247, 0.22) 0%, transparent 65%)',
            }}
          />
          <div className="relative">
            <div className="relative inline-block mb-3">
              {c.otherPartyAvatarUrl ? (
                <img
                  src={cldImg(c.otherPartyAvatarUrl, { w: ImgSize.avatarMd })}
                  alt={c.otherPartyName}
                  loading="lazy" decoding="async"
                  className="w-20 h-20 rounded-full object-cover"
                  style={{ border: '2px solid rgba(168, 85, 247, 0.40)', boxShadow: '0 0 24px rgba(168, 85, 247, 0.30)' }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center font-bebas text-3xl text-white"
                  style={{
                    background: 'linear-gradient(135deg, #6b21a8 0%, #9333ea 100%)',
                    boxShadow: '0 0 24px rgba(168, 85, 247, 0.40)',
                    border: '2px solid rgba(217, 70, 239, 0.30)',
                  }}
                >
                  {initial}
                </div>
              )}
              {online && (
                <span
                  className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full"
                  style={{ background: '#22c55e', border: '2.5px solid #15102e', boxShadow: '0 0 10px rgba(34, 197, 94, 0.55)' }}
                  title="Çevrimiçi"
                />
              )}
            </div>
            <h3
              className="font-bebas text-xl tracking-wider uppercase text-white truncate"
              style={{ textShadow: '0 0 12px rgba(168, 85, 247, 0.40)' }}
            >
              {c.otherPartyName}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: online ? '#22c55e' : '#52525b', boxShadow: online ? '0 0 6px #22c55e' : 'none' }}
              />
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: online ? '#86efac' : '#a5b4fc' }}>
                {online ? 'Çevrimiçi' : 'Çevrimdışı'}
              </span>
              {c.otherPartyRole && (
                <>
                  <span style={{ color: '#7c3aed' }}>·</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#d8b4fe' }}>
                    {isBiz ? 'İşletme' : 'Aday'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ilan kart */}
        {c.listingTitle && (
          <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(168, 85, 247, 0.10)' }}>
            <div className="font-bebas text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#c4b5fd' }}>
              İlan
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(20, 14, 38, 0.55)',
                border: '1px solid rgba(168, 85, 247, 0.18)',
              }}
            >
              <div className="text-sm font-semibold text-white line-clamp-2 mb-2">{c.listingTitle}</div>
              {c.listingId && (
                <a
                  href={`/listings/${c.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #6b21a8, #9333ea)',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(168, 85, 247, 0.40)',
                  }}
                >
                  İlana Git →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Sohbet istatistik — kompakt */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(168, 85, 247, 0.10)' }}>
          <div className="font-bebas text-[10px] tracking-[0.25em] uppercase mb-2.5" style={{ color: '#c4b5fd' }}>
            Sohbet
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span style={{ color: '#a5b4fc' }}>Başladı</span>
              <span className="font-bold" style={{ color: '#ede9fe' }}>{startedLabel}</span>
            </div>
            {c.lastMessageAt && (
              <div className="flex justify-between items-center">
                <span style={{ color: '#a5b4fc' }}>Son mesaj</span>
                <span className="font-bold" style={{ color: '#ede9fe' }}>{formatRelative(c.lastMessageAt)}</span>
              </div>
            )}
            {c.unreadCount > 0 && (
              <div className="flex justify-between items-center">
                <span style={{ color: '#a5b4fc' }}>Okunmamış</span>
                <span
                  className="font-bold text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #6b21a8, #9333ea)',
                    color: '#ffffff',
                  }}
                >
                  {c.unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Hizli islemler */}
        <div className="px-5 py-4 space-y-2 flex-1">
          <div className="font-bebas text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: '#c4b5fd' }}>
            Hızlı İşlemler
          </div>
          <button
            onClick={() => {
              if (c.listingId) window.open(`/listings/${c.listingId}`, '_blank')
            }}
            disabled={!c.listingId}
            className="w-full text-left text-[12px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(20, 14, 38, 0.55)',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.18)',
            }}
          >
            <span className="font-bebas text-base" style={{ color: '#e879f9' }}>↗</span>
            <span className="font-semibold">İlanı Görüntüle</span>
          </button>
          <button
            onClick={() => setReportOpen(true)}
            className="w-full text-left text-[12px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(239, 68, 68, 0.10)',
              color: '#fca5a5',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <span className="font-bebas text-base">!</span>
            <span className="font-semibold">Kullanıcıyı Bildir</span>
          </button>
        </div>

        {/* Alt imza */}
        <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'rgba(168, 85, 247, 0.10)' }}>
          <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: '#7c3aed' }}>
            AjansHotel · Sohbet
          </span>
        </div>
      </div>

      {/* Bildir modal */}
      {reportOpen && c?.otherPartyId && (
        <ReportModal
          targetType="USER"
          targetId={c.otherPartyId}
          targetLabel={c.otherPartyName}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  )
}
