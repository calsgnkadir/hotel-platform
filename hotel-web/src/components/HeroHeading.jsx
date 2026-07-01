// FAZ 5.4 — WordPlay benchmark: stratejik kelime vurgusu pattern.
// "Word + Play" gibi 1-2 kelime renkli/glow, gerisi sade — premium hero baslik.

/**
 * HeroHeading
 *
 * Iki kullanim sekli:
 *
 * 1) parts (array) ile esnek vurgu:
 *    <HeroHeading parts={[
 *      { text: 'Otel' },
 *      { text: 'Acente', accent: true },
 *      { text: 'Platformu' },
 *    ]} />
 *
 * 2) children ile direkt JSX kontrolu:
 *    <HeroHeading>
 *      Istanbul'un <span className="accent">en hızlı</span> personel platformu
 *    </HeroHeading>
 *
 * Props:
 *   parts        — [{ text, accent? }] (opsiyonel)
 *   children     — direkt JSX
 *   as           — 'h1' | 'h2' (default 'h1')
 *   size         — 'sm' | 'md' | 'lg' | 'xl' (default 'lg')
 *   align        — 'center' | 'left' (default 'left')
 *   glow         — accent kelimelere text-shadow ekle (default true)
 *   className    — extra
 *
 * Tum metin Bebas Neue, uppercase, tracking-wider. Accent kelimeler
 * gradient ile boyali + opsiyonel glow.
 */
const SIZES = {
  sm: 'text-4xl md:text-5xl',
  md: 'text-5xl md:text-6xl',
  lg: 'text-6xl md:text-8xl',
  xl: 'text-7xl md:text-9xl',
}

export default function HeroHeading({
  parts,
  children,
  as: Tag = 'h1',
  size = 'lg',
  align = 'left',
  glow = true,
  className = '',
}) {
  const sizeCls = SIZES[size] || SIZES.lg
  const alignCls = align === 'center' ? 'text-center' : 'text-left'

  const accentStyle = glow
    ? {
        background: 'linear-gradient(135deg, #cdb78f 0%, #d4a853 40%, #d4a853 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        textShadow: '0 0 24px rgba(205, 183, 143, 0.35)',
        filter: 'drop-shadow(0 0 12px rgba(205, 183, 143, 0.28))',
      }
    : {
        background: 'linear-gradient(135deg, #cdb78f 0%, #d4a853 40%, #d4a853 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }

  return (
    <Tag
      className={`uppercase tracking-wider leading-[0.95] font-extrabold ${sizeCls} ${alignCls} ${className}`}
    >
      {parts && parts.length > 0
        ? parts.map((p, i) => (
            <span
              key={i}
              style={p.accent ? accentStyle : undefined}
              className={p.accent ? 'mx-1.5 inline-block' : ''}
            >
              {p.text}
              {i < parts.length - 1 ? ' ' : ''}
            </span>
          ))
        : children}
    </Tag>
  )
}
