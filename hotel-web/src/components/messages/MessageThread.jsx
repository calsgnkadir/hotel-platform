/**
 * FAZ 20 — Messages Hub orta sutun: mesaj thread'i.
 *
 * FAZ 17'de MessagesPage monolitinden cikarilmisti ama hala ~940 satirdi ve
 * "sonraki adim composer'i ayirmak" diye not dusulmustu. Ayrildi:
 *
 *   useMessageSend.js    — gonderim motoru (metin/dosya/arama + offline kuyruk)
 *   MessageComposer.jsx  — taslak metin, ses kaydi, hizli yanit, form
 *   EmptyThread.jsx      — "sohbet secin" ekrani
 *
 * Burada kalan: sohbetin OKUNMASI — mesaj sorgusu, WS abonelikleri
 * (mesaj/reaction), reaksiyon toggle, okundu isaretleme, scroll
 * yonetimi, turn-grouping render, surukle-birak alani.
 */
import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../api/hotel'
import { extractErrorMessage } from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { keys } from '../../lib/queryClient'
import cldImg, { ImgSize } from '../../lib/cldImg'
import { SkeletonMessages } from '../Skeleton'
import { wsSubscribe } from '../../lib/websocket'
import useWsConnected from '../../lib/useWsConnected'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'
import EmptyThread from './EmptyThread'
import useMessageSend from './useMessageSend'

/** Kullanici dipten bu kadar uzaktaysa "yukarida" sayilir (scroll pill esigi). */
const SCROLL_BOTTOM_THRESHOLD = 200
/** Farkli gonderen VEYA bu kadar bosluk = yeni turn (grouping). */
const TURN_GAP_MS = 5 * 60_000

/* FAZ 25 — Gun ayraci (WhatsApp gibi): farkli gunlerde atilan mesajlar
   arasina "Bugün / Dün / 14 Temmuz" ortali etiket girer. */
function dayKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function dayLabel(iso) {
  const d = new Date(iso); d.setHours(0, 0, 0, 0)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((today - d) / 86400000)
  if (diff === 0) return 'Bugün'
  if (diff === 1) return 'Dün'
  const sameYear = d.getFullYear() === today.getFullYear()
  return d.toLocaleDateString('tr-TR', sameYear
    ? { day: 'numeric', month: 'long' }
    : { day: 'numeric', month: 'long', year: 'numeric' })
}
function DayDivider({ label }) {
  return (
    <div className="flex justify-center py-2">
      <span style={{
        fontSize: '11.5px', fontWeight: 600, color: 'var(--ah-ink-3)',
        padding: '4px 12px', borderRadius: '999px',
        background: 'var(--ah-card)', border: '1px solid var(--ah-line)',
      }}>{label}</span>
    </div>
  )
}

export default function MessageThread({ conversation, onBack, onMessageSent }) {
  const { user } = useAuth()
  const lastSeenIdRef = useRef(0)
  const scrollAnchorRef = useRef(null)
  const scrollContainerRef = useRef(null)  // FAZ 11.W3.4 — scroll pill icin
  const queryClient = useQueryClient()
  const wsOk = useWsConnected()  // FAZ 4.8 — WS bağlıyken polling KAPALI

  // FAZ 11.W3.3 — Quoted reply state (MessageBubble'dan set edilir, composer gosterir)
  const [replyTo, setReplyTo] = useState(null)
  // FAZ 11.W3.4 — Scroll pill: kullanici yukaridayken gelen mesaj sayisi
  const [pendingNewCount, setPendingNewCount] = useState(0)
  // Composer kayittayken surukle-birak bloklanir (overlay thread genisliginde)
  const [composerRecording, setComposerRecording] = useState(false)

  function scrollToBottom() {
    setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // FAZ 20 — Gonderim motoru. Her basarili gonderimde onSent tetiklenir.
  const { sending, sendText, sendFile, sendFiles, sendCall } = useMessageSend({
    conversation,
    onSent: (msg) => { lastSeenIdRef.current = msg.id; scrollToBottom() },
    onMessageSent,
  })

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
  // FAZ 24 — "yazıyor" / presence kaldirildi (kullanici istegi: WhatsApp gibi
  // sadece mesaj saati). Typing aboneligi + gostergesi cikarildi.
  useEffect(() => {
    if (!conversation) return
    const subMsg = wsSubscribe('/user/queue/messages', (payload) => {
      if (payload?.conversationId === conversation.id) {
        queryClient.invalidateQueries({ queryKey: keys.conversations.messages(conversation.id) })
        // FAZ 11.W3.4 — kullanici yukaridaysa scroll pill sayacini artir
        const el = scrollContainerRef.current
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight > SCROLL_BOTTOM_THRESHOLD) {
          setPendingNewCount(c => c + 1)
        }
      }
      // Her durumda sohbet listesi de yenilensin (preview/lastMessageAt)
      queryClient.invalidateQueries({ queryKey: keys.conversations.list() })
      queryClient.invalidateQueries({ queryKey: keys.conversations.unreadCount() })
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
      subReactions.unsubscribe()
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
      scrollToBottom()
    }
  }, [messages, conversation, onMessageSent])

  // Sohbet değiştiğinde: lastSeen reset + okundu işaretle
  useEffect(() => {
    lastSeenIdRef.current = 0
    if (conversation) {
      hotelApi.markConversationRead(conversation.id).catch(() => {})
    }
  }, [conversation?.id])

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

  function handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    const dropped = Array.from(e.dataTransfer?.files || [])
    if (dropped.length === 0 || sending || composerRecording) return
    sendFiles(dropped)
  }

  if (!conversation) return <EmptyThread />

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
               background: 'rgba(15, 118, 110, 0.10)',
               backdropFilter: 'blur(4px)',
               border: '4px dashed rgba(15, 118, 110, 0.45)',
             }}>
          <div className="tier-featured px-8 py-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.5} stroke="#0f766e" className="w-12 h-12 mx-auto mb-2">
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
            style={{ border: '1px solid rgba(15, 118, 110, 0.22)' }} />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center"
               style={{
                 background: 'rgba(15, 118, 110, 0.08)',
                 border: '1px solid rgba(15, 118, 110, 0.22)',
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
             if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD && pendingNewCount > 0) {
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
            || (new Date(m.sentAt) - new Date(prev.sentAt)) > TURN_GAP_MS
          // FAZ 25 — Gun degistiyse once ayrac
          const showDay = !prev || dayKey(prev.sentAt) !== dayKey(m.sentAt)
          return (
            <div key={m.id}>
              {showDay && <DayDivider label={dayLabel(m.sentAt)} />}
              <div className={isNewTurn && !showDay ? 'pt-2.5' : ''}>
                <MessageBubble m={m} showMeta={isNewTurn}
                               onReply={setReplyTo} onReact={handleReact} />
              </div>
            </div>
          )
        })}
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
                    background: 'linear-gradient(135deg, #0f766e 0%, #0b5d57 100%)',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
                  }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {pendingNewCount} yeni mesaj
          </button>
        </div>
      )}

      <MessageComposer
        conversation={conversation}
        replyTo={replyTo}
        onClearReply={() => setReplyTo(null)}
        role={user?.role}
        messageCount={messages.length}
        sending={sending}
        sendText={sendText}
        sendFile={sendFile}
        sendCall={sendCall}
        onRecordingChange={setComposerRecording}
      />
    </div>
  )
}

