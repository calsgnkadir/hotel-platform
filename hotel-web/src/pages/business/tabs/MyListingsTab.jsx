import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import { keys } from '../../../lib/queryClient'
import { POSITION_LABELS, JOB_TYPE_LABELS, SHIFT_SHORT, STATUS_LABELS } from '../lib/constants'
import ListingFormModal from '../modals/ListingFormModal'
import EmptyState from '../../../components/EmptyState'
import { SkeletonList } from '../../../components/Skeleton'
import { formatSalary } from '../../../lib/salary'  // FAZ 2/#25
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'  // FAZ D1

const PAGE_SIZE = 6

/* ── My Listings Tab — FAZ 0/#10 react-query + pagination ── */
export default function MyListingsTab({ applications = [] }) {
  const [formTarget, setFormTarget] = useState(null)
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  // useQuery — cache 30sn, otomatik refetch on mount
  const { data: listings = [], isLoading, error } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => hotelApi.getMyListings(),
  })

  if (error) toast.error('İlanlar yüklenemedi')

  const fetchListings = () =>
    queryClient.invalidateQueries({ queryKey: ['my-listings'] })

  async function handleStatusChange(listingId, status) {
    try {
      await hotelApi.updateListingStatus(listingId, status)
      toast.success('İlan durumu güncellendi')
      fetchListings()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  if (isLoading) return <SkeletonList count={4} />

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-ink-500">{listings.length} ilan</p>
        <button onClick={() => setFormTarget('new')}
          className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #1e3a5f, #234a82)' }}>
          + Yeni İlan
        </button>
      </div>

      {listings.length === 0 ? (
        <div className="card">
          <EmptyState
            type="listings"
            title="Henüz ilanın yok"
            description="3 adımda ilk ilanın yayında olsun:"
            steps={[
              { label: 'Pozisyon + ücret',  hint: 'Garson, komi, resepsiyon... saatlik veya günlük' },
              { label: 'Vardiya slotu ekle', hint: 'Tarih + saat + kaç kişi gerekli — istediğin kadar slot' },
              { label: 'Yayınla',            hint: 'Tercih ettiğin adaylara otomatik bildirim gider' },
            ]}
            ctaLabel="İlk İlanı Oluştur"
            onCta={() => setFormTarget('new')}
          />
        </div>
      ) : (() => {
        const totalPages = Math.max(1, Math.ceil(listings.length / PAGE_SIZE))
        const safePage = Math.min(page, totalPages)
        const start = (safePage - 1) * PAGE_SIZE
        const pageItems = listings.slice(start, start + PAGE_SIZE)
        return (
        <>
        <div className="space-y-3">
          {pageItems.map(listing => {
            // FAZ D1 — Bu ilana son 8 haftalik basvuru trendi
            const trendData = weeklyTrend(applications, a => a.listing?.id === listing.id)
            const last8wTotal = trendData.reduce((sum, b) => sum + b.c, 0)
            // Dalga 4 / Teknik 5 — Conversion: bu ilana toplam basvuru / goruntulenme
            const listingApplications = applications.filter(a => a.listing?.id === listing.id).length
            const views = listing.viewCount || 0
            const conversion = views > 0 ? Math.round((listingApplications / views) * 100) : null
            return (
            <div key={listing.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-ink-800 dark:text-ink-900">{listing.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      listing.status === 'ACTIVE' ? 'bg-brand-50 text-brand-700' :
                      listing.status === 'PAUSED' ? 'bg-amber-50 text-amber-700' :
                      'bg-cream-100 text-ink-500'}`}>
                      {STATUS_LABELS[listing.status]}
                    </span>
                  </div>
                  <p className="text-xs text-ink-500 mt-1">
                    {POSITION_LABELS[listing.position]} · {JOB_TYPE_LABELS[listing.jobType]}
                  </p>
                  {/* Dalga 4 / Teknik 5 — Conversion satiri */}
                  <p className="text-[11px] mt-1 font-medium" style={{ color: '#fde9a5' }}>
                    {views.toLocaleString('tr-TR')} görüntülenme · {listingApplications} başvuru
                    {conversion !== null && ` · %${conversion} dönüşüm`}
                  </p>
                  {(() => {
                    const s = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)
                    return s ? (
                      <p className="text-xs text-brand-700 font-medium mt-0.5">{s}</p>
                    ) : null
                  })()}
                  {/* Faz E2: slot özeti */}
                  {listing.shiftSlots?.length > 0 && (() => {
                    const total      = listing.shiftSlots.length
                    const next       = listing.shiftSlots[0]
                    const totalSeats = listing.shiftSlots.reduce((sum, s) => sum + (s.slotsNeeded || 0), 0)
                    const filled     = listing.shiftSlots.reduce((sum, s) => sum + (s.slotsFilled || 0), 0)
                    const nextStr = next
                      ? `${new Date(next.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${next.startTime?.slice(0, 5)}–${next.endTime?.slice(0, 5)}`
                      : null
                    return (
                      <p className="text-xs text-brand-700 dark:text-brand-700 font-medium mt-0.5">
                        {total} vardiya
                        {nextStr && ` · en yakın: ${nextStr}`}
                        {totalSeats > 0 && ` · ${filled}/${totalSeats} dolu`}
                      </p>
                    )
                  })()}
                  <p className="text-xs text-ink-400 mt-0.5">
                    {new Date(listing.createdAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {/* FAZ D1 — son 8 hafta başvuru trendi */}
                  <div className="flex items-center gap-1.5"
                       title={`Son 8 hafta: ${last8wTotal} başvuru`}>
                    <span className="text-[10px] uppercase tracking-widest font-bold"
                          style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
                      {last8wTotal}
                    </span>
                    <Sparkline data={trendData} color="#d4a853" width={56} height={20} />
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                  {listing.status !== 'CLOSED' && (
                    <button onClick={() => setFormTarget(listing)}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors font-medium">
                      Düzenle
                    </button>
                  )}
                  {listing.status === 'ACTIVE' && (
                    <button onClick={() => handleStatusChange(listing.id, 'PAUSED')}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
                      Durdur
                    </button>
                  )}
                  {listing.status === 'PAUSED' && (
                    <button onClick={() => handleStatusChange(listing.id, 'ACTIVE')}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-emerald-100 transition-colors font-medium">
                      Aktifleştir
                    </button>
                  )}
                  {listing.status !== 'CLOSED' && (
                    <button onClick={() => handleStatusChange(listing.id, 'CLOSED')}
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-cream-100 text-ink-600 hover:bg-cream-200 transition-colors font-medium">
                      Kapat
                    </button>
                  )}
                  </div>
                </div>
              </div>
            </div>
          )})}
        </div>
        {totalPages > 1 && (
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        )}
        </>
        )
      })()}

      {formTarget && (
        <ListingFormModal
          listing={formTarget === 'new' ? null : formTarget}
          onClose={() => setFormTarget(null)}
          onSuccess={fetchListings}
        />
      )}
    </div>
  )
}

/* shadcn-style pagination: « Previous 1 ... 4 5 6 ... 10 Next » */
function Pagination({ page, totalPages, onChange }) {
  // Sayfa numaralarini hesapla (ellipsis ile akıllı sıralama)
  function pageNumbers() {
    const out = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) out.push(i)
      return out
    }
    out.push(1)
    if (page > 4) out.push('…')
    const start = Math.max(2, page - 1)
    const end   = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) out.push(i)
    if (page < totalPages - 3) out.push('…')
    out.push(totalPages)
    return out
  }
  return (
    <nav className="flex items-center justify-center gap-1 pt-6" aria-label="Sayfalama">
      <PageBtn disabled={page === 1} onClick={() => onChange(page - 1)} ariaLabel="Önceki">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        <span className="ml-1">Önceki</span>
      </PageBtn>
      {pageNumbers().map((n, i) => (
        n === '…'
          ? <span key={`e${i}`} className="w-9 text-center text-[13px]" style={{ color: 'rgba(229, 231, 235, 0.50)' }}>…</span>
          : <PageBtn key={n} active={n === page} onClick={() => onChange(n)} ariaLabel={`Sayfa ${n}`}>
              {n}
            </PageBtn>
      ))}
      <PageBtn disabled={page === totalPages} onClick={() => onChange(page + 1)} ariaLabel="Sonraki">
        <span className="mr-1">Sonraki</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </PageBtn>
    </nav>
  )
}

function PageBtn({ children, active, disabled, onClick, ariaLabel }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            aria-label={ariaLabel} aria-current={active ? 'page' : undefined}
            className="min-w-[36px] h-9 inline-flex items-center justify-center px-3 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5"
            style={{
              background: active ? 'rgba(212, 168, 83, 0.18)' : 'rgba(21, 36, 61, 0.55)',
              color:      active ? '#fde9a5' : 'rgba(229, 231, 235, 0.75)',
              border:    `1px solid ${active ? 'rgba(212, 168, 83, 0.55)' : 'rgba(212, 168, 83, 0.18)'}`,
            }}>
      {children}
    </button>
  )
}
