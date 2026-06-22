/**
 * shadcn/ui Alert proje uyarlamasi
 * - TypeScript + cva yerine: JS + variant prop
 * - className composition: clsx benzeri sade join
 * - Renkler: dark altin tema (border-altin tint, bg saydam, text cream)
 *
 * Kullanim:
 *   <Alert variant="success" title="Profil guncellendi" />
 *   <Alert variant="error">{message}</Alert>
 *   <Alert variant="info" title="Bilgi"><p>Detay metni</p></Alert>
 */

const BASE = 'relative grid w-full items-start gap-x-2 gap-y-0.5 rounded-xl border px-3.5 py-3 text-sm'
const WITH_ICON = 'has-[>svg]:grid-cols-[1rem_1fr] [&>svg]:h-4 [&>svg]:w-4 [&>svg]:mt-0.5'

const VARIANTS = {
  default: {
    cls: 'bg-transparent',
    style: {
      borderColor: 'rgba(212, 168, 83, 0.20)',
      color: 'rgba(229, 231, 235, 0.85)',
    },
  },
  success: {
    cls: 'border',
    style: {
      borderColor: 'rgba(34, 197, 94, 0.40)',
      background: 'rgba(34, 197, 94, 0.08)',
      color: '#86efac',
    },
  },
  error: {
    cls: 'border',
    style: {
      borderColor: 'rgba(239, 68, 68, 0.40)',
      background: 'rgba(239, 68, 68, 0.08)',
      color: '#fca5a5',
    },
  },
  warning: {
    cls: 'border',
    style: {
      borderColor: 'rgba(251, 191, 36, 0.40)',
      background: 'rgba(251, 191, 36, 0.08)',
      color: '#fde68a',
    },
  },
  info: {
    cls: 'border',
    style: {
      borderColor: 'rgba(34, 211, 238, 0.40)',
      background: 'rgba(34, 211, 238, 0.08)',
      color: '#a5f3fc',
    },
  },
}

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  default: null,
}

export function Alert({ variant = 'default', title, icon, children, className = '', style = {} }) {
  const v = VARIANTS[variant] || VARIANTS.default
  const renderedIcon = icon !== undefined ? icon : ICONS[variant]

  return (
    <div role="alert"
         className={`${BASE} ${renderedIcon ? WITH_ICON : ''} ${v.cls} ${className}`}
         style={{ ...v.style, ...style }}>
      {renderedIcon}
      <div className={renderedIcon ? '' : 'col-span-full'}>
        {title && <AlertTitle>{title}</AlertTitle>}
        {children && <AlertDescription>{children}</AlertDescription>}
      </div>
    </div>
  )
}

export function AlertTitle({ children, className = '' }) {
  return <div className={`font-semibold text-[13.5px] leading-tight ${className}`}>{children}</div>
}

export function AlertDescription({ children, className = '' }) {
  return (
    <div className={`text-[12.5px] mt-0.5 flex flex-col gap-1 ${className}`}
         style={{ color: 'rgba(229, 231, 235, 0.78)' }}>
      {children}
    </div>
  )
}
