/**
 * FAZ 8 — useConfirm hook + ConfirmProvider
 *
 * Promise-based imperative confirm dialog. Native window.confirm() ile bire bir
 * degistirilebilecek sekilde tasarlandi:
 *
 *   const confirm = useConfirm()
 *   async function handleDelete() {
 *     const ok = await confirm({ description: 'Emin misiniz?', destructive: true })
 *     if (!ok) return
 *     doDelete()
 *   }
 *
 * Kullanmak icin App.jsx'te <ConfirmProvider> ile wrap et. Tek bir global dialog
 * render edilir; birden fazla component ayni portal'i paylasir.
 */
import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)   // { title, description, ... } | null
  const [loading, setLoading] = useState(false)
  const resolverRef = useRef(null)

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve
      setState({
        title: opts.title ?? 'Emin misiniz?',
        description: opts.description ?? '',
        confirmLabel: opts.confirmLabel ?? (opts.destructive ? 'Evet, sil' : 'Onayla'),
        cancelLabel: opts.cancelLabel ?? 'Vazgeç',
        destructive: !!opts.destructive,
      })
    })
  }, [])

  const close = useCallback(() => {
    resolverRef.current?.(false)
    resolverRef.current = null
    setState(null)
    setLoading(false)
  }, [])

  const onConfirm = useCallback(() => {
    resolverRef.current?.(true)
    resolverRef.current = null
    setState(null)
    setLoading(false)
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!state}
        onClose={close}
        onConfirm={onConfirm}
        loading={loading}
        title={state?.title}
        description={state?.description}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        destructive={state?.destructive}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    // Fallback — provider mount edilmemisse native confirm ile geri sar
    // (silent degradation; test / storybook / hot-reload'da faydali)
    return async (opts) => {
      const msg = [opts?.title, opts?.description].filter(Boolean).join('\n\n')
      return typeof window !== 'undefined' && window.confirm(msg)
    }
  }
  return ctx
}
