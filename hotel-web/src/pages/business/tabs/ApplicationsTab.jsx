import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { StatusBadge, NoShowBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import useFocusTrap from '../../../lib/useFocusTrap'
import ApplicationsKanban from '../components/ApplicationsKanban'
import ApplicationDetail from '../components/ApplicationDetail'

const VIEW_STORAGE_KEY = 'biz-applications-view'
// Liste gorunumu 3x3 A4-dikey kart izgarasi — sayfa basi 9 kart (kullanici istegi).
const APPS_PAGE_SIZE = 9

// FAZ 19 — Her zaman gorunen filtre chip'leri.
const BASE_FILTERS = ['ALL', 'PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED']
// Nadir durumlar: sadece o durumda basvuru VARSA chip cikar. Derin link
// (?status=EXPIRED) ile gelinebildigi icin chip'siz birakilirsa liste
// filtreli ama aktif filtre gorunmez olurdu.
const RARE_FILTERS = ['STANDBY', 'EXPIRED', 'WITHDRAWN']   // FAZ C.1 — STANDBY eklendi
const FILTER_LABELS = {
  ALL: 'Tümü', PENDING: 'Bekleyen', REVIEWING: 'İnceleniyor', STANDBY: 'Yedek',
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
 * FAZ 19 — Status filtresi de URL'e tasindi (?status=ACCEPTED). Derin link
 * calisiyor ve filtre refresh'te kayboluyor degil.
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
                ? { background: 'rgba(15, 118, 110, 0.18)', color: 'var(--text-headline)', border: '1px solid rgba(15, 118, 110, 0.42)' }
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
            ) : (!!selected && isDesktop) ? (
              /* Detay paneli acikken sol sutun 360px — A4 kart sigmaz, kompakt satir. */
              <div className="space-y-2">
                {pageItems.map(app => (
                  <ApplicantRow key={app.id} app={app}
                                active={selected?.id === app.id}
                                onClick={() => selectApp(selected?.id === app.id ? null : app)} />
                ))}
              </div>
            ) : (
              /* A4 dikey kart izgarasi — 3 sutun x 3 satir = sayfa basi 9 */
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 justify-items-center">
                {pageItems.map(app => (
                  <ApplicantCardA4 key={app.id} app={app}
                                   active={selected?.id === app.id}
                                   onClick={() => selectApp(selected?.id === app.id ? null : app)}
                                   onOpenMessages={() => onOpenMessages?.(app.conversationId)} />
                ))}
              </div>
            )}

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

/* ─────────── Aday karti — A4 dikey (1 : 1.414) ───────────
 * Liste gorunumunun varsayilan karti. Ust: durum rozeti. Orta: avatar +
 * kimlik. Alt: e-posta, tarih ve aksiyonlar. Tum renkler --ah-* tokenlari
 * (beyaz zeminde beyaz metin hatasi bir daha olmasin diye sabit hex yok).
 */
