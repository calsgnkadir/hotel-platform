/**
 * FAZ 1/#51 — Skeleton Loaders
 *
 * Spinner yerine "gri kart hayaleti". Sayfa daha sağlam hissi verir.
 *
 * Kullanım:
 *   <SkeletonCard />
 *   <SkeletonList count={3} />
 *   <SkeletonListingGrid count={6} />
 *   <SkeletonConversationList count={5} />
 *   <SkeletonAvatar size="md" />
 */

/* Tek bir gri animated kutucuk (shimmer efekti) */
function ShimmerBlock({ className = '', style = {} }) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(168,85,247,0.10) 0%, rgba(168,85,247,0.25) 50%, rgba(168,85,247,0.10) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

/* Generic kart skeleton */
export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="card">
      <ShimmerBlock className="h-4 w-2/3 mb-3" />
      <ShimmerBlock className="h-3 w-1/2 mb-2" />
      {Array.from({ length: rows }).map((_, i) => (
        <ShimmerBlock key={i} className="h-3 w-full mb-2" />
      ))}
    </div>
  )
}

/* Liste skeleton (örn başvuru listesi) */
export function SkeletonList({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card !p-4">
          <div className="flex items-start gap-3">
            <ShimmerBlock className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <ShimmerBlock className="h-4 w-1/2" />
              <ShimmerBlock className="h-3 w-2/3" />
              <ShimmerBlock className="h-3 w-1/3" />
            </div>
            <ShimmerBlock className="w-20 h-7 rounded-full flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* İlan grid skeleton (3'lü kolon) */
export function SkeletonListingGrid({ count = 6 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card !p-0 overflow-hidden">
          {/* Hero alan */}
          <ShimmerBlock className="h-32 w-full rounded-none" style={{ borderRadius: 0 }} />
          <div className="p-4 space-y-2.5">
            <ShimmerBlock className="h-4 w-3/4" />
            <ShimmerBlock className="h-3 w-1/2" />
            <ShimmerBlock className="h-3 w-2/3" />
            <ShimmerBlock className="h-3 w-1/3" />
            <div className="flex gap-2 mt-3">
              <ShimmerBlock className="h-8 flex-1 rounded-lg" />
              <ShimmerBlock className="h-8 flex-1 rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/* Mesajlaşma sohbet listesi skeleton */
export function SkeletonConversationList({ count = 5 }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl card !p-3">
          <ShimmerBlock className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <ShimmerBlock className="h-3 w-1/3" />
              <ShimmerBlock className="h-2.5 w-10" />
            </div>
            <ShimmerBlock className="h-3 w-4/5" />
            <ShimmerBlock className="h-2.5 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

/* Mesaj balonu skeleton (alternating left/right) */
export function SkeletonMessages({ count = 4 }) {
  return (
    <div className="space-y-3 px-3">
      {Array.from({ length: count }).map((_, i) => {
        const isMe = i % 2 === 1
        const width = ['w-1/2', 'w-2/3', 'w-3/5', 'w-1/3'][i % 4]
        return (
          <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
            <ShimmerBlock className={`h-10 ${width} rounded-2xl`} />
          </div>
        )
      })}
    </div>
  )
}

/* Form alanı skeleton (profil yüklerken) */
export function SkeletonForm({ fields = 4 }) {
  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="card space-y-4">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <ShimmerBlock className="h-3 w-20" />
            <ShimmerBlock className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* Avatar circle skeleton */
export function SkeletonAvatar({ size = 'md' }) {
  const sizes = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-14 h-14', xl: 'w-20 h-20' }
  return <ShimmerBlock className={`${sizes[size] || sizes.md} rounded-full`} />
}
