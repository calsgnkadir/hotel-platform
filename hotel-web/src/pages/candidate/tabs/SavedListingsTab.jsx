/**
 * Dalga H1 — Kaydettiklerim sekmesi (aday)
 *
 * Kullanici ListingsPage'de kalbe basinca burada gozukur.
 * Yenisi: getMySavedListings -> backend SavedListing entity.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { SkeletonListingGrid } from '../../../components/Skeleton'
import EmptyState from '../../../components/EmptyState'
import { POSITION_LABELS } from '../../../utils/labels'
import { formatSalary } from '../../../lib/salary'

const JOB_TYPE_LABELS = { PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı' }

export default function SavedListingsTab({ onTabChange }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['my-saved-listings'],
    queryFn: () => hotelApi.getMySavedListings(),
    staleTime: 60_000,
  })

  async function handleUnsave(listingId) {
    try {
      await hotelApi.unsaveListing(listingId)
      queryClient.invalidateQueries({ queryKey: ['my-saved-listings'] })
    } catch {
      toast.error('İşlem başarısız')
    }
  }

  if (isLoading) return <SkeletonListingGrid count={6} />

  if (saved.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="listings"
          title="Henüz kaydettiğin ilan yok"
          description="İlanlar sayfasındaki kalp ikonuna tıklayarak ilanları buraya ekleyebilirsin."
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
          {saved.length} kayıtlı ilan
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {saved.map(listing => (
          <SavedCard key={listing.id}
            listing={listing}
            onOpen={() => navigate(`/listings/${listing.id}`)}
            onUnsave={() => handleUnsave(listing.id)} />
        ))}
      </div>
    </div>
  )
}

function SavedCard({ listing, onOpen, onUnsave }) {
  const salary = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)
  return (
    <div onClick={onOpen}
         className="rounded-2xl overflow-hidden cursor-pointer transition-all relative"
         style={{
           background: 'linear-gradient(145deg, rgba(21, 36, 61, 0.92) 0%, rgba(15, 23, 38, 0.98) 100%)',
           border: '1px solid rgba(212, 168, 83, 0.18)',
           boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
         }}
         onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)' }}
         onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
      <div className="relative h-32"
           style={{ background: 'linear-gradient(135deg, #15243d, #234a82)' }}>
        {/* Salary chip */}
        {salary && (
          <span className="absolute bottom-3 left-3 text-[12px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.95), rgba(184, 144, 45, 0.95))',
                  color: '#15243d',
                }}>
            {salary}
          </span>
        )}
        {/* Unsave (dolu kalp) */}
        <button type="button"
                onClick={(e) => { e.stopPropagation(); onUnsave() }}
                title="Kaydedilenlerden cikar"
                className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all hover:scale-110"
                style={{
                  background: 'rgba(15, 23, 38, 0.75)',
                  border: '1px solid rgba(239, 68, 68, 0.55)',
                  color: '#fca5a5',
                }}>
          <svg width="14" height="14" viewBox="0 0 24 24"
               fill="currentColor" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-[15px] leading-snug line-clamp-2"
            style={{ color: '#f1f5fb' }}>
          {listing.title}
        </h3>
        <p className="text-sm mt-1" style={{ color: '#fde9a5' }}>
          {listing.businessName}
        </p>
        <div className="flex items-center gap-1.5 mt-2 text-xs flex-wrap"
             style={{ color: 'rgba(229, 231, 235, 0.70)' }}>
          <span>{listing.businessDistrict || 'İstanbul'}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{POSITION_LABELS[listing.position] || listing.position}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{JOB_TYPE_LABELS[listing.jobType] || listing.jobType}</span>
        </div>
      </div>
    </div>
  )
}
