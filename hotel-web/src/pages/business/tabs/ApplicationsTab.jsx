import { useState, useEffect, useRef } from 'react'
import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import { SENSITIVE_DOC_TYPES_BIZ, DOC_REQ_STATUS_LABELS } from '../lib/constants'
import { StatusBadge, NoShowBadge } from '../components/Badges'
import EmptyState from '../../../components/EmptyState'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import useFocusTrap from '../../../lib/useFocusTrap'
import ApplicationsKanban from '../components/ApplicationsKanban'
import { celebrate } from '../../../lib/confetti'  // FAZ 5.11
import ReliabilityBadge from '../../../components/ReliabilityBadge'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'

const VIEW_STORAGE_KEY = 'biz-applications-view'

const APPS_PAGE_SIZE = 15

/* ── Applications Tab ── */
export default function ApplicationsTab({ applications, onRefresh, onOpenMessages }) {
  const [filter, setFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200)
    return () => clearTimeout(t)
  }, [search])
  const [confirmState, setConfirmState] = useState(null)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState(null)
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_STORAGE_KEY) || 'list' } catch { return 'list' }
  })
  useEffect(() => {
    try { localStorage.setItem(VIEW_STORAGE_KEY, view) } catch {}
  }, [view])
  const detailDialogRef = useRef(null)
  useFocusTrap(detailDialogRef, !!selected, () => setSelected(null))
  const [actionLoading, setActionLoading] = useState(false)
  const [accessibleDocs, setAccessibleDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [requestingType, setRequestingType] = useState('')

  // Modal açıldığında veya selected güncellendiğinde, erişilebilir belgeleri yükle
  useEffect(() => {
    if (!selected) { setAccessibleDocs([]); return }
    setDocsLoading(true)
    hotelApi.getApplicationDocuments(selected.id)
      .then(setAccessibleDocs)
      .catch(() => setAccessibleDocs([]))
      .finally(() => setDocsLoading(false))
  }, [selected?.id, selected?.documentRequests?.length])

  async function handleViewDoc(doc) {
    try {
      await hotelApi.viewDocument(doc.id)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  // #84: status filtresi + aday adı araması (debounced)
  const filtered = applications.filter(a => {
    if (filter !== 'ALL' && a.status !== filter) return false
    if (debouncedSearch.trim()) {
      const name = (a.candidate?.fullName || '').toLowerCase()
      if (!name.includes(debouncedSearch.trim().toLowerCase())) return false
    }
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filtered.length / APPS_PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filtered.slice(safePage * APPS_PAGE_SIZE, safePage * APPS_PAGE_SIZE + APPS_PAGE_SIZE)

  async function doNoShow(appId) {
    setActionLoading(true)
    try {
      const result = await hotelApi.markNoShow(appId)
      if (result.autoBanned) {
        const banDate = new Date(result.bannedUntil).toLocaleDateString('tr-TR')
        toast.success(`No-show işaretlendi. Aday otomatik olarak ${banDate} tarihine kadar banlandı.`, { duration: 5000 })
      } else {
        toast.success(`No-show işaretlendi. Adayın kalan strike hakkı: ${result.candidateStrikesRemaining}`)
      }
      setSelected(result.application)
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  function handleNoShow(appId) {
    setConfirmState({
      title: 'NO-SHOW olarak işaretle',
      description: 'Bu işlem geri alınamaz. Adayın strike hakkı 1 düşecek, sıfıra inerse 30 gün otomatik banlanacak.',
      confirmLabel: 'Evet, işaretle',
      destructive: true,
      onConfirm: () => { setConfirmState(null); doNoShow(appId) },
    })
  }

  async function handleRequestDoc() {
    if (!requestingType || !selected) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.requestDocument(selected.id, requestingType)
      toast.success('Belge talebi gönderildi')
      setRequestingType('')
      setSelected(updated)
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  // Chat-v2'de kaldirildiydi, geri eklendi: isletme modal'dan direkt karar verebilir
  async function doDecide(decision) {
    if (!selected) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.reviewApplication(selected.id, decision)
      toast.success(decision === 'ACCEPTED' ? 'Aday kabul edildi' : 'Aday reddedildi')
      if (decision === 'ACCEPTED') celebrate()  // FAZ 5.11
      setSelected(updated)
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  function handleDecide(decision) {
    if (!selected) return
    const isAccept = decision === 'ACCEPTED'
    setConfirmState({
      title: isAccept ? 'Adayı kabul et' : 'Adayı reddet',
      description: isAccept
        ? 'Aday bildirim alacak ve çalışmaya başlayabilecek.'
        : 'Aday bildirim alacak. Kararı sonra değiştiremezsiniz.',
      confirmLabel: isAccept ? 'Evet, kabul et' : 'Evet, reddet',
      destructive: !isAccept,
      onConfirm: () => { setConfirmState(null); doDecide(decision) },
    })
  }

  // FAZ 2/#32 — Favori toggle
  const [isFavorited, setIsFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  useEffect(() => {
    if (!selected?.candidate?.id) { setIsFavorited(false); return }
    hotelApi.checkFavorite(selected.candidate.id)
      .then(setIsFavorited)
      .catch(() => setIsFavorited(false))
  }, [selected?.candidate?.id])

  async function handleToggleFavorite() {
    if (!selected?.candidate?.id) return
    setFavLoading(true)
    try {
      if (isFavorited) {
        await hotelApi.removeFavorite(selected.candidate.id)
        setIsFavorited(false)
        toast.success('Favoriden kaldirildi')
      } else {
        await hotelApi.addFavorite(selected.candidate.id, null)
        setIsFavorited(true)
        toast.success('Favorilere eklendi — "Favori Adaylar" sekmesinden eris')
      }
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setFavLoading(false) }
  }

  // FAZ 2/#28 — HOLD'a al (24 saat aday cevap versin)
  async function doHold() {
    if (!selected) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.holdApplication(selected.id)
      toast.success('Aday HOLD\'a alındı — 24 saat bekleniyor')
      setSelected(updated)
      onRefresh()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  function handleHold() {
    if (!selected) return
    setConfirmState({
      title: 'Adayı 24 saat HOLD\'a al',
      description: 'Aday 24 saat içinde Onayla/Reddet seçmezse başvuru otomatik düşecek. Bu, adayın gerçek niyetini test eden bir adımdır.',
      confirmLabel: 'Evet, HOLD\'a al',
      destructive: false,
      onConfirm: () => { setConfirmState(null); doHold() },
    })
  }

  return (
    <div className="space-y-4">
      {/* Filtre + arama */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED'].map(f => {
            const labels = { ALL: 'Tümü', PENDING: 'Bekleyen', REVIEWING: 'İnceleniyor', ACCEPTED: 'Kabul', REJECTED: 'Red' }
            const count = f === 'ALL' ? applications.length : applications.filter(a => a.status === f).length
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(0) }}
                className={`chip ${filter === f ? 'is-active' : ''}`}>
                {labels[f]}
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
        {/* FAZ 5.UX3 — Liste / Kanban view toggle (graphite raised + champagne tint) */}
        <div className="inline-flex rounded-full p-1 self-start"
             style={{ background: 'rgba(27, 24, 21, 0.85)', border: '1px solid rgba(205, 183, 143, 0.10)' }}>
          {[
            { id: 'list',   label: 'Liste' },
            { id: 'kanban', label: 'Kanban' },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className="px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-[0.22em] transition-all"
              style={view === v.id
                ? { background: 'rgba(205, 183, 143, 0.14)', color: '#f5efe2', border: '1px solid rgba(205, 183, 143, 0.42)' }
                : { color: '#928678', border: '1px solid transparent' }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* FAZ 5.5 — Kanban gorunumu */}
      {view === 'kanban' && (
        applications.length === 0 ? (
          <div className="card">
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
            statusFilter={filter}  /* Dalga H4 — chip secimi kanban'i filtrele */
            onRefresh={onRefresh}
            onCardClick={(app) => setSelected(app)}
            onOpenMessages={(convId) => onOpenMessages?.(convId)}
          />
        )
      )}

      {/* List view */}
      {view === 'list' && (
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card">
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
        ) : pageItems.map(app => (
          <div key={app.id} className="card hover:border-brand-300 dark:hover:border-brand-700 cursor-pointer transition-all"
               onClick={() => setSelected(app)}>
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {app.candidate?.avatarUrl ? (
                  <img src={cldImg(app.candidate.avatarUrl, { w: ImgSize.avatarSm })} alt={app.candidate.fullName}
                    loading="lazy" decoding="async"
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-cream-300" />
                ) : (
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: 'linear-gradient(135deg, #b89e6e 0%, #8a7349 100%)' }}>
                    {app.candidate?.fullName?.charAt(0) || '?'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-ink-800 dark:text-ink-900">{app.candidate?.fullName}</span>
                    <ReliabilityBadge score={app.candidate?.reliabilityScore} />
                  </div>
                  <div className="text-xs text-ink-500">{app.candidate?.email}</div>
                  <div className="text-xs text-ink-400 mt-0.5">{app.listing?.title}</div>
                  <div className="text-xs text-ink-400">
                    {new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={app.status} />
                {app.noShow && <NoShowBadge />}
                {/* Chat-v2: 'İncelemeye Al' yerine direkt 'Mesajlaşmaya git' */}
                <button onClick={e => { e.stopPropagation(); onOpenMessages?.(app.conversationId) }}
                  className="text-xs px-2.5 py-1.5 rounded-lg font-semibold text-white transition-all flex items-center gap-1"
                  style={{ background: 'linear-gradient(135deg, #b89e6e 0%, #8a7349 100%)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  Mesajlaşma
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* #84: Pagination footer */}
        {filtered.length > APPS_PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 pt-2 px-1 text-xs text-ink-500">
            <span>
              {filtered.length} sonuçtan {safePage * APPS_PAGE_SIZE + 1}
              {' – '}
              {Math.min((safePage + 1) * APPS_PAGE_SIZE, filtered.length)}
              {' arası'}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-3 py-1.5 rounded-md bg-white dark:bg-ink-800 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                Önceki
              </button>
              <span className="font-semibold text-ink-700">
                {safePage + 1} / {pageCount}
              </span>
              <button onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
                className="px-3 py-1.5 rounded-md bg-white dark:bg-ink-800 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div ref={detailDialogRef}
               role="dialog" aria-modal="true" aria-labelledby="application-detail-title"
               className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-cream-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {selected.candidate?.avatarUrl ? (
                    <img src={cldImg(selected.candidate.avatarUrl, { w: ImgSize.avatarMd })} alt={selected.candidate.fullName}
                      loading="lazy" decoding="async"
                      className="w-14 h-14 rounded-full object-cover border border-cream-300 flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                         style={{ background: 'linear-gradient(135deg, #b89e6e 0%, #8a7349 100%)' }}>
                      {selected.candidate?.fullName?.charAt(0) || '?'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 id="application-detail-title" className="text-lg font-bold text-ink-900">{selected.candidate?.fullName}</h2>
                      <ReliabilityBadge score={selected.candidate?.reliabilityScore} size="md" showLabel />
                    </div>
                    <p className="text-sm text-ink-500">{selected.candidate?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* FAZ 3 — Print: basvuru detayi yazdir */}
                  <button onClick={() => window.print()}
                    title="Yazdir"
                    className="no-print w-9 h-9 rounded-full flex items-center justify-center transition-all hover:-translate-y-0.5
                               bg-cream-100 dark:bg-ink-800 text-ink-500 hover:bg-brand-50 hover:text-brand-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                    </svg>
                  </button>
                  {/* FAZ 2/#32 - Favori toggle */}
                  <button onClick={handleToggleFavorite} disabled={favLoading}
                    title={isFavorited ? 'Favoriden kaldir' : 'Favorilere ekle'}
                    className={`no-print w-9 h-9 rounded-full flex items-center justify-center transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
                      isFavorited
                        ? 'text-white shadow-md'
                        : 'bg-cream-100 dark:bg-ink-800 text-ink-500 hover:bg-amber-50 hover:text-amber-600'
                    }`}
                    style={isFavorited ? { background: 'linear-gradient(135deg, #cdb78f 0%, #b8902d 100%)' } : {}}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                         fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor"
                         strokeWidth={1.8} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round"
                            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                    </svg>
                  </button>
                  <StatusBadge status={selected.status} />
                </div>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">İlan</h3>
                <div className="bg-cream-50 rounded-lg p-3 text-sm font-medium text-ink-700">
                  {selected.listing?.title} · {selected.listing?.businessName}
                </div>
              </div>

              {selected.coverLetter && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Ön Yazı</h3>
                  <div className="bg-cream-50 rounded-lg p-4 text-sm text-ink-700 leading-relaxed">
                    {selected.coverLetter}
                  </div>
                </div>
              )}

              {selected.availabilities?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Müsaitlik Saatleri</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.availabilities.map((av, i) => (
                      <span key={i} className="px-3 py-1.5 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-700 text-xs font-medium rounded-lg border border-brand-200 dark:border-brand-800">
                        {av.dayOfWeek} · {av.startTime}–{av.endTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.note && (
                <div>
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Notunuz</h3>
                  <div className="rounded-2xl p-3 text-sm"
                       style={{
                         background: 'rgba(200, 146, 58, 0.10)',
                         border: '1px solid rgba(200, 146, 58, 0.28)',
                         color: '#e0b766',
                       }}>
                    {selected.note}
                  </div>
                </div>
              )}

              {/* Görüntülenebilir Belgeler */}
              <div>
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">
                  Görüntülenebilir Belgeler
                </h3>
                {docsLoading ? (
                  <p className="text-xs text-ink-400">Yükleniyor...</p>
                ) : accessibleDocs.length === 0 ? (
                  <p className="text-xs text-ink-400 mb-3">
                    Bu aday henüz belge yüklememiş veya hassas belgeler için izin yok.
                  </p>
                ) : (
                  <div className="space-y-1.5 mb-3">
                    {accessibleDocs.map(doc => {
                      const typeLabel = (
                        SENSITIVE_DOC_TYPES_BIZ.find(t => t.type === doc.type)?.label
                      ) || doc.type
                      return (
                        <div key={doc.id}
                          className="flex items-center justify-between bg-cream-50 rounded-lg px-3 py-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-ink-700 font-medium truncate">{typeLabel}</div>
                            <div className="text-xs text-ink-400 truncate">{doc.originalFileName}</div>
                          </div>
                          <button onClick={() => handleViewDoc(doc)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700 hover:bg-brand-200 dark:hover:bg-brand-900/60 transition-colors flex-shrink-0">
                            Görüntüle
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Belge Talepleri */}
              <div>
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Belge Talepleri</h3>

                {selected.documentRequests?.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {selected.documentRequests.map(dr => {
                      const meta = SENSITIVE_DOC_TYPES_BIZ.find(t => t.type === dr.documentType)
                      const statusMeta = DOC_REQ_STATUS_LABELS[dr.status] || { cls: 'bg-cream-100 text-ink-600', label: dr.status }
                      return (
                        <div key={dr.id} className="flex items-center justify-between bg-cream-50 rounded-lg px-3 py-2">
                          <span className="text-sm text-ink-700">{meta?.label || dr.documentType}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-ink-400 mb-3">Henüz belge talep edilmemiş</p>
                )}

                {/* Yeni talep — sadece sonuçlanmamış başvurularda */}
                {['PENDING', 'REVIEWING'].includes(selected.status) && (() => {
                  const requestedTypes = new Set(selected.documentRequests?.map(dr => dr.documentType) || [])
                  const availableTypes = SENSITIVE_DOC_TYPES_BIZ.filter(t => !requestedTypes.has(t.type))
                  if (availableTypes.length === 0) {
                    return <p className="text-xs text-ink-400">Tüm hassas belge tipleri zaten talep edilmiş.</p>
                  }
                  return (
                    <div className="flex gap-2">
                      <select value={requestingType} onChange={e => setRequestingType(e.target.value)}
                        className="input text-sm flex-1">
                        <option value="">Belge tipi seç...</option>
                        {availableTypes.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                      </select>
                      <button onClick={handleRequestDoc} disabled={!requestingType || actionLoading}
                        className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-all"
                        style={{ background: 'linear-gradient(135deg, #b89e6e 0%, #8a7349 100%)' }}>
                        Talep Et
                      </button>
                    </div>
                  )
                })()}
              </div>

              {/* KARAR — PENDING / REVIEWING / HELD durumda butonlar */}
              {['PENDING', 'REVIEWING', 'HELD'].includes(selected.status) && (
                <div className="border-t border-cream-200 pt-4 space-y-3">
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Karar</h3>
                  {selected.status === 'HELD' ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      HOLD aktif — aday {selected.holdDeadline ? new Date(selected.holdDeadline).toLocaleString('tr-TR') : 'belirsiz'} 'a kadar cevap vermeli
                    </p>
                  ) : (
                    <p className="text-xs text-ink-500">
                      Belgeleri ve mesajlasmayi inceledikten sonra karar verin. Bu islem geri alinmaz.
                    </p>
                  )}
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleDecide('ACCEPTED')} disabled={actionLoading}
                      className="py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                      style={{
                        background: 'linear-gradient(135deg, #7a9f7a 0%, #5e8460 100%)',
                        boxShadow: '0 8px 22px rgba(122, 159, 122, 0.30)',
                      }}>
                      Kabul
                    </button>
                    {/* FAZ 2/#28 - HOLD butonu sadece PENDING/REVIEWING'de */}
                    {selected.status !== 'HELD' && (
                      <button onClick={handleHold} disabled={actionLoading}
                        className="py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                        style={{
                          background: 'linear-gradient(135deg, #c8923a 0%, #a3762d 100%)',
                          boxShadow: '0 8px 22px rgba(200, 146, 58, 0.28)',
                        }}>
                        HOLD 24sa
                      </button>
                    )}
                    <button onClick={() => handleDecide('REJECTED')} disabled={actionLoading}
                      className={`py-2.5 rounded-2xl text-xs font-semibold uppercase tracking-[0.14em] text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 ${selected.status === 'HELD' ? 'col-span-2' : ''}`}
                      style={{
                        background: 'linear-gradient(135deg, #b46a55 0%, #8f4e3d 100%)',
                        boxShadow: '0 8px 22px rgba(180, 106, 85, 0.30)',
                      }}>
                      Reddet
                    </button>
                  </div>
                </div>
              )}

              {/* Iletisim — mesajlasmaya git (her durumda) */}
              <div className="border-t border-cream-200 pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">İletişim</h3>
                <button
                  onClick={() => onOpenMessages?.(selected.conversationId)}
                  className="w-full py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
                    color: '#1a1208',
                    boxShadow: '0 12px 28px rgba(212, 168, 83, 0.32), inset 0 1px 0 rgba(255,255,255,0.22)',
                  }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  Mesajlaşmaya Git
                </button>
              </div>

              {/* No-show işaretleme — sadece ACCEPTED + henüz işaretlenmemiş */}
              {selected.status === 'ACCEPTED' && !selected.noShow && (
                <div className="border-t border-cream-200 pt-4 space-y-2">
                  <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">İşe Gelme Durumu</h3>
                  <p className="text-xs text-ink-500">
                    Aday kabul edilen iş için işe gelmediyse aşağıdaki butonla işaretleyin.
                    Aday 3 kez işe gelmediğinde otomatik olarak 30 gün banlanır.
                  </p>
                  <button onClick={() => handleNoShow(selected.id)}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-2xl text-sm font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-60"
                    style={{
                      background: 'linear-gradient(135deg, #b46a55 0%, #8f4e3d 100%)',
                      color: '#f5efe2',
                      boxShadow: '0 10px 24px rgba(180, 106, 85, 0.28)',
                    }}>
                    Aday İşe Gelmedi (No-Show) Olarak İşaretle
                  </button>
                </div>
              )}

              {/* No-show işaretlenmişse uyarı banner */}
              {selected.noShow && (
                <div className="pt-4" style={{ borderTop: '1px solid rgba(205, 183, 143, 0.10)' }}>
                  <div className="rounded-2xl px-4 py-3 text-sm flex items-start gap-2"
                       style={{
                         background: 'rgba(180, 106, 85, 0.10)',
                         border: '1px solid rgba(180, 106, 85, 0.28)',
                         color: '#d39481',
                       }}>
                    <div>
                      <div className="font-semibold" style={{ color: '#e3a896' }}>No-show olarak işaretlendi</div>
                      <div className="text-xs mt-0.5" style={{ color: '#d39481' }}>
                        Bu aday kabul edilen iş için işe gelmediğini bildirdiniz. Strike hakkı düşürüldü.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-5 flex gap-2">
              <button onClick={() => setSelected(null)} className="btn-secondary text-sm flex-1">Kapat</button>
              {/* #77: Adayla sohbet başlat */}
              {selected.candidate?.id && (
                <button
                  onClick={async () => {
                    try {
                      await hotelApi.startConversation({
                        otherPartyId: selected.candidate.id,
                        applicationId: selected.id,
                      })
                      setSelected(null)
                      onOpenMessages?.()
                    } catch (err) {
                      toast.error(extractErrorMessage(err))
                    }
                  }}
                  className="text-sm font-semibold px-4 py-2 rounded-lg text-white"
                  style={{ background: 'linear-gradient(135deg, #b89e6e 0%, #8a7349 100%)' }}>
                  Mesaj Gönder
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmState}
        onClose={() => setConfirmState(null)}
        title={confirmState?.title}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        destructive={confirmState?.destructive}
        loading={actionLoading}
        onConfirm={() => confirmState?.onConfirm?.()}
      />
    </div>
  )
}
