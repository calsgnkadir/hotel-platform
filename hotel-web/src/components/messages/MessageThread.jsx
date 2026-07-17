/**
 * FAZ 17 — Messages Hub orta sutun: mesaj thread'i + composer.
 *
 * MessagesPage.jsx monolitinden birebir cikarildi (eski adi ChatWindow).
 * Icerik: mesaj sorgusu, WS abonelikleri (mesaj/typing/reaction), reaksiyon
 * toggle, offline kuyruk, gonderim/ek/pano/ses kaydi/surukle-birak/Jitsi
 * arama, turn-grouping render, scroll pill, quoted reply stub, composer.
 *
 * Not: Bu dosya hala buyuk (~900 satir). Sonraki adim composer'i
 * MessageComposer.jsx'e ayirmak — ama once bu tasima dogrulanmali.
 */
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { keys } from '../../lib/queryClient'
import cldImg, { ImgSize } from '../../lib/cldImg'
import { SkeletonMessages } from '../Skeleton'
import { wsSubscribe, wsPublish } from '../../lib/websocket'
import useWsConnected from '../../lib/useWsConnected'
import MessageBubble from './MessageBubble'

export default function MessageThread({ conversation, onBack, onMessageSent }) {
  const { user } = useAuth()
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const fileInputRef = useRef(null)
  const lastSeenIdRef = useRef(0)
  const scrollAnchorRef = useRef(null)
  const scrollContainerRef = useRef(null)  // FAZ 11.W3.4 — scroll pill icin
  const queryClient = useQueryClient()
  const wsOk = useWsConnected()  // FAZ 4.8 — WS bağlıyken polling KAPALI

  // FAZ 11.W3.3 — Quoted reply state
  const [replyTo, setReplyTo] = useState(null)
  // FAZ 11.W3.4 — Scroll pill: kullanici yukaridayken gelen mesaj sayisi
  const [pendingNewCount, setPendingNewCount] = useState(0)

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
        // FAZ 11.W3.4 — kullanici yukaridaysa scroll pill sayacini artir
        const el = scrollContainerRef.current
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 200) {
          setPendingNewCount(c => c + 1)
        }
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
    // FAZ 11.W3.3 — Reaksiyon guncellemeleri: cache'deki mesajin reactions alanini yaz
    const subReactions = wsSubscribe('/user/queue/reactions', (payload) => {
      if (payload?.conversationId !== conversation.id) return
      queryClient.setQueryData(keys.conversations.messages(conversation.id), (old) => {
        if (!old?.content) return old
        return {
          ...old,
          content: old.content.map(msg =>
            msg.id === payload.messageId ? { ...msg, reactions: payload.reactions } : msg
          ),
        }
      })
    })
    return () => {
      subMsg.unsubscribe()
      subTyping.unsubscribe()
      subReactions.unsubscribe()
      clearTimeout(typingTimeoutRef.current)
    }
  }, [conversation?.id, queryClient])

  // FAZ 11.W3.3 — Reaksiyon toggle (optimistic yok — WS push aninda gelir)
  async function handleReact(msg, reaction) {
    try {
      const updated = await hotelApi.toggleMessageReaction(conversation.id, msg.id, reaction)
      queryClient.setQueryData(keys.conversations.messages(conversation.id), (old) => {
        if (!old?.content) return old
        return {
          ...old,
          content: old.content.map(m => m.id === msg.id ? { ...m, reactions: updated } : m),
        }
      })
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  // FAZ 11.W3.4 — Offline send queue: WS/agin koptugu anda gonderilen mesajlar
  // sessionStorage'a yazilir, baglanti gelince otomatik drain edilir.
  const OFFLINE_QUEUE_KEY = `ajanshotel.offline-queue.${conversation?.id}`
  function queueOffline(content, parentMessageId) {
    try {
      const q = JSON.parse(sessionStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
      q.push({ content, parentMessageId, at: Date.now() })
      sessionStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q))
    } catch {}
  }
  useEffect(() => {
    if (!wsOk || !conversation) return
    // Baglanti geldi — kuyrugu drain et
    let cancelled = false
    async function drain() {
      let q = []
      try { q = JSON.parse(sessionStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') } catch {}
      if (q.length === 0) return
      sessionStorage.removeItem(OFFLINE_QUEUE_KEY)
      for (const item of q) {
        if (cancelled) return
        try {
          const msg = await hotelApi.sendMessage(conversation.id, item.content, item.parentMessageId || null)
          appendMsg(msg)
        } catch {
          queueOffline(item.content, item.parentMessageId)  // tekrar kuyrukla
          return
        }
      }
      toast.success(`${q.length} bekleyen mesaj gönderildi`)
      onMessageSent?.()
    }
    drain()
    return () => { cancelled = true }
  }, [wsOk, conversation?.id])

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
  // Backend page'i en yeniden eskiye sıralıyor content[0] en yeni
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
    const parentId = replyTo?.id || null
    try {
      const msg = await hotelApi.sendMessage(conversation.id, content, parentId)
      appendMsg(msg)
      setDraft('')
      setReplyTo(null)
      lastSeenIdRef.current = msg.id
      setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      onMessageSent?.()
    } catch (err) {
      // FAZ 11.W3.4 — Network hatasi ise offline kuyruga al, form'u bosaltma
      const isNetwork = !err.response || err.code === 'ERR_NETWORK'
      if (isNetwork) {
        queueOffline(content, parentId)
        setDraft('')
        setReplyTo(null)
        toast('Bağlantı yok — mesaj kuyruğa alındı, bağlanınca gönderilecek', {
          icon: null, duration: 4000,
        })
      } else {
        toast.error(extractErrorMessage(err))
      }
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

  // FAZ G.5 — Pano'dan foto/dosya yapıştırma (screenshot kopyalayıp Ctrl+V)
  async function handlePaste(e) {
    if (sending || recording) return
    const items = Array.from(e.clipboardData?.items || [])
    const fileItem = items.find(it => it.kind === 'file')
    if (!fileItem) return  // sadece metin yapıştırma — default davranış
    const file = fileItem.getAsFile()
    if (!file) return
    e.preventDefault()
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Dosya 15 MB\'dan büyük')
      return
    }
    // Pano'dan gelen image genelde "image.png" gibi; ad ile orijinali koru
    const stamped = file.name && file.name !== 'image.png'
      ? file
      : new File([file], `pano-${Date.now()}.${(file.type.split('/')[1] || 'png')}`, { type: file.type })
    setSending(true)
    try {
      const msg = await hotelApi.sendMessageAttachment(conversation.id, stamped, draft.trim())
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
      <div className="flex-1 flex items-center justify-center px-6 relative overflow-hidden">
        {/* Ambient partiküller — yumuşak altın */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          {[
            { left: 28, top: 32, size: 3, delay: 0 },
            { left: 65, top: 22, size: 2, delay: 1.2 },
            { left: 78, top: 60, size: 2.5, delay: 2.4 },
            { left: 22, top: 70, size: 2, delay: 3.6 },
            { left: 50, top: 80, size: 1.8, delay: 0.6 },
          ].map((p, i) => (
            <motion.span key={i}
              animate={{ y: [0, -16, 0], opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
              className="absolute rounded-full"
              style={{
                left: `${p.left}%`, top: `${p.top}%`,
                width: p.size, height: p.size,
                background: '#d4a853',
                boxShadow: '0 0 8px #d4a853',
              }} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 140, damping: 18 }}
          className="text-center max-w-xs relative"
        >
          {/* Floating chat bubble illustrasyonu */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-28 h-28 mx-auto mb-6"
          >
            <div className="absolute inset-0 rounded-full"
                 style={{
                   background: 'radial-gradient(circle, rgba(205, 183, 143, 0.22) 0%, transparent 65%)',
                   filter: 'blur(12px)',
                 }} />
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="relative w-full h-full">
              <defs>
                <linearGradient id="bubble-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"  stopColor="#cdb78f" />
                  <stop offset="100%" stopColor="#b8902d" />
                </linearGradient>
              </defs>
              <path d="M14 12h32a8 8 0 0 1 8 8v18a8 8 0 0 1-8 8H24l-10 8V20a8 8 0 0 1 0-8z"
                    fill="rgba(13, 11, 9, 0.85)"
                    stroke="url(#bubble-grad)" strokeWidth="1.5" />
              <circle cx="24" cy="29" r="2" fill="#cdb78f" opacity="0.9" />
              <circle cx="32" cy="29" r="2" fill="#cdb78f" opacity="0.9" />
              <circle cx="40" cy="29" r="2" fill="#cdb78f" opacity="0.9" />
            </svg>
          </motion.div>
          <h3 className="text-[18px] font-semibold mb-2" style={{ color: '#ffffff', letterSpacing: '-0.015em' }}>
            <em className="not-italic font-semibold" style={{
              background: 'linear-gradient(135deg, #cdb78f 0%, #d4a853 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Sohbet</em> seçin
          </h3>
          <p className="text-[12.5px] leading-relaxed" style={{ color: '#c9bdaa' }}>
            Soldan bir sohbet seç veya yeni bir ilana başvur — her başvuru otomatik bir sohbet açar.
          </p>
        </motion.div>
      </div>
    )
  }

  const initials = (conversation.otherPartyName || '?').charAt(0).toUpperCase()

  return (
    <div className="flex-1 flex flex-col h-full relative"
         style={{ background: 'var(--surface-base)' }}
         onDragEnter={handleDragEnter}
         onDragLeave={handleDragLeave}
         onDragOver={handleDragOver}
         onDrop={handleDrop}>
      {/* Drag overlay — dosya sürüklenirken sohbet alanını kaplar */}
      {isDragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none rounded-lg"
             style={{
               background: 'rgba(205, 183, 143, 0.10)',
               backdropFilter: 'blur(4px)',
               border: '4px dashed rgba(205, 183, 143, 0.45)',
             }}>
          <div className="tier-featured px-8 py-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-2 text-champagne-300">
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
            </svg>
            <div className="type-heading" style={{ fontSize: '16px' }}>
              Dosyayı buraya bırak
            </div>
            <div className="type-caption mt-1">
              PDF, JPG, PNG, MP3 — her biri max 15 MB
            </div>
          </div>
        </div>
      )}

      {/* Üst başlık */}
      <div className="px-4 py-3 border-b border-hairline flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack}
          className="sm:hidden p-1 -ml-1 text-ivory-600 hover:text-ivory-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        {conversation.otherPartyAvatarUrl ? (
          <img src={cldImg(conversation.otherPartyAvatarUrl, { w: ImgSize.avatarSm })} alt={conversation.otherPartyName}
            loading="lazy" decoding="async"
            className="w-9 h-9 rounded-full object-cover"
            style={{ border: '1px solid rgba(205, 183, 143, 0.22)' }} />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
               style={{
                 background: 'rgba(205, 183, 143, 0.08)',
                 border: '1px solid rgba(205, 183, 143, 0.22)',
                 color: 'var(--accent-action)',
               }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="type-body font-semibold truncate" style={{ color: 'var(--text-headline)' }}>
            {conversation.otherPartyName}
          </div>
          {conversation.listingTitle && (
            <div className="type-caption truncate" style={{ color: 'var(--accent-action)' }}>
              {conversation.listingTitle}
            </div>
          )}
        </div>
      </div>

      {/* Mesaj akışı — GROUND tier (page bg, cards konusuyor uzerinde) */}
      <div ref={scrollContainerRef}
           className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 relative"
           style={{ background: 'var(--surface-base)' }}
           onScroll={(e) => {
             // Dibe yaklasinca pill'i sifirla
             const el = e.currentTarget
             if (el.scrollHeight - el.scrollTop - el.clientHeight < 200 && pendingNewCount > 0) {
               setPendingNewCount(0)
             }
           }}>
        {loading ? (
          <SkeletonMessages count={5} />
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full type-body" style={{ color: 'var(--text-muted)' }}>
            Sohbete ilk mesajı sen yaz
          </div>
        ) : messages.map((m, i) => {
          // FAZ 11.W3.2 — Turn-change grouping: farkli gonderen VEYA 5dk+ gap = yeni turn
          const prev = messages[i - 1]
          const isNewTurn = !prev
            || prev.senderId !== m.senderId
            || (new Date(m.sentAt) - new Date(prev.sentAt)) > 5 * 60_000
          return (
            <div key={m.id} className={isNewTurn ? 'pt-2.5' : ''}>
              <MessageBubble m={m} showMeta={isNewTurn}
                             onReply={setReplyTo} onReact={handleReact} />
            </div>
          )
        })}
        {/* FAZ 1/#60 + G.7 — Karşı taraf yazıyor göstergesi (altın sine wave) */}
        {otherTyping && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-500 fade-in">
            <TypingSineWave />
            <span>{conversation?.otherPartyName || 'Karşı taraf'} yazıyor…</span>
          </div>
        )}
        <div ref={scrollAnchorRef} />
      </div>

      {/* FAZ 11.W3.4 — Scroll pill: kullanici yukarida + yeni mesaj geldi */}
      {pendingNewCount > 0 && (
        <div className="relative">
          <button type="button"
                  onClick={() => {
                    setPendingNewCount(0)
                    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="absolute -top-12 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full type-overline flex items-center gap-1.5 transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    color: '#1a1208',
                    boxShadow: '0 6px 18px rgba(205, 183, 143, 0.40)',
                  }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {pendingNewCount} yeni mesaj
          </button>
        </div>
      )}

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
          <button type="button" onClick={() => setReplyTo(null)}
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
          role={user?.role}
          listingTitle={conversation?.listingTitle}
          onPick={(text) => setDraft(d => d ? d + ' ' + text : text)}
          messageCount={messages.length}
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
            <button type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    title="Dosya / Foto ekle"
                    className="tier-raised tier-raised-hover w-10 h-10 grid place-items-center disabled:opacity-50 shrink-0"
                    style={{ borderRadius: '999px', color: 'var(--text-secondary)' }}>
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
                    className="tier-raised tier-raised-hover w-10 h-10 grid place-items-center disabled:opacity-50 shrink-0"
                    style={{ borderRadius: '999px', color: 'var(--text-secondary)' }}>
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
                    className="tier-raised tier-raised-hover w-10 h-10 grid place-items-center disabled:opacity-50 shrink-0"
                    style={{ borderRadius: '999px', color: 'var(--text-secondary)' }}>
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
                    className="tier-raised tier-raised-hover w-10 h-10 grid place-items-center disabled:opacity-50 shrink-0"
                    style={{ borderRadius: '999px', color: 'var(--text-secondary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </button>

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
    </div>
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

/* ─────────── FAZ G.7 — Altın sine wave typing indicator ─────────── */
function TypingSineWave() {
  return (
    <span style={{
      display: 'inline-block',
      width: 28, height: 14,
      overflow: 'hidden',
    }} aria-hidden="true">
      <svg width="56" height="14" viewBox="0 0 56 14"
           style={{ animation: 'tw-shift 1.4s linear infinite' }}>
        <path d="M0 7 Q 3.5 1 7 7 T 14 7 T 21 7 T 28 7 T 35 7 T 42 7 T 49 7 T 56 7"
              fill="none" stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <style>{`
        @keyframes tw-shift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </span>
  )
}

/* ─────────── FAZ G.6 — Bağlamlı hızlı yanıt çipleri ─────────── */
function QuickReplyChips({ role, listingTitle, onPick, messageCount }) {
  // Sadece ilk birkaç mesajda göster — uzun sohbette gürültü olur
  if (messageCount > 6) return null

  const isBiz = role === 'BUSINESS_OWNER'
  const sets = {
    candidate: [
      { t: 'Müsaitim, detay verir misiniz?', emoji: null },
      { t: 'Hangi gün başlıyor?',            emoji: null },
      { t: 'Ücret günlük mü saatlik mi?',    emoji: null },
      { t: 'Adresi paylaşır mısınız?',       emoji: null },
      { t: 'Teşekkürler, dönüş yapacağım.',  emoji: null },
    ],
    business: [
      { t: 'Hafta sonu uygun musun?',                   emoji: null },
      { t: 'Saat 14:00\'te işbaşı yapabilir misin?',    emoji: null },
      { t: 'Hangi tarihler müsaitsin?',                 emoji: null },
      { t: 'Daha önce benzer bir yerde çalıştın mı?',   emoji: null },
      { t: 'Yarın 09:00\'da görüşmeye gelir misin?',    emoji: null },
    ],
  }
  const chips = isBiz ? sets.business : sets.candidate

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
        {chips.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick?.(c.t)}
            className="px-3 py-1.5 rounded-full text-[12px] whitespace-nowrap transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(205, 183, 143, 0.08)',
              color: '#1b1815',
              border: '1px solid rgba(205, 183, 143, 0.22)',
              flexShrink: 0,
            }}>
            {c.t}
          </button>
        ))}
      </div>
    </div>
  )
}

