import { useState } from 'react'
import cldImg, { ImgSize } from '../lib/cldImg'
import { LOGO_FALLBACK_BG } from '../lib/logoColor'

/**
 * İşletme logosu — tek kaynak.
 *
 * Gerçek logo varsa onu (Cloudinary küçültmeli), yoksa ya da görsel
 * yüklenemezse işletme adının baş harfini grafit kutuda gösterir.
 *
 * Boyutlar:
 *   sm  40px (başvuru penceresi başlığı, liste satırı)
 *   md  46px (ilan kartı, ilan detayı)  — varsayılan
 *   lg  96px (işletme profil sayfası)
 *
 * Logo genelde işletme adının yanında durur; bu yüzden varsayılan olarak
 * dekoratiftir (alt="" / aria-hidden). Tek başına kullanılıyorsa `alt` ver.
 */
const SIZES = {
  sm: { box: 40, font: 16, radius: 8,  img: ImgSize.avatarSm * 1.25 },
  md: { box: 46, font: 17, radius: 9,  img: ImgSize.avatarMd },
  lg: { box: 96, font: 36, radius: 16, img: ImgSize.avatarLg },
}

export function businessInitial(name) {
  const ch = (name || '').trim().charAt(0)
  return ch ? ch.toLocaleUpperCase('tr-TR') : '?'
}

export default function BusinessLogo({ name, logoUrl, size = 'md', alt, className = '', style }) {
  const [broken, setBroken] = useState(false)
  const s = SIZES[size] || SIZES.md
  const base = {
    width: s.box,
    height: s.box,
    borderRadius: s.radius,
    flexShrink: 0,
    ...style,
  }

  if (logoUrl && !broken) {
    return (
      <img
        src={cldImg(logoUrl, { w: Math.round(s.img) })}
        alt={alt ?? ''}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={className}
        data-testid="business-logo-img"
        style={{ ...base, objectFit: 'cover', background: 'var(--ah-card)', border: '1px solid var(--ah-line)' }}
      />
    )
  }

  return (
    <span
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      // .ah-logo (tokens.css): grid ortalama, kalın beyaz harf
      className={`ah-logo ${className}`.trim()}
      data-testid="business-logo-initial"
      style={{
        ...base,
        background: LOGO_FALLBACK_BG,
        fontSize: s.font,
        lineHeight: 1,
      }}
    >
      {businessInitial(name)}
    </span>
  )
}
