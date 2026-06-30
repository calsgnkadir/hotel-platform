/**
 * Dalga I2 — Incelediklerim (localStorage view history)
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRecent, removeFromRecent, clearRecent } from '../../../lib/recentlyViewed'
import EmptyState from '../../../components/EmptyState'
import { POSITION_LABELS } from '../../../utils/labels'
import { formatSalary } from '../../../lib/salary'

const JOB_TYPE_LABELS = { PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı' }

export default function RecentlyViewedTab({ onTabChange }) {
  const navigate = useNavigate()
  const [items, setItems] = useState([])

  useEffect(() => { setItems(getRecent()) }, [])

  function relativeTime(ts) {
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60_000)
    if (m < 1)  return 'az önce'
    if (m < 60) return `${m} dk önce`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} sa önce`
    const d = Math.floor(h / 24)
    if (d < 7)  return `${d} gün önce`
    if (d < 30) return `${Math.floor(d / 7)} hafta önce`
    return new Date(ts).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
  }

  function handleRemove(id) {
    removeFromRecent(id)
    setItems(getRecent())
  }

  function handleClearAll() {
    if (!window.confirm('Tüm geçmiş silinecek. Emin misiniz?')) return
    clearRecent()
    setItems([])
  }

  if (items.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="listings"
          title="Henüz inceleme yapmadın"
          description="Açtığın ilanlar buraya otomatik düşer. İstediğinde geri dönebilirsin."
          ctaLabel="İlanlara Git"
          onCta={() => onTabChange?.('listings')}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px]" style={{ color: '#928678' }}>
          {items.length} ilan incelendi · cihazında saklanır
        </p>
        <button type="button" onClick={handleClearAll}
          className="text-[10px] uppercase tracking-[0.18em] font-semibold px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
          style={{
            background: 'rgba(180, 106, 85, 0.10)',
            color: '#d39481',
            border: '1px solid rgba(180, 106, 85, 0.28)',
          }}>
          Geçmişi Temizle
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item, i) => {
          const salary = formatSalary(item.salaryMin, item.salaryMax, item.salaryType, item.tipsIncluded)
          return (
            <div key={item.id}
                 onClick={() => navigate(`/listings/${item.id}`)}
                 className="overflow-hidden cursor-pointer transition-all relative group"
                 style={{
                   background: '#1b1815',
                   borderRadius: i % 2 === 0 ? '28px 12px 12px 12px' : '12px 28px 12px 12px',
                   border: 'none',
                   boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(245,239,226,0.03)',
                 }}
                 onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)' }}
                 onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-syne font-semibold text-[15px] leading-snug line-clamp-2 flex-1"
                      style={{ color: '#f5efe2', letterSpacing: '-0.015em' }}>
                    {item.title}
                  </h3>
                  <button type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemove(item.id) }}
                          title="Geçmişten kaldır"
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          style={{ color: '#6b6358' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                {item.businessName && (
                  <p className="text-[13px] mb-1" style={{ color: '#cdb78f' }}>
                    {item.businessName}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-[12px] flex-wrap"
                     style={{ color: '#928678' }}>
                  {item.district && <span>{item.district}</span>}
                  {item.district && item.position && <span style={{ color: '#6b6358' }}>·</span>}
                  {item.position && <span>{POSITION_LABELS[item.position] || item.position}</span>}
                  {item.jobType && <span style={{ color: '#6b6358' }}>·</span>}
                  {item.jobType && <span>{JOB_TYPE_LABELS[item.jobType] || item.jobType}</span>}
                </div>
                {salary && (
                  <p className="text-[18px] font-semibold tabular-nums mt-3"
                     style={{ color: '#cdb78f', letterSpacing: '-0.01em' }}>
                    {salary}
                  </p>
                )}
                <p className="text-[10px] uppercase tracking-[0.22em] mt-4 pt-3"
                   style={{ color: '#6b6358', borderTop: '1px solid rgba(205, 183, 143, 0.08)' }}>
                  {relativeTime(item.viewedAt)} incelendi
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
