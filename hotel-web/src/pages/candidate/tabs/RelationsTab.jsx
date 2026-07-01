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
              className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.18em] px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
              style={{
                background: active ? 'rgba(205, 183, 143, 0.14)' : 'rgba(27, 24, 21, 0.75)',
                color: active ? '#f5efe2' : '#928678',
                border: `1px solid ${active ? 'rgba(205, 183, 143, 0.42)' : 'rgba(205, 183, 143, 0.10)'}`,
              }}>
              {t.label}
              {t.count > 0 && (
                <span className="text-[10px] font-semibold tabular-nums opacity-80">{t.count > 9 ? '9+' : t.count}</span>
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
          {list.map((b, i) => (
            <div key={b.id}
                 className="p-5 transition-all relative hover:-translate-y-0.5"
                 style={{
                   background: '#1b1815',
                   borderRadius: i % 2 === 0 ? '28px 12px 12px 12px' : '12px 28px 12px 12px',
                   border: 'none',
                   boxShadow: '0 12px 32px rgba(0,0,0,0.30), inset 0 1px 0 rgba(245,239,226,0.03)',
                 }}>
              <button type="button"
                      onClick={() => navigate(`/p/business/${b.id}`)}
                      className="w-full text-left">
                <h3 className="text-[16px] font-semibold truncate"
                    style={{ color: '#f5efe2', letterSpacing: '-0.015em' }}>{b.name}</h3>
                <div className="text-[12px] mt-1 truncate" style={{ color: '#928678' }}>
                  {TYPE_LABELS[b.type] || b.type}
                  {b.district && ` · ${b.district}`}
                </div>
              </button>
              <button type="button"
                onClick={() => tab === 'following' ? handleUnfollow(b.id) : handleUnblock(b.id)}
                className="mt-4 w-full text-[10px] font-semibold uppercase tracking-[0.18em] px-3 py-2 rounded-2xl transition-all hover:-translate-y-0.5"
                style={tab === 'following'
                  ? {
                      background: 'rgba(205, 183, 143, 0.06)',
                      color: '#c9bdaa',
                      border: '1px solid rgba(205, 183, 143, 0.18)',
                    }
                  : {
                      background: 'rgba(122, 159, 122, 0.10)',
                      color: '#a8c8a8',
                      border: '1px solid rgba(122, 159, 122, 0.32)',
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
