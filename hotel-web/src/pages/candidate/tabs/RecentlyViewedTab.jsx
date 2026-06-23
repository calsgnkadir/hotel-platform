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
        <p className="text-sm" style={{ color: 'rgba(229, 231, 235, 0.70)' }}>
          {items.length} ilan incelendi · cihazında saklanır
        </p>
        <button type="button" onClick={handleClearAll}
          className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-full"
          style={{
            background: 'rgba(239, 68, 68, 0.10)',
            color: '#fca5a5',
            border: '1px solid rgba(239, 68, 68, 0.30)',
          }}>
          Geçmişi Temizle
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => {
          const salary = formatSalary(item.salaryMin, item.salaryMax, item.salaryType, item.tipsIncluded)
          return (
            <div key={item.id}
                 onClick={() => navigate(`/listings/${item.id}`)}
                 className="rounded-2xl overflow-hidden cursor-pointer transition-all relative group"
                 style={{
                   background: 'linear-gradient(145deg, rgba(21, 36, 61, 0.92) 0%, rgba(15, 23, 38, 0.98) 100%)',
                   border: '1px solid rgba(212, 168, 83, 0.14)',
                   boxShadow: '0 4px 20px rgba(0, 0, 0, 0.20)',
                 }}
                 onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)' }}
                 onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-[15px] leading-snug line-clamp-2 flex-1"
                      style={{ color: '#f1f5fb' }}>
                    {item.title}
                  </h3>
                  <button type="button"
                          onClick={(e) => { e.stopPropagation(); handleRemove(item.id) }}
                          title="Geçmişten kaldır"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] flex-shrink-0"
                          style={{ color: 'rgba(229, 231, 235, 0.45)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
                {item.businessName && (
                  <p className="text-sm mb-1" style={{ color: '#fde9a5' }}>
                    {item.businessName}
                  </p>
                )}
                <div className="flex items-center gap-1.5 text-xs flex-wrap"
                     style={{ color: 'rgba(229, 231, 235, 0.70)' }}>
                  {item.district && <span>{item.district}</span>}
                  {item.district && item.position && <span style={{ opacity: 0.4 }}>·</span>}
                  {item.position && <span>{POSITION_LABELS[item.position] || item.position}</span>}
                  {item.jobType && <span style={{ opacity: 0.4 }}>·</span>}
                  {item.jobType && <span>{JOB_TYPE_LABELS[item.jobType] || item.jobType}</span>}
                </div>
                {salary && (
                  <p className="font-bebas text-base tracking-wider mt-2"
                     style={{ color: '#fde9a5' }}>
                    {salary}
                  </p>
                )}
                <p className="text-[10px] uppercase tracking-wider mt-3 pt-2 border-t"
                   style={{ color: 'rgba(229, 231, 235, 0.45)', borderColor: 'rgba(212, 168, 83, 0.12)' }}>
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
