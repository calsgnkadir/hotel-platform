import { useEffect } from 'react'

/**
 * FAZ 3 / A11y — Modal icin focus trap + Esc kapatma.
 *
 * Kullanim:
 *   const ref = useRef(null)
 *   useFocusTrap(ref, isOpen, onClose)
 *   return <div ref={ref} role="dialog" aria-modal="true">...</div>
 *
 * - Modal acildiginda focus ilk focusable element'e gider
 * - Tab/Shift+Tab donguyu modal icinde tutar (sayfanin arkasina kacmaz)
 * - Esc tusu onClose'u tetikler
 * - Modal kapaninca focus daha onceki aktif element'e geri doner
 */
export default function useFocusTrap(ref, isOpen, onClose) {
  useEffect(() => {
    if (!isOpen || !ref.current) return
    const node = ref.current
    const previouslyFocused = document.activeElement

    // Focusable secici — disabled olanlari hariç tut
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
      ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    function getFocusables() {
      return Array.from(node.querySelectorAll(selector))
        .filter(el => el.offsetParent !== null)  // gorunmeyen el'leri at
    }

    // Acilinca ilk focusable'a fokusla (yoksa container'a)
    const firstFocusable = getFocusables()[0]
    if (firstFocusable) firstFocusable.focus()
    else node.focus()

    function handleKey(e) {
      if (e.key === 'Escape' && onClose) {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = getFocusables()
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    node.addEventListener('keydown', handleKey)
    return () => {
      node.removeEventListener('keydown', handleKey)
      // Modal kapaninca onceki focus'u geri yukle
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus()
      }
    }
  }, [isOpen, onClose, ref])
}
