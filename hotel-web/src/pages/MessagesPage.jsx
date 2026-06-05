import { useState, useEffect, useRef, useCallback } from 'react'
import * as hotelApi from '../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

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

const POLL_INTERVAL = 5000  // 5 sn

/* ── Tek sohbet öğesi (sol panel) ── */
function ConversationItem({ conv, isActive, onClick }) {
  const initials = (conv.otherPartyName || '?').charAt(0).toUpperCase()
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors
        ${isActive ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}>
      <div className="flex items-start gap-3">
        {conv.otherPartyAvatarUrl ? (
          <img src={conv.otherPartyAvatarUrl} alt={conv.otherPartyName}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-200" />
        ) : (
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
               style={{ background: '#047857' }}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">
              {conv.otherPartyName}
            </div>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
              {formatRelative(conv.lastMessageAt)}
            </div>
          </div>
          {conv.listingTitle && (
            <div className="text-[10px] text-brand-700 dark:text-brand-400 truncate mt-0.5">
              {conv.listingTitle}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-1">
            <div className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
              {conv.lastMessagePreview || <span className="italic text-slate-400 dark:text-slate-500">Henüz mesaj yok</span>}
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

/* ── Sohbet penceresi (sağ panel) ── */
function ChatWindow({ conversation, onBack, onMessageSent }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const lastSeenIdRef = useRef(0)
  const scrollAnchorRef = useRef(null)

  const fetchMessages = useCallback(async (silent = false) => {
    if (!conversation) return
    if (!silent) setLoading(true)
    try {
      const data = await hotelApi.getConversationMessages(conversation.id, { size: 100 })
      const list = (data?.content ?? []).slice().reverse()  // eskiden yeniye
      setMessages(list)
      // Yeni mesaj geldiyse okundu işaretle
      const newest = list[list.length - 1]
      if (newest && newest.id !== lastSeenIdRef.current) {
        lastSeenIdRef.current = newest.id
        if (!newest.mine && !newest.isRead) {
          hotelApi.markConversationRead(conversation.id).then(() => onMessageSent?.())
        }
        // Aşağıya scroll
        setTimeout(() => scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
    } catch (err) {
      if (!silent) toast.error(extractErrorMessage(err))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [conversation, onMessageSent])

  // İlk yükleme + sohbet değişimi
  useEffect(() => {
    lastSeenIdRef.current = 0
    fetchMessages()
    // Sohbete girince okundu işaretle
    if (conversation) {
      hotelApi.markConversationRead(conversation.id).catch(() => {})
    }
  }, [conversation?.id])  // eslint-disable-line react-hooks/exhaustive-deps

  // 5 sn polling
  useEffect(() => {
    if (!conversation) return
    const t = setInterval(() => fetchMessages(true), POLL_INTERVAL)
    return () => clearInterval(t)
  }, [conversation, fetchMessages])

  async function handleSend(e) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const msg = await hotelApi.sendMessage(conversation.id, content)
      setMessages(prev => [...prev, msg])
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

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        Sohbet seçin
      </div>
    )
  }

  const initials = (conversation.otherPartyName || '?').charAt(0).toUpperCase()

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Üst başlık */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack}
          className="sm:hidden p-1 -ml-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        {conversation.otherPartyAvatarUrl ? (
          <img src={conversation.otherPartyAvatarUrl} alt={conversation.otherPartyName}
            className="w-9 h-9 rounded-full object-cover border border-slate-200" />
        ) : (
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
               style={{ background: '#047857' }}>
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
            {conversation.otherPartyName}
          </div>
          {conversation.listingTitle && (
            <div className="text-xs text-brand-700 dark:text-brand-400 truncate">
              {conversation.listingTitle}
            </div>
          )}
        </div>
      </div>

      {/* Mesaj akışı */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50 dark:bg-slate-950">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="spinner" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            Sohbete ilk mesajı sen yaz
          </div>
        ) : messages.map(m => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm
              ${m.mine
                ? 'text-white rounded-br-md bg-brand-700'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-md'}`}>
              <div className="whitespace-pre-wrap break-words">{m.content}</div>
              <div className={`text-[10px] mt-0.5 text-right ${m.mine ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
                {formatTime(m.sentAt)}{m.mine && m.isRead ? ' · görüldü' : ''}
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollAnchorRef} />
      </div>

      {/* Kompozer */}
      <form onSubmit={handleSend} className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 flex-shrink-0">
        <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
          placeholder="Mesaj yaz..." maxLength={2000}
          className="input text-sm flex-1" disabled={sending} />
        <button type="submit"
          disabled={sending || !draft.trim()}
          className="px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex-shrink-0 bg-brand-700 hover:bg-brand-800 transition-colors">
          {sending ? '...' : 'Gönder'}
        </button>
      </form>
    </div>
  )
}

/* ── Ana sayfa ── */
export default function MessagesPage() {
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [showListMobile, setShowListMobile] = useState(true)

  const fetchConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await hotelApi.getMyConversations({ size: 50 })
      setConversations(data?.content ?? [])
    } catch (err) {
      if (!silent) toast.error(extractErrorMessage(err))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Liste polling — 5 sn (yeni sohbet/yeni mesaj preview için)
  useEffect(() => {
    const t = setInterval(() => fetchConversations(true), POLL_INTERVAL)
    return () => clearInterval(t)
  }, [fetchConversations])

  const active = conversations.find(c => c.id === activeId) || null

  function selectConversation(c) {
    setActiveId(c.id)
    setShowListMobile(false)
  }

  return (
    <div className="card overflow-hidden" style={{ height: 'calc(100vh - 12rem)', minHeight: 480 }}>
      <div className="flex h-full">
        {/* Sol — Sohbet listesi */}
        <div className={`${showListMobile ? 'flex' : 'hidden sm:flex'} flex-col w-full sm:w-80 sm:min-w-[20rem] border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900`}>
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Mesajlar</h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">{conversations.length} sohbet</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="spinner" /></div>
            ) : conversations.length === 0 ? (
              <div className="empty-state py-12 px-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                     strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-300 mb-3 mx-auto">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <p className="text-sm text-slate-500">Henüz sohbetin yok</p>
                <p className="text-xs text-slate-400 mt-1">
                  Başvuru yaparak ya da başvuru kabul ederek sohbet başlatabilirsin
                </p>
              </div>
            ) : conversations.map(c => (
              <ConversationItem key={c.id} conv={c}
                isActive={c.id === activeId}
                onClick={() => selectConversation(c)} />
            ))}
          </div>
        </div>

        {/* Sağ — Aktif sohbet */}
        <div className={`${!showListMobile ? 'flex' : 'hidden sm:flex'} flex-1 flex-col`}>
          <ChatWindow
            conversation={active}
            onBack={() => setShowListMobile(true)}
            onMessageSent={() => fetchConversations(true)} />
        </div>
      </div>
    </div>
  )
}