function ApplicantCardA4({ app, active, onClick, onOpenMessages }) {
  const name = app.candidate?.fullName || 'Anonim'
  const initial = name.charAt(0).toUpperCase()
  const date = app.createdAt
    ? new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  return (
    /* Kart role="button" DEGIL: tum icerik erisilebilir ad olarak okunurdu
       ("Kabul Edildi Burak Sahin ...") ve filtre chip'leriyle cakisiyordu.
       Klavye/ekran okuyucu yolu icttaki "Detay" butonu. */
    <div
      onClick={onClick}
      className="w-full cursor-pointer rounded-xl flex flex-col transition-all hover:-translate-y-0.5"
      style={{
        maxWidth: 320,
        aspectRatio: '1 / 1.414',
        padding: 18,
        background: 'var(--ah-card)',
        border: `1px solid ${active ? 'var(--ah-brand)' : 'var(--ah-line)'}`,
        boxShadow: active ? '0 2px 12px rgba(15, 118, 110, .16)' : 'var(--elev-1)',
      }}
    >
      {/* ── Ust serit: durum ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StatusBadge status={app.status} />
        {app.noShow && <NoShowBadge />}
      </div>

      {/* ── Orta: avatar + kimlik ── */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-2.5 py-3">
        {app.candidate?.avatarUrl ? (
          <img
            src={cldImg(app.candidate.avatarUrl, { w: ImgSize.avatarMd })}
            alt={name}
            loading="lazy" decoding="async"
            className="rounded-full object-cover"
            style={{ width: 76, height: 76, border: '1px solid var(--ah-line)' }}
          />
        ) : (
          <div className="rounded-full grid place-items-center text-2xl font-bold"
               style={{
                 width: 76, height: 76,
                 background: 'var(--ah-brand-soft)',
                 color: 'var(--ah-brand)',
                 border: '1px solid var(--ah-line)',
               }}>
            {initial}
          </div>
        )}

        <div className="min-w-0 w-full">
          <div className="text-[15px] font-semibold truncate"
               style={{ color: 'var(--ah-ink)', letterSpacing: '-0.01em' }}>
            {name}
          </div>
          <div className="text-[12.5px] mt-1 leading-snug line-clamp-2"
               style={{ color: 'var(--ah-ink-2)' }}>
            {app.listing?.title || 'İlan bilgisi yok'}
          </div>
        </div>
      </div>

      {/* ── Alt: meta + aksiyonlar ── */}
      <div className="pt-3 space-y-2.5" style={{ borderTop: '1px solid var(--ah-line)' }}>
        <div className="space-y-1">
          <div className="text-[11.5px] truncate" style={{ color: 'var(--ah-ink-3)' }}>
            {app.candidate?.email || '—'}
          </div>
          <div className="text-[11.5px]" style={{ color: 'var(--ah-ink-3)' }}>
            {date}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onClick?.() }}
            aria-label={`${name} başvurusunun detayı`}
            className="flex-1 text-[12px] font-semibold py-1.5 rounded-md transition-colors"
            style={{ background: 'var(--ah-brand)', color: '#fff', border: '1px solid var(--ah-brand)' }}
          >
            Detay
          </button>
          {app.conversationId && (
            <button
              onClick={e => { e.stopPropagation(); onOpenMessages?.() }}
              title="Mesajlaşma"
              aria-label="Mesajlaşma"
              className="grid place-items-center rounded-md transition-colors"
              style={{
                width: 32, height: 30,
                background: 'var(--ah-card)',
                color: 'var(--ah-ink-2)',
                border: '1px solid var(--ah-line-2)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.8} stroke="currentColor" className="w-4 h-4" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* Detay paneli acikken sol 360px sutunda kullanilan kompakt satir. */
function ApplicantRow({ app, active, onClick }) {
  const name = app.candidate?.fullName || 'Anonim'
  return (
    <div
      onClick={onClick}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      className="cursor-pointer rounded-xl p-3 flex items-center gap-3 transition-all"
      style={{
        background: active ? 'var(--ah-brand-soft)' : 'var(--ah-card)',
        border: `1px solid ${active ? 'var(--ah-brand)' : 'var(--ah-line)'}`,
        boxShadow: 'var(--elev-1)',
      }}
    >
      {app.candidate?.avatarUrl ? (
        <img src={cldImg(app.candidate.avatarUrl, { w: ImgSize.avatarSm })} alt={name}
             loading="lazy" decoding="async"
             className="w-9 h-9 rounded-full object-cover flex-shrink-0"
             style={{ border: '1px solid var(--ah-line)' }} />
      ) : (
        <div className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold flex-shrink-0"
             style={{ background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)', border: '1px solid var(--ah-line)' }}>
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>{name}</div>
        <div className="text-[12px] truncate" style={{ color: 'var(--ah-ink-3)' }}>{app.listing?.title}</div>
      </div>
      <StatusBadge status={app.status} />
    </div>
  )
}
