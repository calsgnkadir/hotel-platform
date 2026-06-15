/**
 * FAZ 3 / #A2 — Cloudinary image optimizer.
 *
 * Cloudinary URL'ine `f_auto,q_auto[,w_X][,h_Y][,c_fill]` transformation
 * ekleyerek WebP/AVIF auto-format + uygun kalite + responsive width sunar.
 * Bandwidth: jpeg/png yerine WebP gönderiliyor — ~%30 daha küçük.
 *
 * Cloudinary olmayan url'ler (avatar fallback, harici link) aynen döner.
 */

/** Cloudinary delivery URL'inde "/upload/" segmentinden sonrasına transformation ekler. */
export default function cldImg(url, opts = {}) {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('res.cloudinary.com')) return url
  const marker = '/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url

  const parts = []
  parts.push('f_auto', 'q_auto')
  if (opts.w) parts.push(`w_${Math.round(opts.w)}`)
  if (opts.h) parts.push(`h_${Math.round(opts.h)}`)
  if (opts.w || opts.h) parts.push('c_' + (opts.crop || 'fill'))
  if (opts.dpr) parts.push(`dpr_${opts.dpr}`)

  // Zaten transformation varsa (örn: c_thumb) önüne ekleyelim — Cloudinary chain'i kabul ediyor.
  const before = url.slice(0, idx + marker.length)
  const after = url.slice(idx + marker.length)
  return `${before}${parts.join(',')}/${after}`
}

/** Yaygın preset boyutlar — tutarlılık için. */
export const ImgSize = {
  avatarSm: 64,   // 32px display @2x
  avatarMd: 128,  // 64px display @2x
  avatarLg: 256,  // 128px display @2x
  thumb: 400,
  card: 800,
  hero: 1600,
}
