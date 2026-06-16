import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * FAZ 5.10 — Klavye kisayollari
 *
 * ?         → Yardim modal ac
 * g + o     → Genel Bakis
 * g + l     → Ilanlar / Ilanlarim
 * g + a     → Basvurular / Gelen Basvurular
 * g + m     → Mesajlar
 * g + p     → Profilim
 * Esc       → Modal kapat
 *
 * Input/textarea/contenteditable icindeyken devre disi.
 */

const CHORD_TIMEOUT_MS = 1500

function isTypingInField(target) {
  if (!target) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export default function KeyboardShortcuts() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
  const chordRef = useRef({ key: null, timer: null })

  useEffect(() => {
    function clearChord() {
      chordRef.current.key = null
      if (chordRef.current.timer) {
        clearTimeout(chordRef.current.timer)
        chordRef.current.timer = null
      }
    }

    function panel() {
      const role = user?.role
      if (role === 'CANDIDATE') return 'candidate'
      if (role === 'BUSINESS_OWNER') return 'business'
      if (role === 'ADMIN') return 'admin'
      return null
    }

    function goTab(tab) {
      const base = panel()
      if (!base) return
      navigate(`/${base}?tab=${tab}`)
    }

    function handleKey(e) {
      // Modal acikken sadece Esc'i dinle
      if (helpOpen) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setHelpOpen(false)
        }
        return
      }

      if (isTypingInField(e.target)) return
      // Modifier'li kombinasyonlari atla (ctrl/cmd/alt)
      if (e.ctrlKey || e.metaKey || e.altKey) return

      // ? -> yardim modal
      if (e.key === '?' || (e.shiftKey && e.key === '?')) {
        e.preventDefault()
        setHelpOpen(true)
        clearChord()
        return
      }

      // Chord: g + harf
      if (chordRef.current.key === 'g') {
        const role = user?.role
        let target = null
        const k = e.key.toLowerCase()
        if (k === 'o') target = 'overview'
        else if (k === 'l') target = role === 'BUSINESS_OWNER' ? 'mylistings' : 'listings'
        else if (k === 'a') target = 'applications'
        else if (k === 'm') target = 'messages'
        else if (k === 'p') target = 'profile'

        if (target) {
          e.preventDefault()
          goTab(target)
        }
        clearChord()
        return
      }

      if (e.key === 'g' && !e.shiftKey) {
        chordRef.current.key = 'g'
        chordRef.current.timer = setTimeout(clearChord, CHORD_TIMEOUT_MS)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearChord()
    }
  }, [navigate, user?.role, helpOpen])

  if (!helpOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={() => setHelpOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-help-title"
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'rgba(10, 6, 18, 0.78)', backdropFilter: 'blur(8px)' }}
      />
      <div
        className="relative max-w-md w-full rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, rgba(20, 14, 38, 0.92), rgba(15, 10, 30, 0.92))',
          border: '1px solid rgba(168, 85, 247, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.55), 0 0 40px rgba(168, 85, 247, 0.20)',
        }}
      >
        <div className="flex items-baseline justify-between mb-5">
          <h2
            id="kbd-help-title"
            className="font-bebas text-2xl tracking-wider uppercase text-white"
            style={{ textShadow: '0 0 14px rgba(168, 85, 247, 0.35)' }}
          >
            Klavye Kısayolları
          </h2>
          <button
            onClick={() => setHelpOpen(false)}
            className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{
              background: 'rgba(168, 85, 247, 0.18)',
              color: '#d8b4fe',
              border: '1px solid rgba(168, 85, 247, 0.30)',
            }}
            aria-label="Kapat"
          >
            Esc
          </button>
        </div>

        <ul className="space-y-2.5">
          {[
            { keys: ['?'],          label: 'Bu yardımı aç / kapat' },
            { keys: ['g', 'o'],     label: 'Genel Bakış' },
            { keys: ['g', 'l'],     label: 'İlanlar / İlanlarım' },
            { keys: ['g', 'a'],     label: 'Başvurular / Gelen Başvurular' },
            { keys: ['g', 'm'],     label: 'Mesajlar' },
            { keys: ['g', 'p'],     label: 'Profilim' },
            { keys: ['Ctrl', 'K'],  label: 'Komut paleti (global arama)' },
          ].map((row, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
              style={{
                background: 'rgba(15, 10, 30, 0.55)',
                border: '1px solid rgba(168, 85, 247, 0.12)',
              }}
            >
              <span className="text-[13px]" style={{ color: '#e9d5ff' }}>
                {row.label}
              </span>
              <span className="flex items-center gap-1">
                {row.keys.map((k, j) => (
                  <span key={j} className="flex items-center gap-1">
                    {j > 0 && <span className="text-[10px]" style={{ color: '#7c3aed' }}>·</span>}
                    <kbd
                      className="font-mono text-[11px] font-bold px-2 py-1 rounded-md"
                      style={{
                        background: 'rgba(168, 85, 247, 0.18)',
                        color: '#ffffff',
                        border: '1px solid rgba(168, 85, 247, 0.35)',
                        minWidth: '24px',
                        textAlign: 'center',
                      }}
                    >
                      {k}
                    </kbd>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-5 text-[11px]" style={{ color: '#a5b4fc' }}>
          Input alanına yazıyorsan kısayollar devre dışıdır. <kbd className="font-mono">g</kbd> bastıktan sonra 1.5 saniye içinde ikinci tuşa bas.
        </p>
      </div>
    </div>
  )
}
