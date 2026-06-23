/**
 * Dalga I1 — Takip + Engel listesi (Kariyer.net 'Takip Ettigin/Engelledigin Sirketler')
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import EmptyState from '../../../components/EmptyState'

const TYPE_LABELS = { HOTEL: 'Otel', RESTAURANT: 'Restoran', CAFE: 'Kafe', OTHER: 'Diğer' }

export default function RelationsTab({ onTabChange }) {
  const [tab, setTab] = useState('following')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: following = [], isLoading: loadingF } = useQuery({
    queryKey: ['my-following-businesses'],
    queryFn: () => hotelApi.getMyFollowingBusinesses(),
  })
  const { data: blocked = [], isLoading: loadingB } = useQuery({
    queryKey: ['my-blocked-businesses'],
    queryFn: () => hotelApi.getMyBlockedBusinesses(),
  })

  async function handleUnfollow(id) {
    try { await hotelApi.unfollowBusiness(id); queryClient.invalidateQueries({ queryKey: ['my-following-businesses'] }) }
    catch { toast.error('İşlem başarısız') }
  }
  async function handleUnblock(id) {
    try { await hotelApi.unblockBusiness(id); queryClient.invalidateQueries({ queryKey: ['my-blocked-businesses'] }) }
    catch { toast.error('İşlem başarısız') }
  }

  const list = tab === 'following' ? following : blocked
  const isLoading = tab === 'following' ? loadingF : loadingB

  return (
    <div className="space-y-4">
      {/* Tab chip'leri */}
      <div className="flex gap-2">
        {[
          { id: 'following', label: 'Takip Ettiklerim', count: following.length },
          { id: 'blocked',   label: 'Engellediklerim',  count: blocked.length },
        ].map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
              style={{
                background: active ? 'rgba(212, 168, 83, 0.20)' : 'rgba(21, 36, 61, 0.55)',
                color: active ? '#fde9a5' : 'rgba(229, 231, 235, 0.65)',
                border: `1px solid ${active ? 'rgba(212, 168, 83, 0.50)' : 'rgba(212, 168, 83, 0.15)'}`,
              }}>
              {t.label}
              {t.count > 0 && (
                <span className="text-[10px] font-bold opacity-80">{t.count > 9 ? '9+' : t.count}</span>
              )}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="card p-8 text-center"><div className="spinner mx-auto" /></div>
      ) : list.length === 0 ? (
        <div className="card">
          <EmptyState
            type="listings"
            title={tab === 'following' ? 'Henüz takip ettiğin işletme yok' : 'Henüz engellediğin işletme yok'}
            description={tab === 'following'
              ? 'İşletme profillerinden + Takip Et\'e tıklayarak buraya ekleyebilirsin.'
              : 'Engellemek istediğin bir işletme varsa profilinden engelleyebilirsin.'}
            ctaLabel={tab === 'following' ? 'İlanlara Git' : null}
            onCta={() => onTabChange?.('listings')}
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(b => (
            <div key={b.id}
                 className="rounded-2xl p-4 transition-all relative"
                 style={{
                   background: 'linear-gradient(145deg, rgba(21, 36, 61, 0.92) 0%, rgba(15, 23, 38, 0.98) 100%)',
                   border: '1px solid rgba(212, 168, 83, 0.14)',
                 }}>
              <button type="button"
                      onClick={() => navigate(`/p/business/${b.id}`)}
                      className="w-full text-left">
                <h3 className="font-bebas text-lg tracking-wider uppercase truncate"
                    style={{ color: '#ffffff' }}>{b.name}</h3>
                <div className="text-[12px] mt-1 truncate" style={{ color: 'rgba(229, 231, 235, 0.65)' }}>
                  {TYPE_LABELS[b.type] || b.type}
                  {b.district && ` · ${b.district}`}
                </div>
              </button>
              <button type="button"
                onClick={() => tab === 'following' ? handleUnfollow(b.id) : handleUnblock(b.id)}
                className="mt-3 w-full text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5"
                style={{
                  background: tab === 'following' ? 'rgba(15, 23, 38, 0.55)' : 'rgba(34, 197, 94, 0.18)',
                  color: tab === 'following' ? 'rgba(229, 231, 235, 0.75)' : '#86efac',
                  border: `1px solid ${tab === 'following' ? 'rgba(229, 231, 235, 0.20)' : 'rgba(34, 197, 94, 0.40)'}`,
                }}>
                {tab === 'following' ? 'Takipten Çık' : 'Engeli Kaldır'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
