import cldImg, { ImgSize } from '../lib/cldImg'
import { useOnline } from '../lib/presence'

/**
 * FAZ 5.14 — Slack tarzi avatar cluster.
 *
 * Kullanım:
 *   <AvatarCluster
 *      items={[{ id, name, avatarUrl }]}
 *      size={32}
 *      max={4}
 *      showOnlineDot
 *   />
 *
 * - items > max ise son daire "+N" gosterir
 * - showOnlineDot: presence hook'tan online ise sag-alt yesil nokta
 * - Avatar URL yoksa Bebas initial + mor gradient fallback
 */
export default function AvatarCluster({
  items = [],
  size = 32,
  max = 4,
  showOnlineDot = false,
  overlap = 0.30,
}) {
  if (!items.length) return null
  const visible = items.slice(0, max)
  const overflow = Math.max(0, items.length - max)
  const overlapPx = Math.floor(size * overlap)

  return (
    <div className="flex items-center" style={{ paddingLeft: 2 }}>
      {visible.map((it, i) => (
        <AvatarBubble
          key={it.id ?? i}
          item={it}
          size={size}
          showOnlineDot={showOnlineDot}
          style={{ marginLeft: i === 0 ? 0 : -overlapPx, zIndex: visible.length - i }}
        />
      ))}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center font-bebas tracking-wider rounded-full"
          style={{
            width: size,
            height: size,
            marginLeft: -overlapPx,
            background: 'rgba(13, 11, 9, 0.85)',
            border: '2px solid #221f1b',
            color: '#cdb78f',
            fontSize: Math.floor(size * 0.42),
            zIndex: 0,
          }}
          title={`+${overflow} daha`}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}

function AvatarBubble({ item, size, showOnlineDot, style }) {
  const isOnline = useOnline(showOnlineDot ? item.id : null)
  const initial = (item.name?.charAt(0) || '?').toUpperCase()
  const dotSize = Math.max(8, Math.floor(size * 0.28))

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size, ...style }}>
      {item.avatarUrl ? (
        <img
          src={cldImg(item.avatarUrl, { w: ImgSize.avatarSm })}
          alt={item.name || ''}
          loading="lazy"
          decoding="async"
          className="w-full h-full rounded-full object-cover"
          style={{ border: '2px solid #221f1b' }}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-bebas text-white"
          style={{
            background: 'linear-gradient(135deg, #1b1815 0%, #b8902d 100%)',
            border: '2px solid #221f1b',
            fontSize: Math.floor(size * 0.45),
            lineHeight: 1,
          }}
        >
          {initial}
        </div>
      )}
      {showOnlineDot && isOnline && (
        <span
          className="absolute rounded-full"
          style={{
            bottom: 0,
            right: 0,
            width: dotSize,
            height: dotSize,
            background: '#7a9f7a',
            border: '2px solid #221f1b',
            boxShadow: '0 0 6px rgba(34, 197, 94, 0.55)',
          }}
          title="Çevrimiçi"
        />
      )}
    </div>
  )
}
