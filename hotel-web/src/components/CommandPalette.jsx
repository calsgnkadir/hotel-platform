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
    const isCand = user?.role === 'CANDIDATE'
    const isBiz  = user?.role === 'BUSINESS_OWNER'

    const list = []

    // Dashboard tab routing icin `?tab=...` query param desteklenir.
    // CandidateDashboard + BusinessDashboard useSearchParams ile okur (FAZ 5.3).
    if (isCand) {
      const toCand = (t) => () => navigate(`/candidate?tab=${t}`)
      list.push(
        { id: 'cand-overview',  label: 'Genel Bakış',          keywords: 'anasayfa dashboard ana ozet', section: 'Sayfa', go: toCand('overview') },
        { id: 'cand-listings',  label: 'İlanları Keşfet',      keywords: 'is is-ilani aktif',           section: 'Sayfa', go: toCand('listings') },
        { id: 'cand-apps',      label: 'Başvurularım',         keywords: 'basvurular application',      section: 'Sayfa', go: toCand('applications') },
        { id: 'cand-docs',      label: 'Belgelerim',           keywords: 'sertifika cv document',       section: 'Sayfa', go: toCand('documents') },
        { id: 'cand-msgs',      label: 'Mesajlarım',           keywords: 'sohbet chat',                  section: 'Sayfa', go: toCand('messages') },
        { id: 'cand-profile',   label: 'Profilim',             keywords: 'profil ayar settings',         section: 'Sayfa', go: toCand('profile') },
        { id: 'cand-history',   label: 'Geçmiş İşlerim',       keywords: 'gecmis tamamlanmis history',   section: 'Sayfa', go: toCand('history') },
      )
    }

    if (isBiz) {
      const toBiz = (t) => () => navigate(`/business?tab=${t}`)
      list.push(
        { id: 'biz-overview', label: 'Genel Bakış',        keywords: 'anasayfa dashboard',     section: 'Sayfa', go: toBiz('overview') },
        { id: 'biz-listings', label: 'İlanlarım',          keywords: 'ilan listing',           section: 'Sayfa', go: toBiz('mylistings') },
        { id: 'biz-apps',     label: 'Gelen Başvurular',   keywords: 'basvuru application',    section: 'Sayfa', go: toBiz('applications') },
        { id: 'biz-workers',  label: 'Çalışanlar',         keywords: 'iscili calisan worker',  section: 'Sayfa', go: toBiz('workers') },
        { id: 'biz-msgs',     label: 'Mesajlarım',         keywords: 'sohbet chat',             section: 'Sayfa', go: toBiz('messages') },
      )
    }

    // Genel
    list.push(
      { id: 'help',    label: 'Yardım & Destek',           keywords: 'sss sorular destek faq',    section: 'Yardım',  go: () => navigate('/yardim') },
      { id: 'kvkk',    label: 'KVKK Aydınlatma Metni',     keywords: 'gizlilik veri privacy',     section: 'Yardım',  go: () => navigate('/kvkk') },
    )

    if (user) {
      list.push(
        { id: 'logout',  label: 'Çıkış Yap',                 keywords: 'logout cikis signout',     section: 'Hesap',
          go: () => { logout(); navigate('/login', { replace: true }) } },
      )
    } else {
      list.push(
        { id: 'login',    label: 'Giriş Yap',                keywords: 'login signin',            section: 'Hesap', go: () => navigate('/login') },
        { id: 'register', label: 'Kayıt Ol',                 keywords: 'kayit signup register',   section: 'Hesap', go: () => navigate('/register') },
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
        style={{ background: 'var(--bg-surface, #fff)', borderColor: 'var(--border-subtle, #ebe0cc)' }}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle, #ebe0cc)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               strokeWidth={1.8} stroke="currentColor"
               className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted, #766c61)' }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={onInputKey}
            placeholder="Sayfa, eylem ara… (esc: kapat)"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary, #171513)' }}
          />
          <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded border"
               style={{ color: 'var(--text-muted, #766c61)', borderColor: 'var(--border-subtle, #ebe0cc)' }}>
            ESC
          </kbd>
        </div>

        {/* List */}
        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="text-center text-sm py-8" style={{ color: 'var(--text-muted, #766c61)' }}>
              Eşleşen eylem bulunamadı
            </div>
          )}
          {grouped.map(([section, items]) => (
            <div key={section} className="mb-2 last:mb-0">
              <div className="text-[10px] uppercase tracking-widest font-bold px-2 py-1.5"
                   style={{ color: 'var(--text-muted, #766c61)' }}>
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
                      background: active ? 'var(--accent-action-soft, #dde7f3)' : 'transparent',
                      color: active ? 'var(--accent-action, #1e3a5f)' : 'var(--text-primary, #171513)',
                    }}
                  >
                    <span className="font-medium">{a.label}</span>
                    {active && (
                      <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded"
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
        <div className="px-4 py-2 border-t text-[10px] flex items-center gap-4"
             style={{ borderColor: 'var(--border-subtle, #ebe0cc)', color: 'var(--text-muted, #766c61)' }}>
          <span className="flex items-center gap-1.5">
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #ebe0cc)' }}>Yukari</kbd>
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #ebe0cc)' }}>Asagi</kbd>
            <span>gezin</span>
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #ebe0cc)' }}>Enter</kbd>
            <span>seç</span>
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <kbd className="font-mono px-1.5 py-0.5 rounded border" style={{ borderColor: 'var(--border-subtle, #ebe0cc)' }}>Ctrl K</kbd>
            <span>tekrar aç/kapat</span>
          </span>
        </div>
      </div>
    </div>
  )
}
