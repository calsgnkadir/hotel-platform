/**
 * FAZ 17 — Messages Hub sol sutun: sohbet listesi.
 *
 * MessagesPage.jsx monolitinden cikarildi. Icerik: arama kutusu +
 * filtre chip'leri (tumu/okunmamis/yildizli) + sohbet ogeleri + bos durum.
 *
 * Stateless — tum state MessagesPage'de, buraya prop olarak gelir.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import cldImg, { ImgSize } from '../../lib/cldImg'
import { SkeletonConversationList } from '../Skeleton'
import { formatRelative } from './utils'

/* ── Arama kutusu (focus'ta champagne glow ring) ── */
function SearchInput({ value, onChange }) {
  const [focused, setFocused] = useState(false)
  return (
    <motion.div
      animate={{
        borderColor: focused ? 'rgba(31, 41, 55, 0.45)' : 'rgba(31, 41, 55, 0.10)',
        boxShadow: focused
          ? '0 0 0 3px rgba(31, 41, 55, 0.08), 0 4px 14px rgba(0,0,0,0.20)'
          : '0 0 0 0px rgba(31, 41, 55, 0)',
      }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-xl"
      style={{
        background: 'rgba(255, 255, 255, 0.55)',
        border: '1px solid',
      }}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
           strokeWidth={1.8} stroke="currentColor"
           className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
           style={{ color: focused ? 'var(--ah-brand)' : 'var(--ah-ink-4)' }} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input type="search" value={value} aria-label="Sohbetlerde ara"
             onChange={e => onChange(e.target.value)}
             onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
             placeholder="Kişi, ilan veya mesaj…"
             className="w-full bg-transparent outline-none h-10 pl-8 pr-9 text-[14px]"
             style={{ color: 'var(--text-headline)', caretColor: 'var(--ah-brand)' }} />
      {value && (
        <button type="button" onClick={() => onChange('')}
                aria-label="Aramayı temizle"
                className="absolute right-0.5 top-1/2 -translate-y-1/2 w-9 h-9 grid place-items-center rounded-full transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
          ×
        </button>
      )}
    </motion.div>
  )
}

/* ── Tek sohbet ogesi ── */
function ConversationItem({ conv, isActive, isStarred, onToggleStar, onClick }) {
  const hasUnread = conv.unreadCount > 0
  return (
    <motion.div onClick={onClick}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 360, damping: 24 }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      className="relative w-full text-left px-3 py-3 group overflow-hidden rounded-xl cursor-pointer"
      style={{
        background: isActive
          ? 'linear-gradient(90deg, rgba(31, 41, 55, 0.08), rgba(31, 41, 55, 0.02))'
          : 'transparent',
        marginBottom: 4,
      }}
    >
      {/* Active vertical accent — sol kenar champagne */}
      {isActive && (
        <motion.span layoutId="conv-active-rail"
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
          style={{ background: 'var(--ah-brand)' }} />
      )}
      {/* Hover sweep */}
      <span aria-hidden className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{ background: 'linear-gradient(90deg, rgba(31, 41, 55, 0.06) 0%, transparent 60%)' }} />

      <div className="relative flex items-start gap-3">
        <div className="relative flex-shrink-0">
          {conv.otherPartyAvatarUrl ? (
            <img src={cldImg(conv.otherPartyAvatarUrl, { w: ImgSize.avatarSm })} alt={conv.otherPartyName}
              loading="lazy" decoding="async"
              className="w-10 h-10 rounded-full object-cover"
              style={{ border: '1px solid rgba(31, 41, 55, 0.18)' }} />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-[15px]"
                 aria-hidden="true"
                 style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)', color: 'var(--ah-brand)' }}>
              {(conv.otherPartyName || '?').charAt(0).toLocaleUpperCase('tr-TR')}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            {/* FAZ 17 fix: okunmus sohbet ismi eski mor paletten (#dcdcdc) kalmisti -> ivory */}
            <div className="font-semibold text-[14px] truncate"
                 style={{ color: hasUnread ? 'var(--text-headline)' : 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {conv.otherPartyName}
            </div>
            <div className="type-caption flex-shrink-0 mr-6">
              {formatRelative(conv.lastMessageAt)}
            </div>
          </div>
          {conv.listingTitle && (
            <div className="type-caption truncate mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
              {conv.listingTitle}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <div className={`text-[13px] truncate ${hasUnread ? 'font-semibold' : 'font-normal'}`}
                 style={{ color: hasUnread ? 'var(--ah-ink)' : 'var(--text-secondary)' }}>
              {conv.lastMessagePreview || <span className="italic" style={{ color: 'var(--text-muted)' }}>Henüz mesaj yok</span>}
            </div>
            {hasUnread && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="flex-shrink-0 text-[11px] leading-[18px] font-bold rounded-full px-1.5 min-w-[20px] text-center type-num"
                aria-label={`${conv.unreadCount} okunmamış mesaj`}
                style={{ background: 'var(--ah-brand)', color: 'var(--text-inverse)' }}>
                {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
              </motion.span>
            )}
          </div>
        </div>
      </div>
      {/* Dalga G3 — Yildiz toggle butonu */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleStar?.() }}
        aria-label={isStarred ? 'Yıldızı kaldır' : 'Yıldızla'}
        aria-pressed={isStarred}
        className="absolute top-0.5 right-0.5 w-9 h-9 grid place-items-center rounded-md transition-colors opacity-70 hover:opacity-100"
        style={{ color: isStarred ? 'var(--ah-brand)' : 'var(--ah-ink-4)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill={isStarred ? 'currentColor' : 'none'}
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>
      <style>{`@keyframes conv-pulse { 0%,100% { box-shadow: 0 0 0 2px rgba(107, 117, 116, 0.28) } 50% { box-shadow: 0 0 0 5px rgba(107, 117, 116, 0.12) } }`}</style>
    </motion.div>
  )
}

/* ── Bos durum: hic sohbet yok ── */
function EmptyRail({ userRole, onNavigate }) {
  const isBiz = userRole === 'BUSINESS_OWNER'
  const ctaLabel = isBiz ? 'İlanlarım' : 'İlanları keşfet'
  const ctaPath  = isBiz ? '/business' : '/candidate'
  const helperText = isBiz
    ? 'Yayında bir ilanın olduğunda adaylar başvurunca otomatik sohbet açılır.'
    : 'Bir ilana başvurduğunda işletmeyle otomatik sohbet açılır.'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 20 }}
      className="py-10 px-4 text-center">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut' }}
        className="relative w-20 h-20 mx-auto mb-4">
        <div className="absolute inset-0 rounded-full"
             style={{
               background: 'radial-gradient(circle, rgba(31, 41, 55, 0.22) 0%, transparent 65%)',
               filter: 'blur(10px)',
             }} />
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="relative w-full h-full">
          <defs>
            <linearGradient id="empty-bubble-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"  stopColor="#1f2937" />
              <stop offset="100%" stopColor="#111827" />
            </linearGradient>
          </defs>
          <path d="M14 12h32a8 8 0 0 1 8 8v18a8 8 0 0 1-8 8H24l-10 8V20a8 8 0 0 1 0-8z"
                fill="rgba(255, 255, 255, 0.85)"
                stroke="url(#empty-bubble-grad)" strokeWidth="1.5" />
          <circle cx="24" cy="29" r="1.8" fill="#1f2937" opacity="0.9" />
          <circle cx="32" cy="29" r="1.8" fill="#1f2937" opacity="0.9" />
          <circle cx="40" cy="29" r="1.8" fill="#1f2937" opacity="0.9" />
        </svg>
      </motion.div>
      <h4 className="type-body font-semibold mb-1.5" style={{ color: 'var(--text-headline)' }}>
        Henüz sohbetin yok
      </h4>
      <p className="type-caption leading-relaxed mb-4">
        {helperText}
      </p>
      <motion.button
        onClick={() => onNavigate(ctaPath)}
        whileHover={{ y: -2, scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 22 }}
        className="btn-primary !w-auto">
        {ctaLabel}
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={2.2} className="w-3.5 h-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </motion.button>
    </motion.div>
  )
}

/**
 * Sol sutun — sohbet listesi.
 * visible: mobilde liste mi thread mi gorunuyor (sm+ her zaman gorunur).
 */
export default function ConversationsRail({
  conversations, filteredConvs, loading,
  search, onSearchChange,
  filter, onFilterChange,
  starred, onToggleStar,
  activeId, onSelect,
  visible, userRole, onNavigate,
}) {
  const unreadTotal = conversations.filter(c => c.unreadCount > 0).length
  const starredTotal = conversations.filter(c => starred.has(c.id)).length

  return (
    <div className={`${visible ? 'flex' : 'hidden sm:flex'} flex-col w-full sm:w-80 sm:min-w-[20rem] border-r border-hairline`}
         style={{ background: 'var(--surface-raised)' }}>
      <div className="px-4 py-3 space-y-2.5 border-b border-hairline">
        <div className="flex items-center justify-between gap-2">
          <h3 className="type-body font-semibold" style={{ color: 'var(--text-headline)' }}>
            Sohbetler
          </h3>
          <span className="badge badge-neutral type-num">
            {filteredConvs.length}{search ? ` / ${conversations.length}` : ''}
          </span>
        </div>

        <SearchInput value={search} onChange={onSearchChange} />

        {/* Filter chip bar (Tumu / Okunmamis / Yildizli) */}
        <div className="flex items-center gap-1.5" role="group" aria-label="Sohbet filtresi">
          {[
            { id: 'all',     label: 'Tümü',      count: conversations.length },
            { id: 'unread',  label: 'Okunmamış', count: unreadTotal },
            { id: 'starred', label: 'Yıldızlı',  count: starredTotal },
          ].map(opt => {
            const isActive = filter === opt.id
            return (
              <button key={opt.id} type="button"
                onClick={() => onFilterChange(opt.id)}
                aria-pressed={isActive}
                className={`chip ${isActive ? 'is-active' : ''}`}>
                {opt.label}
                {opt.count > 0 && (
                  <span className="type-num font-semibold opacity-80">
                    {opt.count > 9 ? '9+' : opt.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <SkeletonConversationList count={4} />
        ) : conversations.length === 0 ? (
          <EmptyRail userRole={userRole} onNavigate={onNavigate} />
        ) : filteredConvs.length === 0 ? (
          <div className="py-8 px-4 text-center type-body" style={{ color: 'var(--text-muted)' }}>
            "{search}" araması için sonuç bulunamadı.
          </div>
        ) : filteredConvs.map(c => (
          <ConversationItem key={c.id} conv={c}
            isActive={c.id === activeId}
            isStarred={starred.has(c.id)}
            onToggleStar={() => onToggleStar(c.id)}
            onClick={() => onSelect(c)} />
        ))}
      </div>
    </div>
  )
}
