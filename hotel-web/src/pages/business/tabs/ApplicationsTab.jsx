import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatusBadge, NoShowBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import useFocusTrap from '../../../lib/useFocusTrap'
import ApplicationsKanban from '../components/ApplicationsKanban'
import ApplicationDetail from '../components/ApplicationDetail'
import ReliabilityBadge from '../../../components/ReliabilityBadge'

const VIEW_STORAGE_KEY = 'biz-applications-view'
const APPS_PAGE_SIZE = 15

// FAZ 19 — Her zaman gorunen filtre chip'leri.
const BASE_FILTERS = ['ALL', 'PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED']
// Nadir durumlar: sadece o durumda basvuru VARSA chip cikar. Analitik donut'u
// bu dilimleri (count>0 ise) gosterdigi icin drill-down hedefi olabiliyorlar —
// chip'siz birakilirsa liste filtreli ama aktif filtre gorunmez olurdu.
const RARE_FILTERS = ['EXPIRED', 'WITHDRAWN']
const FILTER_LABELS = {
  ALL: 'Tümü', PENDING: 'Bekleyen', REVIEWING: 'İnceleniyor',
  ACCEPTED: 'Kabul', REJECTED: 'Red', EXPIRED: 'Süresi Doldu', WITHDRAWN: 'İptal',
}

/**
 * FAZ 11.W2.1 — Split master-detail.
 *
 * Liste modu artik split-view: sol kompakt aday listesi (360px) + sag
 * ApplicationDetail panel. Modal-ac-kapa dongusu oldu — secim URL'e yazilir
 * (?id=42), sayfa yenilemede detail acik kalir.
 *
 * Mobile (<1024px): detail full-screen overlay olarak acilir (focus-trap korunur).
 * Kanban view degismedi; ekran >=1280px ise kanban default (W2.3).
 *
 * FAZ 19 — Status filtresi de URL'e tasindi (?status=ACCEPTED). Boylece analitik
 * grafiginden drill-down yapilabiliyor ve filtre refresh'te kayboluyor degil.
 */
