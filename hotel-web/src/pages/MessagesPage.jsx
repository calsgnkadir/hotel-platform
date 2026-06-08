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
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-slate-400 dark:text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
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

/* ── Tek mesaj balonu (attachment render dahil) ── */
function MessageBubble({ m }) {
  const isImage = m.attachmentType === 'image'
  const isFile  = m.attachmentType === 'file'
  const hasAttach = !!m.attachmentUrl

  return (
    <div className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[75%] rounded-2xl text-sm shadow-sm overflow-hidden
        ${m.mine
          ? 'text-white rounded-br-md bg-brand-700'
          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-md'}`}>

        {/* Attachment */}
        {hasAttach && isImage && (
          <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
            <img src={m.attachmentUrl} alt={m.attachmentName || 'foto'}
                 className="max-h-72 w-auto object-contain bg-slate-100 dark:bg-slate-900" />
          </a>
        )}
        {hasAttach && isFile && (
          <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer"
             className={`flex items-center gap-2 px-3 py-2.5 border-b ${m.mine ? 'border-white/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.8} stroke="currentColor"
                 className={`w-5 h-5 shrink-0 ${m.mine ? 'text-white' : 'text-slate-500'}`}>
              <path strokeLinecap="round" strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate text-[13px]">{m.attachmentName || 'Dosya'}</div>
              {m.attachmentSize && (
                <div className={`text-[10px] ${m.mine ? 'text-white/70' : 'text-slate-400'}`}>
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
        <div className={`text-[10px] px-3 pb-1 text-right ${m.mine ? 'text-white/70' : 'text-slate-400 dark:text-slate-500'}`}>
          {formatTime(m.sentAt)}{m.mine && m.isRead ? ' · görüldü' : ''}
        </div>
      </div>
    </div>
  )
}

/* ── Sohbet penceresi (sağ panel) ── */
function ChatWindow({ conversation, onBack, onMessageSent }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const fileInputRef = useRef(null)
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
          <div className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                 strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-400 dark:text-slate-500">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
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
        ) : messages.map(m => <MessageBubble key={m.id} m={m} />)}
        <div ref={scrollAnchorRef} />
      </div>

      {/* Kompozer — dosya ekle + metin + gönder */}
      <form onSubmit={handleSend} className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
        {/* Dosya ekle butonu */}
        <input ref={fileInputRef} type="file"
               accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx"
               onChange={handleAttach} className="hidden" />
        <button type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Dosya / Foto ekle"
                className="w-10 h-10 grid place-items-center rounded-full bg-slate-100 dark:bg-slate-800
                           hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300
                           disabled:opacity-50 transition-colors shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               strokeWidth={1.8} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
          </svg>
        </button>

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
  const [search, setSearch] = useState('')

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
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Mesajlar</h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
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
                   className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              {search && (
                <button type="button" onClick={() => setSearch('')}
                        title="Aramayı temizle"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 grid place-items-center
                                   text-slate-400 hover:text-slate-700">
                  ×
                </button>
              )}
            </div>
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
                  Bir ilana başvurduğunda işletmeyle otomatik sohbet açılır
                </p>
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-slate-400">
                "{search}" araması için sonuç bulunamadı.
              </div>
            ) : filteredConvs.map(c => (
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
