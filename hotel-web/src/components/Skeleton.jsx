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
        background: 'linear-gradient(90deg, rgba(212, 168, 83,0.10) 0%, rgba(212, 168, 83,0.25) 50%, rgba(212, 168, 83,0.10) 100%)',
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

/* Dalga E — Generic dikdortgen blok (height/width parametrik) */
export function SkeletonBlock({ height = 80, width = '100%', className = '' }) {
  return (
    <ShimmerBlock
      className={`rounded-xl ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height, width }}
    />
  )
}

/* Dalga E — Overview/Dashboard stat karti
   Etiket + buyuk sayi + sparkline alani */
export function SkeletonStatCard() {
  return (
    <div className="card !p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <ShimmerBlock className="w-1.5 h-1.5 rounded-full" />
        <ShimmerBlock className="h-2.5 w-20 rounded" />
      </div>
      <div className="flex items-end justify-between gap-2">
        <ShimmerBlock className="h-7 w-12 rounded" />
        <ShimmerBlock className="h-6 w-14 rounded" />
      </div>
    </div>
  )
}

/* Dalga E — Overview tab stat grid'i icin (4 kart yan yana) */
export function SkeletonStatGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {Array.from({ length: count }).map((_, i) => <SkeletonStatCard key={i} />)}
    </div>
  )
}

/* Dalga E — ListingDetailPage tam sayfa skeleton
   Hero + chip + aciklama + sag basvur card */
export function SkeletonDetail() {
  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
      <div className="xl:grid xl:grid-cols-[1fr_340px] xl:gap-5 space-y-5 xl:space-y-0">
        <div className="space-y-5 min-w-0">
          {/* Hero */}
          <div className="card !p-0 overflow-hidden">
            <ShimmerBlock className="h-48 w-full" style={{ borderRadius: 0 }} />
            <div className="p-5 space-y-2">
              <ShimmerBlock className="h-7 w-2/3 rounded" />
              <ShimmerBlock className="h-4 w-1/3 rounded" />
            </div>
          </div>
          {/* 4 chip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card !p-3 space-y-1.5">
                <ShimmerBlock className="h-2.5 w-10 rounded mx-auto" />
                <ShimmerBlock className="h-4 w-3/4 rounded mx-auto" />
              </div>
            ))}
          </div>
          {/* Aciklama */}
          <div className="card p-5 space-y-2">
            <ShimmerBlock className="h-3 w-20 rounded" />
            <ShimmerBlock className="h-3 w-full rounded" />
            <ShimmerBlock className="h-3 w-5/6 rounded" />
            <ShimmerBlock className="h-3 w-4/6 rounded" />
          </div>
        </div>
        {/* Sag panel */}
        <aside className="space-y-4">
          <div className="card p-5 space-y-3">
            <ShimmerBlock className="h-3 w-12 rounded" />
            <ShimmerBlock className="h-8 w-2/3 rounded" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <ShimmerBlock className="h-3 w-16 rounded" />
                <ShimmerBlock className="h-3 w-20 rounded" />
              </div>
            ))}
            <ShimmerBlock className="h-11 w-full rounded-xl mt-3" />
          </div>
          <div className="card p-4">
            <ShimmerBlock className="h-3 w-16 rounded mb-3" />
            <ShimmerBlock className="h-60 w-full rounded-lg" />
          </div>
        </aside>
      </div>
    </div>
  )
}
