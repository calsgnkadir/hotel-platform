import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import { keys } from '../../../lib/queryClient'
import { POSITION_LABELS, JOB_TYPE_LABELS, STATUS_LABELS } from '../lib/constants'
import ListingFormModal from '../modals/ListingFormModal'
import AttendanceModal from '../modals/AttendanceModal'
import EmptyState from '../../../components/EmptyState'
import { SkeletonList } from '../../../components/Skeleton'
import LoadError from '../../../components/ui/LoadError'
import { useConfirm } from '../../../lib/useConfirm'
import { formatSalary } from '../../../lib/salary'  // FAZ 2/#25
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'  // FAZ D1
import { nearestShift, formatSlotShort } from '../../../lib/shiftTime'

const PAGE_SIZE = 6

/* ── My Listings Tab — FAZ 0/#10 react-query + pagination ── */
export default function MyListingsTab({ applications = [] }) {
  const [formTarget, setFormTarget] = useState(null)
  const [dupTarget, setDupTarget] = useState(null)   // "Tekrar aç" (şablon) kaynağı
  const [rosterBusyId, setRosterBusyId] = useState(null)
  const [attendanceTarget, setAttendanceTarget] = useState(null)  // QR yoklama
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  // useQuery — cache 30sn, otomatik refetch on mount
  const { data: listings = [], isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => hotelApi.getMyListings(),
  })
  const confirm = useConfirm()

  // Derin link: ?tab=mylistings&attendance=<ilanId> (Genel bakış > Yapılacaklar > Yoklama)
  const [searchParams, setSearchParams] = useSearchParams()
  const attendanceParam = searchParams.get('attendance')
  useEffect(() => {
    if (!attendanceParam || attendanceTarget) return
    const target = listings.find(l => String(l.id) === String(attendanceParam))
    if (target) setAttendanceTarget(target)
  }, [attendanceParam, listings])
  function closeAttendance() {
    setAttendanceTarget(null)
    if (attendanceParam) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('attendance')
        return next
      }, { replace: true })
    }
  }

  // Ekip listesi (.xlsx): kabul edilenler, gün gün; giriş/çıkış + imza sütunu
  async function handleRoster(listingId) {
    setRosterBusyId(listingId)
    try {
      await hotelApi.downloadRoster(listingId)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setRosterBusyId(null)
    }
  }

  const fetchListings = () =>
    queryClient.invalidateQueries({ queryKey: ['my-listings'] })

  async function handleStatusChange(listingId, status) {
    if (status === 'CLOSED') {
      const ok = await confirm({
        title: 'İlan kapatılsın mı?',
        description: 'Kapatılan ilan yeni başvuru almaz; karar bekleyen, onaydaki ve yedekteki başvurular sona erer. Kabul edilmiş adaylar etkilenmez. Yeniden yayına almak yeni ilan gibi ilan hakkından sayılır.',
        confirmLabel: 'İlanı kapat',
        destructive: true,
      })
      if (!ok) return
    }
    try {
      await hotelApi.updateListingStatus(listingId, status)
      toast.success('İlan durumu güncellendi')
      fetchListings()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  // FAZ C.2 — Acil isaretle: o an "hemen musait" olan adaylara aninda bildirim
  const [urgentBusyId, setUrgentBusyId] = useState(null)
  async function handleUrgent(listingId, urgent) {
    if (urgent) {
      const ok = await confirm({
        title: 'İlan acil olarak işaretlensin mi?',
        description: 'Şu an "Bugün müsaitim" diyen adaylara anında bildirim gider. Bu işlem geri alınsa da giden bildirimler geri çekilemez.',
        confirmLabel: 'Acil olarak işaretle',
      })
      if (!ok) return
    }
    setUrgentBusyId(listingId)
    try {
      const res = await hotelApi.setListingUrgent(listingId, urgent)
      if (!urgent) {
        toast.success('Acil işareti kaldırıldı')
      } else if (res.notifiedCount > 0) {
        toast.success(`Acil ilan yayında — ${res.notifiedCount} müsait adaya bildirim gitti`)
      } else {
        toast.success('Acil ilan yayında. Şu an müsait aday yok; yeni müsait olanlar görecek.')
      }
      fetchListings()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally { setUrgentBusyId(null) }
  }

  if (isLoading) return <SkeletonList count={4} />
  if (error && listings.length === 0) {
    return <LoadError message="İlanların yüklenemedi." onRetry={() => refetch()} retrying={isFetching} />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="type-meta tabular-nums">{listings.length} ilan</p>
        {/* '+ Yeni İlan' = sayfadaki tek filled-amber CTA (spec: max 1 accent element/page) */}
        <button type="button" onClick={() => setFormTarget('new')} className="btn-primary !w-auto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Yeni ilan
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
            <div key={listing.id} className="tier-raised tier-raised-hover p-4">
              {/* Mobilde bilgi ustte, butonlar altta sarar (eskiden yan yana sikisip
                  bilgi sutunu tek kelimelik satirlara eziliyordu). */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="type-card">{listing.title}</h3>
                    {/* Durum dili: Aktif = olumlu; Durduruldu / Kapalı = nötr */}
                    <span className={`badge ${listing.status === 'ACTIVE' ? 'badge-positive' : 'badge-neutral'}`}>
                      {STATUS_LABELS[listing.status]}
                    </span>
                    {/* FAZ C.2 — acil rozeti (suresi gecince backend urgent=false doner) */}
                    {listing.urgent && (
                      <span className="badge badge-negative"
                            title={listing.urgentUntil
                              ? `Acil · ${new Date(listing.urgentUntil).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}'a kadar`
                              : 'Acil ilan'}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        Acil
                      </span>
                    )}
                  </div>
                  <p className="type-caption mt-1">
                    {POSITION_LABELS[listing.position]} · {JOB_TYPE_LABELS[listing.jobType]}
                  </p>
                  {/* Conversion — champagne accent bilgi satiri */}
                  <p className="type-caption mt-1 tabular-nums" style={{ color: 'var(--accent-action)' }}>
                    {views.toLocaleString('tr-TR')} görüntülenme · {listingApplications} başvuru
                    {conversion !== null && ` · %${conversion} dönüşüm`}
                  </p>
                  {(() => {
                    const s = formatSalary(listing.salaryMin, listing.salaryMax, listing.salaryType, listing.tipsIncluded)
                    return s ? (
                      <p className="type-caption font-medium mt-0.5" style={{ color: 'var(--accent-action)' }}>{s}</p>
                    ) : null
                  })()}
                  {/* Faz E2: slot özeti */}
                  {listing.shiftSlots?.length > 0 && (() => {
                    const total      = listing.shiftSlots.length
                    const next       = nearestShift(listing.shiftSlots, { mode: 'active' })  // devam eden gece vardiyası dahil
                    const totalSeats = listing.shiftSlots.reduce((sum, s) => sum + (s.slotsNeeded || 0), 0)
                    const filled     = listing.shiftSlots.reduce((sum, s) => sum + (s.slotsFilled || 0), 0)
                    const nextStr = next ? formatSlotShort(next) : null
                    return (
                      <p className="type-caption font-medium mt-0.5" style={{ color: 'var(--accent-action)' }}>
                        {total} vardiya
                        {nextStr && ` · en yakın: ${nextStr}`}
                        {totalSeats > 0 && ` · ${filled}/${totalSeats} dolu`}
                      </p>
                    )
                  })()}
                  <p className="type-caption mt-0.5">
                    {new Date(listing.createdAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2 sm:flex-shrink-0 sm:max-w-[60%]">
                  {/* Son 8 hafta başvuru trendi */}
                  <div className="flex items-center gap-1.5"
                       title={`Son 8 hafta: ${last8wTotal} başvuru`}>
                    <span className="type-meta tabular-nums">
                      {last8wTotal}
                    </span>
                    <Sparkline data={trendData} color="#1f2937" width={56} height={20} />
                  </div>
                  <div className="flex gap-2 flex-wrap sm:justify-end">
                  {/* Görünür iki eylem: Düzenle (kapalıysa Tekrar aç) + Yoklama; diğerleri "Diğer" menüsünde */}
                  {listing.status !== 'CLOSED' ? (
                    <button type="button" onClick={() => setFormTarget(listing)} className="btn-secondary !px-3">
                      Düzenle
                    </button>
                  ) : (
                    <button type="button" onClick={() => setDupTarget(listing)} className="btn-secondary !px-3"
                      title="Bu ilanı vardiyalar gelecek haftaya taşınmış olarak yeniden yayınla">
                      Tekrar aç
                    </button>
                  )}
                  <button type="button" onClick={() => setAttendanceTarget(listing)}
                    title="Toplanma noktası için QR ve canlı yoklama listesi"
                    className="btn-secondary !px-3">
                    Yoklama
                  </button>
                  <MoreMenu label={`${listing.title} için diğer eylemler`} items={[
                    { key: 'roster', label: rosterBusyId === listing.id ? 'Hazırlanıyor' : 'Ekip listesi (Excel)',
                      disabled: rosterBusyId === listing.id, onSelect: () => handleRoster(listing.id) },
                    listing.status !== 'CLOSED' && { key: 'dup', label: 'Tekrar aç (kopya)', onSelect: () => setDupTarget(listing) },
                    listing.status === 'ACTIVE' && { key: 'urgent',
                      label: urgentBusyId === listing.id ? 'Kaydediliyor' : listing.urgent ? 'Acil işaretini kaldır' : 'Acil olarak işaretle',
                      disabled: urgentBusyId === listing.id, onSelect: () => handleUrgent(listing.id, !listing.urgent) },
                    listing.status === 'ACTIVE' && { key: 'pause', label: 'Durdur', onSelect: () => handleStatusChange(listing.id, 'PAUSED') },
                    listing.status === 'PAUSED' && { key: 'activate', label: 'Aktifleştir', onSelect: () => handleStatusChange(listing.id, 'ACTIVE') },
                    listing.status !== 'CLOSED' && { key: 'close', label: 'Kapat', danger: true, onSelect: () => handleStatusChange(listing.id, 'CLOSED') },
                  ].filter(Boolean)} />
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

      {(formTarget || dupTarget) && (
        <ListingFormModal
          listing={formTarget && formTarget !== 'new' ? formTarget : null}
          duplicateFrom={dupTarget || null}
          onClose={() => { setFormTarget(null); setDupTarget(null) }}
          onSuccess={fetchListings}
        />
      )}

      {attendanceTarget && (
        <AttendanceModal listing={attendanceTarget} onClose={closeAttendance} />
      )}
    </div>
  )
}

/* "Diğer" eylem menüsü — aria-expanded, Escape ve dış tıklama ile kapanır. */
function MoreMenu({ label, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const btnRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!items.length) return null
  return (
    <div className="relative" ref={ref}>
      <button ref={btnRef} type="button" className="btn-secondary !px-3"
              aria-haspopup="menu" aria-expanded={open} aria-label={label}
              onClick={() => setOpen(o => !o)}>
        Diğer
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label={label}
             className="absolute right-0 mt-1 w-56 z-30 rounded-xl overflow-hidden py-1"
             style={{ background: 'var(--ah-card)', border: '1px solid var(--ah-line)', boxShadow: 'var(--elev-2)' }}>
          {items.map(it => (
            <button key={it.key} type="button" role="menuitem" disabled={it.disabled}
                    onClick={() => { setOpen(false); it.onSelect() }}
                    className="w-full text-left px-3.5 min-h-[44px] type-body hover:bg-[var(--ah-band)] disabled:opacity-50"
                    style={{ color: it.danger ? 'var(--ah-danger)' : 'var(--ah-ink)' }}>
              {it.label}
            </button>
          ))}
        </div>
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
          ? <span key={`e${i}`} className="w-9 text-center type-body" style={{ color: 'var(--text-faint)' }}>…</span>
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
  // Active pagination = FEATURED equivalent (single item highlight); passive = raised
  return (
    <button type="button" onClick={onClick} disabled={disabled}
            aria-label={ariaLabel} aria-current={active ? 'page' : undefined}
            className={`min-w-[36px] h-9 inline-flex items-center justify-center px-3 rounded-xl type-caption transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 ${
              active ? 'tier-featured' : 'tier-raised'
            }`}
            style={{
              color: active ? 'var(--text-headline)' : 'var(--text-secondary)',
              fontWeight: active ? 600 : 500,
            }}>
      {children}
    </button>
  )
}
