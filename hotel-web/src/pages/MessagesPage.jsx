/**
 * Messages Hub — 3-pane orkestratör.
 *
 * FAZ 17 — Bu dosya 1968 satirlik monolitti (gap analysis: "no 3-pane
 * componentization, so visual/motion debt lives in the markup, not the
 * architecture"). Artik sadece state + layout:
 *
 *   ConversationsRail (sol)  — arama, filtre, sohbet listesi
 *   MessageThread (orta)     — mesajlar + composer  [eski ChatWindow]
 *   ContextPanel (sag)       — baglam paneli (toggle'li, lg+)
 *
 * Tum sunum parcalari components/messages/ altinda; motion/polish isleri
 * artik ilgili component'e iner, markup'a degil.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as hotelApi from '../api/hotel'
import { useAuth } from '../context/AuthContext'
import { keys } from '../lib/queryClient'
import useWsConnected, { useWsReconnectInvalidate } from '../lib/useWsConnected'
import ConversationsRail from '../components/messages/ConversationsRail'
import MessageThread from '../components/messages/MessageThread'
import ContextPanel from '../components/messages/ContextPanel'

const STAR_KEY_PREFIX = 'kadrom.starred-conversations.'
const PANEL_KEY = 'kadrom.messages.context-panel'

function loadStarred(key) {
  if (!key) return new Set()
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) }
  catch { return new Set() }
}
function saveStarred(key, set) {
  if (!key) return
  try { localStorage.setItem(key, JSON.stringify([...set])) } catch {}
}

export default function MessagesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.userId ?? user?.id
  // Never migrate the legacy shared key: its owner's identity is unknown.
  const starKey = userId == null ? null : STAR_KEY_PREFIX + encodeURIComponent(userId)
  const queryClient = useQueryClient()
  const wsOk = useWsConnected()  // FAZ 4.8

  const [activeId, setActiveId] = useState(null)
  const [showListMobile, setShowListMobile] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')  // 'all' | 'unread' | 'starred'
  const [starred, setStarred] = useState(() => loadStarred(starKey))

  // FAZ 11.W3.1 — Sag context panel toggle (kullanici tercihi: kalici)
  const [panelOpen, setPanelOpen] = useState(() => {
    try { return localStorage.getItem(PANEL_KEY) !== '0' } catch { return true }
  })
  function togglePanel() {
    setPanelOpen(v => {
      try { localStorage.setItem(PANEL_KEY, v ? '0' : '1') } catch {}
      return !v
    })
  }

  function toggleStar(convId) {
    setStarred(prev => {
      const next = new Set(prev)
      if (next.has(convId)) next.delete(convId)
      else next.add(convId)
      saveStarred(starKey, next)
      return next
    })
  }

  // FAZ 4.8 — WS reconnect olunca tek seferlik catch-up
  useWsReconnectInvalidate([
    keys.conversations.list(),
    keys.conversations.unreadCount(),
  ])

  // F0.10 + FAZ 1/#12 — Conversations useQuery
  // WS aktifken push gelir; WS koparsa 60sn fallback polling.
  const { data: convData, isLoading: loading, isFetching } = useQuery({
    queryKey: keys.conversations.list(),
    queryFn: () => hotelApi.getMyConversations({ size: 50 }),
    refetchInterval: wsOk ? false : 60000,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  })
  const conversations = convData?.content ?? []

  // Arama + filter chip + yildizli ust siralama
  const filteredConvs = (() => {
    let out = conversations
    if (filter === 'unread')  out = out.filter(c => c.unreadCount > 0)
    if (filter === 'starred') out = out.filter(c => starred.has(c.id))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(c =>
        (c.otherPartyName || '').toLowerCase().includes(q) ||
        (c.listingTitle || '').toLowerCase().includes(q) ||
        (c.lastMessagePreview || '').toLowerCase().includes(q)
      )
    }
    // Yildizli olanlar her zaman uste cik (filter starred degilse)
    if (filter !== 'starred') {
      out = [...out].sort((a, b) => {
        const sa = starred.has(a.id) ? 1 : 0
        const sb = starred.has(b.id) ? 1 : 0
        return sb - sa
      })
    }
    return out
  })()

  // Yeni mesaj gönderildiğinde sohbet listesini refetch et (lastMessage preview için)
  function refetchConvs() {
    queryClient.invalidateQueries({ queryKey: keys.conversations.list() })
  }

  const active = conversations.find(c => c.id === activeId) || null

  // Derin link: ?tab=messages&c={conversationId} — panel (aday/isletme) bu
  // parametreyle acar. Sohbet listede bulununca secilir; mobilde liste yerine
  // dogrudan sohbet gorunumu acilir. Yeni acilmis sohbet onbellekteki listede
  // yoksa liste bir kez tazelenir.
  const [params, setParams] = useSearchParams()
  const deepLinkId = Number(params.get('c')) || null
  const handledDeepLink = useRef(null)
  const refetchedFor = useRef(null)
  useEffect(() => {
    if (!deepLinkId || handledDeepLink.current === deepLinkId || loading) return
    if (conversations.some(c => c.id === deepLinkId)) {
      handledDeepLink.current = deepLinkId
      setActiveId(deepLinkId)
      setShowListMobile(false)
    } else if (!isFetching && refetchedFor.current !== deepLinkId) {
      refetchedFor.current = deepLinkId
      queryClient.invalidateQueries({ queryKey: keys.conversations.list() })
    }
  }, [deepLinkId, conversations, loading, isFetching, queryClient])

  function selectConversation(c) {
    setActiveId(c.id)
    setShowListMobile(false)
    // Secim URL'de de dursun (yenileyince ayni sohbet acilsin)
    handledDeepLink.current = c.id
    if (params.get('c') !== String(c.id)) {
      setParams(prev => {
        const next = new URLSearchParams(prev)
        next.set('c', String(c.id))
        return next
      }, { replace: true })
    }
  }

  return (
    <div className="card overflow-hidden" style={{ height: 'calc(100vh - 12rem)', minHeight: 480 }}>
      <div className="flex h-full">

        {/* SOL — Sohbet listesi */}
        <ConversationsRail
          conversations={conversations}
          filteredConvs={filteredConvs}
          loading={loading}
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          starred={starred}
          onToggleStar={toggleStar}
          activeId={activeId}
          onSelect={selectConversation}
          visible={showListMobile}
          userRole={user?.role}
          onNavigate={navigate}
        />

        {/* ORTA — Aktif sohbet */}
        <div className={`${!showListMobile ? 'flex' : 'hidden sm:flex'} flex-1 flex-col min-w-0 relative`}>
          {/* FAZ 11.W3.1 — Context panel toggle (lg+ gorunur) */}
          {active && (
            <button type="button" onClick={togglePanel}
                    title={panelOpen ? 'Detay panelini gizle' : 'Detay panelini göster'}
                    className="hidden lg:grid absolute top-3 right-3 z-20 w-8 h-8 place-items-center rounded-full transition-all hover:-translate-y-0.5"
                    style={{
                      background: 'rgba(255, 255, 255, 0.92)',
                      border: `1px solid ${panelOpen ? 'rgba(31, 41, 55, 0.42)' : 'rgba(31, 41, 55, 0.18)'}`,
                      color: panelOpen ? '#1f2937' : '#6b7574',
                    }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {panelOpen
                  ? <><polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" /></>
                  : <><polyline points="11 17 6 12 11 7" /><polyline points="18 17 13 12 18 7" /></>}
              </svg>
            </button>
          )}
          <MessageThread
            conversation={active}
            onBack={() => setShowListMobile(true)}
            onMessageSent={refetchConvs} />
        </div>

        {/* SAG — Context panel (toggle'li, lg+) */}
        {active && panelOpen && (
          <ContextPanel conversation={active} userRole={user?.role} navigate={navigate} />
        )}
      </div>
    </div>
  )
}
