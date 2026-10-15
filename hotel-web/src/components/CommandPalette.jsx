// FAZ 5.3 — Command Palette (Cmd+K / Ctrl+K)
// Native React + Tailwind ile minimal cmdk benzeri. Paket bagimsiz.
//
// Kullanim:
//   - Cmd+K (Mac) veya Ctrl+K (Windows/Linux) ile acilir
//   - Esc ile kapanir
//   - Arama: actions.label / actions.keywords match
//   - ArrowUp / ArrowDown ile navigate, Enter ile select
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navFor, panelPathFor } from '../lib/navigation'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // Global keyboard shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      } else if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Acilinca input'a focus
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Role-aware actions
  const actions = useMemo(() => {
    const list = []

    // Panel sekmeleri tek kaynaktan (lib/navigation.js); ?tab=<id> derin linki
    // panolar tarafından okunur.
    const role = user?.role
    const base = panelPathFor(role)
    navFor(role).forEach(item => {
      list.push({
        id: `tab-${item.id}`,
        label: item.label,
        keywords: item.keywords || '',
        section: 'Sayfa',
        go: () => navigate(`${base}?tab=${item.id}`),
      })
    })

    // Genel
    list.push(
      { id: 'help',    label: 'Yardım ve destek',           keywords: 'sss sorular destek faq',    section: 'Yardım',  go: () => navigate('/yardim') },
      { id: 'kvkk',    label: 'KVKK aydınlatma metni',     keywords: 'gizlilik veri privacy',     section: 'Yardım',  go: () => navigate('/kvkk') },
    )

    if (user) {
      list.push(
        { id: 'logout',  label: 'Çıkış yap',                 keywords: 'logout cikis signout',     section: 'Hesap',
          go: () => { logout(); navigate('/login', { replace: true }) } },
      )
    } else {
      list.push(
        { id: 'login',    label: 'Giriş yap',                keywords: 'login signin',            section: 'Hesap', go: () => navigate('/login') },
        { id: 'register', label: 'Kayıt ol',                 keywords: 'kayit signup register',   section: 'Hesap', go: () => navigate('/register') },
      )
    }

    return list
  }, [user, navigate, logout])

  // Filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter(a => {
      const blob = (a.label + ' ' + (a.keywords || '')).toLowerCase()
      return blob.includes(q)
    })
  }, [actions, query])

  // Group by section
  const grouped = useMemo(() => {
    const map = new Map()
    filtered.forEach((a, idx) => {
      const s = a.section || 'Diğer'
      if (!map.has(s)) map.set(s, [])
      map.get(s).push({ ...a, _idx: idx })
    })
    return Array.from(map.entries())
  }, [filtered])

  // Aktif item her zaman gorunur olsun
  useEffect(() => {
    if (activeIdx >= filtered.length) setActiveIdx(0)
  }, [filtered.length, activeIdx])

  function onInputKey(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const sel = filtered[activeIdx]
      if (sel) {
        setOpen(false)
        sel.go()
      }
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4 bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-surface, #fff)', borderColor: 'var(--border-subtle, #e1e1e1)' }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle, #e1e1e1)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               strokeWidth={1.8} stroke="currentColor"
               className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted, #6d6d6d)' }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={onInputKey}
            placeholder="Sayfa veya eylem ara"
            aria-label="Sayfa veya eylem ara"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary, #171513)' }}
          />
          <kbd className="hidden sm:inline text-[11px] font-mono px-1.5 py-0.5 rounded border"
               style={{ color: 'var(--text-muted, #6d6d6d)', borderColor: 'var(--border-subtle, #e1e1e1)' }}>
            ESC
          </kbd>
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="text-center text-sm py-8" style={{ color: 'var(--text-muted, #6d6d6d)' }}>
              Eşleşen eylem bulunamadı
            </div>
          )}
          {grouped.map(([section, items]) => (
            <div key={section} className="mb-2 last:mb-0">
              <div className="type-label px-2 py-1.5"
                   style={{ color: 'var(--ah-ink-3)' }}>
                {section}
              </div>
              {items.map(a => {
                const active = a._idx === activeIdx
                return (
                  <button
                    key={a.id}
                    onClick={() => { setOpen(false); a.go() }}
                    onMouseEnter={() => setActiveIdx(a._idx)}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center justify-between gap-3 transition-colors"
                    style={{
                      background: active ? 'var(--ah-brand-soft)' : 'transparent',
                      color: active ? 'var(--ah-brand)' : 'var(--ah-ink-2)',
                    }}
                  >
                    <span className="font-medium">{a.label}</span>
                    {active && (
                      <kbd className="text-[11px] font-mono px-1.5 py-0.5 rounded"
                           style={{ background: 'var(--bg-subtle, rgba(0,0,0,0.05))' }}>
                        Enter
                      </kbd>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t text-[12px] flex items-center gap-4"
             style={{ borderColor: 'var(--border-subtle, #e1e1e1)', color: 'var(--text-muted, #6d6d6d)' }}>
          <span className="flex items-center gap-1.5">
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #e1e1e1)' }}>Yukarı</kbd>
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #e1e1e1)' }}>Aşağı</kbd>
            <span>gezin</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #e1e1e1)' }}>Enter</kbd>
            <span>seç</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #e1e1e1)' }}>Ctrl K</kbd>
            <span>tekrar aç/kapat</span>
          </span>
        </div>
      </div>
    </div>
  )
}
