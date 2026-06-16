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
            background: 'rgba(20, 14, 38, 0.85)',
            border: '2px solid #15102e',
            color: '#d8b4fe',
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
          style={{ border: '2px solid #15102e' }}
        />
      ) : (
        <div
          className="w-full h-full rounded-full flex items-center justify-center font-bebas text-white"
          style={{
            background: 'linear-gradient(135deg, #6b21a8 0%, #9333ea 100%)',
            border: '2px solid #15102e',
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
            background: '#22c55e',
            border: '2px solid #15102e',
            boxShadow: '0 0 6px rgba(34, 197, 94, 0.55)',
          }}
          title="Çevrimiçi"
        />
      )}
    </div>
  )
}
