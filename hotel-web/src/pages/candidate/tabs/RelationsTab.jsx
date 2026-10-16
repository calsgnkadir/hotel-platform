/**
 * Dalga I1 — Takip + engel listesi (Kariyer.net "Takip ettiğin / Engellediğin şirketler").
 *
 * Üstte sayaçlı segment (işletme tarafı FavoritesTab deseniyle aynı .ah-segment).
 * Takipten çıkma tek tık (geri alınabilir, kayıp yok); engeli kaldırma onayla —
 * işletmenin ilanları ilan listende yeniden görünür.
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import EmptyState from '../../../components/EmptyState'
import BusinessLogo from '../../../components/BusinessLogo'
import { SkeletonList } from '../../../components/Skeleton'
import LoadError from '../../../components/ui/LoadError'
import { useConfirm } from '../../../lib/useConfirm'
import { BUSINESS_TYPE_LABELS } from '../../../utils/labels'

const FOLLOWING_KEY = ['my-following-businesses']
const BLOCKED_KEY = ['my-blocked-businesses']

export default function RelationsTab({ onTabChange }) {
  const [tab, setTab] = useState('following')
  const queryClient = useQueryClient()
  const confirm = useConfirm()
  const [busyId, setBusyId] = useState(null)

  const followingQ = useQuery({ queryKey: FOLLOWING_KEY, queryFn: () => hotelApi.getMyFollowingBusinesses() })
  const blockedQ = useQuery({ queryKey: BLOCKED_KEY, queryFn: () => hotelApi.getMyBlockedBusinesses() })
  const following = Array.isArray(followingQ.data) ? followingQ.data : []
  const blocked = Array.isArray(blockedQ.data) ? blockedQ.data : []

  async function handleUnfollow(b) {
    setBusyId(b.id)
    try {
      await hotelApi.unfollowBusiness(b.id)
      toast.success('Takipten çıkıldı')
      await queryClient.invalidateQueries({ queryKey: FOLLOWING_KEY })
    } catch { toast.error('İşlem başarısız') }
    finally { setBusyId(null) }
  }

  async function handleUnblock(b) {
    const ok = await confirm({
      title: 'Engeli kaldır',
      description: `"${b.name}" işletmesinin ilanları ilan listende yeniden görünür.`,
      confirmLabel: 'Engeli kaldır',
    })
    if (!ok) return
    setBusyId(b.id)
    try {
      await hotelApi.unblockBusiness(b.id)
      toast.success('Engel kaldırıldı')
      await queryClient.invalidateQueries({ queryKey: BLOCKED_KEY })
    } catch { toast.error('İşlem başarısız') }
    finally { setBusyId(null) }
  }

  const isFollowing = tab === 'following'
  const q = isFollowing ? followingQ : blockedQ
  const list = isFollowing ? following : blocked
  const segments = [
    { id: 'following', label: 'Takip ettiklerim', count: following.length },
    { id: 'blocked',   label: 'Engellediklerim',  count: blocked.length },
  ]

  return (
    <div className="space-y-4">
      <div className="ah-segment" role="tablist" aria-label="İşletme listeleri">
        {segments.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`ah-segment__item inline-flex items-center gap-1.5 ${active ? 'is-active' : ''}`}>
              {t.label}
              {t.count > 0 && <span className="type-caption type-num">{t.count > 99 ? '99+' : t.count}</span>}
            </button>
          )
        })}
      </div>

      {q.isLoading ? (
        <SkeletonList count={3} />
      ) : q.isError ? (
        <LoadError
          message={isFollowing ? 'Takip ettiğin işletmeler yüklenemedi.' : 'Engellediğin işletmeler yüklenemedi.'}
          onRetry={() => q.refetch()} retrying={q.isFetching} />
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            compact
            type="listings"
            title={isFollowing ? 'Henüz takip ettiğin işletme yok' : 'Engellediğin işletme yok'}
            description={isFollowing
              ? 'Bir işletmenin profilinde "Takip et"e dokun; yeni ilanlarını kaçırma.'
              : 'Bir işletmeyi profilindeki "Engelle" düğmesiyle engelleyebilirsin; ilanları listende görünmez.'}
            ctaLabel={isFollowing ? 'İlanlara göz at' : null}
            onCta={() => onTabChange?.('listings')}
          />
        </div>
      ) : (
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(b => {
            const meta = [BUSINESS_TYPE_LABELS[b.type] || 'İşletme', b.district].filter(Boolean).join(' · ')
            return (
              <li key={b.id} className="card !p-4 flex flex-col gap-3">
                <Link to={`/p/business/${b.id}`}
                  className="flex items-center gap-3 min-w-0 rounded-lg -m-1 p-1 focus-visible:outline focus-visible:outline-2"
                  style={{ outlineColor: 'var(--ah-brand)' }}>
                  <BusinessLogo name={b.name} logoUrl={b.logoUrl} size="md" alt={`${b.name} logosu`} />
                  <div className="min-w-0">
                    <h3 className="type-card truncate">{b.name}</h3>
                    <p className="type-meta truncate">{meta}</p>
                  </div>
                </Link>
                <button type="button" disabled={busyId === b.id}
                  onClick={() => isFollowing ? handleUnfollow(b) : handleUnblock(b)}
                  className="btn-secondary w-full mt-auto">
                  {busyId === b.id ? 'İşleniyor…' : (isFollowing ? 'Takipten çık' : 'Engeli kaldır')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
