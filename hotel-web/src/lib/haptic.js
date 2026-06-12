/**
 * FAZ 3 — Haptic feedback (mobile vibration).
 *
 * Mobil tarayicilarda destekleniyorsa kisa titretmme ile UI feedback.
 * Toaster container'i MutationObserver ile izlenir: yeni toast eklenince titretir.
 * Desktop'ta navigator.vibrate yok, sessiz no-op.
 */

export function hapticLight() {
  try { navigator.vibrate && navigator.vibrate(20) } catch {}
}

export function hapticSuccess() {
  try { navigator.vibrate && navigator.vibrate([10, 30, 10]) } catch {}
}

export function hapticError() {
  try { navigator.vibrate && navigator.vibrate([40, 50, 40]) } catch {}
}

/**
 * Toaster DOM container'ini izler, yeni toast eklenince haptic tetikler.
 * App.jsx mount edildikten sonra bir kez cagrilir.
 */
let observer = null
export function initHapticForToasts() {
  if (observer || typeof MutationObserver === 'undefined') return
  if (!navigator.vibrate) return  // desktop = no-op

  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue
        if (node.matches?.('[data-hot-toast], [aria-live]') ||
            node.querySelector?.('[data-hot-toast]')) {
          hapticLight()
          return
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
}