export default function ApplicationsTab({ applications, onRefresh, onOpenMessages }) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])
  const [page, setPage] = useState(0)

  // W2.1 — URL'de secili basvuru id'si (?id=42). Refresh'te detail acik kalir.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlId = searchParams.get('id')
  const selected = urlId
    ? applications.find(a => String(a.id) === String(urlId)) || null
    : null

  // FAZ 19 — Filtre URL'den okunur. Taninmayan deger (elle yazilmis ?status=XYZ)
  // sessizce ALL'a duser — bos liste gosterip kullaniciyi saskina cevirmez.
  const urlStatus = searchParams.get('status')
  const filter = (urlStatus && [...BASE_FILTERS, ...RARE_FILTERS].includes(urlStatus))
    ? urlStatus
    : 'ALL'

  function setFilter(f) {
    setPage(0)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (f && f !== 'ALL') next.set('status', f)
      else next.delete('status')
      // Filtre degisince secili basvuru listeden dusebilir — detail'i kapat
      next.delete('id')
      return next
    }, { replace: true })
  }

  function selectApp(app) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (app) next.set('id', String(app.id))
      else next.delete('id')
      return next
    }, { replace: true })
  }

  // Decision/hold/no-show sonrasi guncel app objesi gelir — listeyi refresh
  // eden onRefresh() zaten cagriliyor; URL id ayni kaldigi icin selected
  // otomatik yeni data ile eslesir. Ekstra state sync gerekmez.
  function handleDetailChanged() { /* no-op: URL-driven selection */ }

  const [view, setView] = useState(() => {
    // W2.3 — Kanban default genis ekranlarda; localStorage kullanici tercihini ezer
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY)
      if (saved) return saved
    } catch {}
    return (typeof window !== 'undefined' && window.innerWidth >= 1280) ? 'kanban' : 'list'
  })
  useEffect(() => {
    try { localStorage.setItem(VIEW_STORAGE_KEY, view) } catch {}
  }, [view])

  // Mobile detail overlay focus trap
  const mobileDetailRef = useRef(null)
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1024
  )
  useEffect(() => {
    function onResize() { setIsDesktop(window.innerWidth >= 1024) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  useFocusTrap(mobileDetailRef, !!selected && !isDesktop, () => selectApp(null))

  // #84: status filtresi + aday adı araması (debounced)
  const filtered = applications.filter(a => {
    if (filter !== 'ALL' && a.status !== filter) return false
    if (debouncedSearch.trim()) {
      const name = (a.candidate?.fullName || '').toLowerCase()
      if (!name.includes(debouncedSearch.trim().toLowerCase())) return false
    }
    return true
  })

  // Nadir chip'ler: o durumda basvuru varsa VEYA su an o filtre aktifse goster
  // (aktifken gizlemek "filtreliyim ama neye gore belli degil" durumu yaratirdi).
  const visibleFilters = [
    ...BASE_FILTERS,
    ...RARE_FILTERS.filter(f => filter === f || applications.some(a => a.status === f)),
  ]

  const pageCount = Math.max(1, Math.ceil(filtered.length / APPS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * APPS_PAGE_SIZE, safePage * APPS_PAGE_SIZE + APPS_PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Filtre + arama */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-2 flex-wrap">
          {visibleFilters.map(f => {
            const count = f === 'ALL' ? applications.length : applications.filter(a => a.status === f).length
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`chip ${filter === f ? 'is-active' : ''}`}>
                {FILTER_LABELS[f]}
                <span className="text-[10px] tabular-nums opacity-80 ml-1">({count})</span>
              </button>
            )
          })}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Aday adı ara..." className="input text-sm" />
        </div>
        {/* Liste / Kanban view toggle */}
        <div className="tier-raised inline-flex p-1 self-start" style={{ borderRadius: '999px' }}>
          {[
            { id: 'list',   label: 'Liste' },
            { id: 'kanban', label: 'Kanban' },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className="type-overline px-3 py-1 rounded-full transition-all"
              style={view === v.id
                ? { background: 'rgba(205, 183, 143, 0.18)', color: 'var(--text-headline)', border: '1px solid rgba(205, 183, 143, 0.42)' }
                : { color: 'var(--text-muted)', border: '1px solid transparent' }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban gorunumu */}
      {view === 'kanban' && (
        applications.length === 0 ? (
          <div className="tier-raised p-6">
            <EmptyState
              type="applications"
              title="Henüz başvuru yok"
              description="İlan oluşturduğunuzda buraya adaylardan başvurular düşecek."
            />
          </div>
        ) : (
          <ApplicationsKanban
            applications={applications.filter(a => {
              if (!debouncedSearch.trim()) return true
              const name = (a.candidate?.fullName || '').toLowerCase()
              return name.includes(debouncedSearch.trim().toLowerCase())
            })}
            statusFilter={filter}
            onRefresh={onRefresh}
            onCardClick={(app) => selectApp(app)}
            onOpenMessages={(convId) => onOpenMessages?.(convId)}
          />
        )
      )}

      {/* W2.1 — Split master-detail (list view) */}
      {view === 'list' && (
        <div className={selected && isDesktop ? 'grid gap-4' : ''}
             style={selected && isDesktop ? { gridTemplateColumns: '360px 1fr', alignItems: 'start' } : undefined}>

          {/* SOL: master list */}
          <div className="space-y-2 min-w-0">
            {filtered.length === 0 ? (
              <div className="tier-raised p-6">
                <EmptyState
                  type="applications"
                  title={applications.length === 0 ? 'Henüz başvuru yok' : 'Bu filtreye uyan başvuru yok'}
                  description={applications.length === 0
                    ? 'İlan oluşturduğunuzda buraya adaylardan başvurular düşecek.'
                    : 'Filtreleri değiştirerek farklı kriterlerde aratın.'}
                  ctaLabel={applications.length > 0 ? 'Tüm Başvurular' : null}
                  onCta={() => { setFilter('ALL'); setSearch('') }}
                />
              </div>
            ) : pageItems.map(app => {
              const isActive = selected?.id === app.id
              const compact = !!selected && isDesktop
              return (
                <div key={app.id}
                     onClick={() => selectApp(isActive ? null : app)}
                     className={`cursor-pointer transition-all ${isActive ? 'tier-featured' : 'tier-raised tier-raised-hover'} ${compact ? 'p-3' : 'p-4'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {app.candidate?.avatarUrl ? (
                        <img src={cldImg(app.candidate.avatarUrl, { w: ImgSize.avatarSm })} alt={app.candidate.fullName}
                          loading="lazy" decoding="async"
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          style={{ border: '1px solid rgba(205, 183, 143, 0.22)' }} />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                             style={{
                               background: 'rgba(205, 183, 143, 0.08)',
                               border: '1px solid rgba(205, 183, 143, 0.22)',
                               color: '#cdb78f',
                             }}>
                          {app.candidate?.fullName?.charAt(0) || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="type-body font-semibold truncate" style={{ color: 'var(--text-headline)' }}>{app.candidate?.fullName}</span>
                          {!compact && <ReliabilityBadge score={app.candidate?.reliabilityScore} />}
                        </div>
                        {!compact && <div className="type-caption truncate">{app.candidate?.email}</div>}
                        <div className="type-caption truncate mt-0.5">{app.listing?.title}</div>
                        <div className="type-caption">
                          {new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: compact ? 'short' : 'long', year: compact ? undefined : 'numeric' })}
                        </div>
                      </div>
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-2 flex-shrink-0">
                      <StatusBadge status={app.status} />
                      {app.noShow && <NoShowBadge />}
                      {!compact && (
                        <button onClick={e => { e.stopPropagation(); onOpenMessages?.(app.conversationId) }}
                          className="type-overline px-3 py-1.5 rounded-full transition-all flex items-center gap-1"
                          style={{
                            background: 'rgba(205, 183, 143, 0.06)',
                            border: '1px solid rgba(205, 183, 143, 0.22)',
                            color: 'var(--accent-action)',
                          }}>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                               strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                          </svg>
                          Mesajlaşma
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Pagination footer */}
            {filtered.length > APPS_PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 pt-2 px-1 type-caption">
                <span>
                  {filtered.length} sonuçtan {safePage * APPS_PAGE_SIZE + 1}
                  {' – '}
                  {Math.min((safePage + 1) * APPS_PAGE_SIZE, filtered.length)}
                  {' arası'}
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="tier-raised tier-raised-hover px-3 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed type-caption font-semibold"
                    style={{ color: 'var(--text-secondary)' }}>
                    Önceki
                  </button>
                  <span className="font-semibold tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {safePage + 1} / {pageCount}
                  </span>
                  <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                    disabled={safePage >= pageCount - 1}
                    className="tier-raised tier-raised-hover px-3 py-1.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed type-caption font-semibold"
                    style={{ color: 'var(--text-secondary)' }}>
                    Sonraki
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SAG: detail panel — desktop split */}
          {selected && isDesktop && (
            <div className="tier-raised sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden">
              <ApplicationDetail
                app={selected}
                variant="panel"
                onClose={() => selectApp(null)}
                onRefresh={onRefresh}
                onOpenMessages={onOpenMessages}
                onChanged={handleDetailChanged}
              />
            </div>
          )}
        </div>
      )}

      {/* Mobile / kanban: detail full-screen overlay */}
      {selected && (!isDesktop || view === 'kanban') && (
        <div className="modal-overlay" onClick={() => selectApp(null)}>
          <div ref={mobileDetailRef}
               role="dialog" aria-modal="true" aria-labelledby="application-detail-title"
               className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <ApplicationDetail
              app={selected}
              variant="modal"
              onClose={() => selectApp(null)}
              onRefresh={onRefresh}
              onOpenMessages={onOpenMessages}
              onChanged={handleDetailChanged}
            />
          </div>
        </div>
      )}
    </div>
  )
}
