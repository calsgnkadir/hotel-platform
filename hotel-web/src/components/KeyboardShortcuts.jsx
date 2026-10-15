import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { navFor, panelPathFor, tabForShortcut } from '../lib/navigation'

/**
 * FAZ 5.10 — Klavye kisayollari
 *
 * ?         Yardim modal ac
 * g + o     Genel Bakis
 * g + l     Ilanlar / Ilanlarim
 * g + a     Basvurular / Gelen Basvurular
 * g + m     Mesajlar
 * g + p     Profilim
 * Esc       Modal kapat
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
  const [chordActive, setChordActive] = useState(false)  // FAZ 5.10 polish — visible hint
  const chordRef = useRef({ key: null, timer: null })

  useEffect(() => {
    function clearChord() {
      chordRef.current.key = null
      if (chordRef.current.timer) {
        clearTimeout(chordRef.current.timer)
        chordRef.current.timer = null
      }
      setChordActive(false)
    }

    function goTab(tab) {
      if (!user?.role) return
      navigate(`${panelPathFor(user.role)}?tab=${tab}`)
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

      // Chord: g + harf — hedef sekme lib/navigation.js'teki `shortcut` alanından
      if (chordRef.current.key === 'g') {
        const target = tabForShortcut(user?.role, e.key)
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
        setChordActive(true)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('keydown', handleKey)
      clearChord()
    }
  }, [navigate, user?.role, helpOpen])

  const rows = [
    { keys: ['?'], label: 'Bu yardımı aç / kapat' },
    ...navFor(user?.role).filter(i => i.shortcut)
      .map(i => ({ keys: ['g', i.shortcut], label: i.label })),
    { keys: ['Ctrl', 'K'], label: 'Komut paleti (genel arama)' },
  ]

  return (
    <>
      {/* Chord aktif göstergesi — sağ alt, 1.5 sn sonra silinir */}
      {chordActive && !helpOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-6 z-[90] pointer-events-none" aria-hidden>
          <div className="px-3 py-2 rounded-full flex items-center gap-2"
               style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line-2)', boxShadow: 'var(--elev-2)' }}>
            <kbd className="font-mono type-badge px-2 py-0.5 rounded-md"
                 style={{ background: 'var(--ah-band)', color: 'var(--ah-ink)', border: '1px solid var(--ah-line-2)' }}>
              g
            </kbd>
            <span className="type-caption">İkinci tuş bekleniyor</span>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
             onClick={() => setHelpOpen(false)}
             role="dialog" aria-modal="true" aria-labelledby="kbd-help-title">
          <div aria-hidden className="absolute inset-0" style={{ background: 'rgba(17, 24, 39, 0.45)' }} />
          <div className="relative max-w-md w-full rounded-2xl p-6"
               onClick={(e) => e.stopPropagation()}
               style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line)', boxShadow: 'var(--elev-3)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 id="kbd-help-title" className="type-section">Klavye kısayolları</h2>
              <button type="button" onClick={() => setHelpOpen(false)} className="btn-ghost" aria-label="Kapat">
                Kapat
              </button>
            </div>

            <ul className="space-y-2">
              {rows.map((row, i) => (
                <li key={i} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                    style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)' }}>
                  <span className="type-body">{row.label}</span>
                  <span className="flex items-center gap-1">
                    {row.keys.map((k, j) => (
                      <span key={j} className="flex items-center gap-1">
                        {j > 0 && <span className="type-caption" aria-hidden="true">sonra</span>}
                        <kbd className="font-mono type-badge px-2 py-0.5 rounded-md text-center"
                             style={{ background: 'var(--ah-card)', color: 'var(--ah-ink)', border: '1px solid var(--ah-line-2)', minWidth: 24 }}>
                          {k}
                        </kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 type-caption">
              Bir metin alanına yazarken kısayollar devre dışıdır. g tuşundan sonra 1,5 saniye içinde ikinci tuşa bas.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
