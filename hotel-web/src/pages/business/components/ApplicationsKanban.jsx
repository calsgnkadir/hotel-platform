import { useMemo, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  closestCenter,
} from '@dnd-kit/core'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import { celebrate } from '../../../lib/confetti'  // FAZ 5.11
import { useConfirm } from '../../../lib/useConfirm'
import { APPLICATION_STATUS } from '../../../lib/applicationStatus'
import { isFullyNoShow } from '../../../lib/shiftTime'

/*
 * FAZ 5.5a — Basvuru Kanban
 * 4 kolon (PENDING/HELD/ACCEPTED/REJECTED). REVIEWING -> PENDING ile birlestirilir.
 * Drag-drop ile durum degisikligi confirm + backend call.
 */

// Durum dili paketi — kolon adlari sozlukten (isletme bakisi), renksiz duz metin.
const colLabel = (id) => APPLICATION_STATUS[id].business.label
const COLUMNS = [
  { id: 'PENDING',  label: colLabel('PENDING'),  sub: 'İncelenenler dahil' },
  { id: 'HELD',     label: colLabel('HELD'),     sub: 'Yanıt gelmezse düşer' },
  { id: 'ACCEPTED', label: colLabel('ACCEPTED'), sub: 'Çalışmaya hazır' },
  // FAZ C.1 — Yedek havuzu: asil aday gelmezse otomatik cagrilir
  { id: 'STANDBY',  label: colLabel('STANDBY'),  sub: 'Gelmezse otomatik çağrılır' },
  { id: 'REJECTED', label: colLabel('REJECTED'), sub: 'Süreç kapandı' },
]

function statusBucket(s) {
  if (s === 'REVIEWING') return 'PENDING'
  if (s === 'WITHDRAWN') return null
  return s
}

/**
 * FAZ G.2 — Yanıt süresi ısı şeridi rengi.
 * <6sa: yeşil (sorun yok)
 * 6-24sa: amber (dikkat)
 * >24sa: mercan (acil yanıt)
 */
function computeResponseHeat(createdAt) {
  if (!createdAt) return null
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60)
  if (ageHours < 6)  return { color: 'var(--signal-green)', label: ageHours < 1 ? '<1 saat' : `${Math.floor(ageHours)} saat` }
  if (ageHours < 24) return { color: 'var(--signal-amber)', label: `${Math.floor(ageHours)} saat` }
  const days = Math.floor(ageHours / 24)
  return { color: 'var(--signal-coral)', label: `${days} gün${days > 1 ? '' : ''}` }
}

export default function ApplicationsKanban({ applications, statusFilter = 'ALL', onRefresh, onCardClick, onOpenMessages }) {
  const confirm = useConfirm()
  // Dalga H4 — chip filtresine gore hangi kolonlar gosterilecek
  // ALL: tum kolonlar, digerleri: sadece eslesen kolon
  const FILTER_TO_COLUMN_ID = {
    // REVIEWING kanban'da PENDING kolonunda (statusBucket); HELD "Aday onayında" kolonu
    PENDING: 'PENDING', REVIEWING: 'PENDING', HELD: 'HELD', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED',
    STANDBY: 'STANDBY',   // FAZ C.1
  }
  const visibleColumns = statusFilter === 'ALL'
    ? COLUMNS
    : COLUMNS.filter(c => c.id === FILTER_TO_COLUMN_ID[statusFilter])
  const [activeApp, setActiveApp] = useState(null)
  // Dalga H4 — Toplu islem icin secili basvuru id seti
  const [selectedIds, setSelectedIds] = useState(new Set())

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleBulkAction(targetStatus) {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    const isAccept = targetStatus === 'ACCEPTED'
    const ok = await confirm({
      title: isAccept ? 'Toplu kabul işlemi' : 'Toplu ret işlemi',
      description: `${ids.length} başvuru ${isAccept ? 'kabul edilecek' : 'reddedilecek'}. Bu işlem geri alınamaz.`,
      confirmLabel: isAccept ? 'Evet, kabul et' : 'Evet, reddet',
      destructive: targetStatus === 'REJECTED',
    })
    if (!ok) return
    try {
      // Sirayla tek tek update — backend bulk endpoint yoksa.
      // targetStatus 'ACCEPTED'|'REJECTED' → reviewApplication'in decision degeri.
      // (Eski hatali cagri: hotelApi.updateApplicationStatus — boyle bir export yok,
      //  toplu islem her seferinde patliyordu.)
      const hotelApi = await import('../../../api/hotel')
      const results = await Promise.allSettled(
        ids.map(id => hotelApi.reviewApplication(id, targetStatus))
      )
      const toast = (await import('react-hot-toast')).default
      // allSettled hatayi yutar; basarisiz olanlari ayrica bildir (eskiden hepsi "guncellendi" deniyordu).
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed === 0) toast.success(`${ids.length} başvuru güncellendi`)
      else if (failed === ids.length) toast.error('Toplu işlem başarısız')
      else toast.error(`${ids.length - failed} başvuru güncellendi, ${failed} başvuru güncellenemedi`)
      setSelectedIds(new Set())
      onRefresh?.()
    } catch {
      const toast = (await import('react-hot-toast')).default
      toast.error('Toplu işlem başarısız')
    }
  }
  const [busy, setBusy] = useState(false)

  const grouped = useMemo(() => {
    const map = Object.fromEntries(COLUMNS.map(c => [c.id, []]))
    applications.forEach(a => {
      const b = statusBucket(a.status)
      // Tum vardiyalarina gelmeyen aday kadroda sayilmaz; kabul kolonunda gosterilmez
      if (b === 'ACCEPTED' && isFullyNoShow(a)) return
      if (b && map[b]) map[b].push(a)
    })
    return map
  }, [applications])

  // FAZ C.1 — TouchSensor: mobil drag desteği (delay 200ms scroll ile çakışmayı önler)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  async function transition(app, targetCol) {
    const from = statusBucket(app.status)
    if (from === targetCol) return
    if (busy) return

    let confirmOpts = null
    let action = null
    const candidateName = app.candidate?.fullName || 'Bu aday'
    if (targetCol === 'ACCEPTED') {
      confirmOpts = {
        title: `${candidateName} kabul edilsin`,
        description: 'Aday bildirim alacak ve çalışmaya başlayabilecek. Karar bağlayıcıdır.',
        confirmLabel: 'Evet, kabul et',
      }
      action = () => hotelApi.reviewApplication(app.id, 'ACCEPTED')
    } else if (targetCol === 'REJECTED') {
      confirmOpts = {
        title: `${candidateName} reddedilsin`,
        description: 'Aday bildirim alacak. Kararı sonra değiştiremezsin.',
        confirmLabel: 'Evet, reddet',
        destructive: true,
      }
      action = () => hotelApi.reviewApplication(app.id, 'REJECTED')
    } else if (targetCol === 'HELD') {
      if (from !== 'PENDING') {
        toast.error('Sadece bekleyen başvurular beklemeye alınabilir.')
        return
      }
      confirmOpts = {
        title: `${candidateName} 24 saat beklemeye alınsın`,
        description: 'Aday 24 saat içinde yanıt vermezse başvuru otomatik düşer.',
        confirmLabel: 'Evet, beklemeye al',
      }
      action = () => hotelApi.holdApplication(app.id)
    } else if (targetCol === 'STANDBY') {
      // FAZ C.1 — Yedek havuzuna al
      if (from !== 'PENDING' && from !== 'HELD') {
        toast.error('Sadece bekleyen veya beklemedeki başvurular yedeğe alınabilir.')
        return
      }
      confirmOpts = {
        title: `${candidateName} yedek listesine alınsın`,
        description: 'Asıl aday gelmezse bu adaya otomatik acil teklif gider. Aday bilgilendirilir.',
        confirmLabel: 'Evet, yedeğe al',
      }
      action = () => hotelApi.markStandby(app.id)
    } else if (targetCol === 'PENDING' && from === 'STANDBY') {
      // FAZ C.1 — Yedeklikten geri al
      confirmOpts = {
        title: `${candidateName} yedeklikten çıkarılsın`,
        description: 'Başvuru yeniden değerlendirmeye döner.',
        confirmLabel: 'Evet, çıkar',
      }
      action = () => hotelApi.removeStandby(app.id)
    } else {
      toast.error('Bu yönde geçiş desteklenmiyor.')
      return
    }

    const ok = await confirm(confirmOpts)
    if (!ok) return

    setBusy(true)
    try {
      await action()
      toast.success('Durum güncellendi')
      if (targetCol === 'ACCEPTED') celebrate()  // FAZ 5.11 — kabulde kutla
      onRefresh?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function handleDragStart(e) {
    const app = applications.find(a => String(a.id) === String(e.active.id))
    setActiveApp(app || null)
  }

  function handleDragEnd(e) {
    setActiveApp(null)
    const { active, over } = e
    if (!over) return
    const app = applications.find(a => String(a.id) === String(active.id))
    if (!app) return
    transition(app, String(over.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Toplu islem toolbar — .tier-featured: sayfada sadece secim varken beliriyor,
          FEATURED tier (calls action, deserves attention). */}
      {selectedIds.size > 0 && (
        <div className="tier-featured mb-4 sticky top-0 z-10 px-4 py-3 flex flex-wrap items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="numeral-hero" style={{ fontSize: '22px', color: 'var(--ah-brand)' }}>
              {selectedIds.size}
            </span>
            <span className="type-meta" style={{ color: 'var(--ah-ink-2)' }}>
              başvuru seçildi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleBulkAction('ACCEPTED')}
              className="btn-primary !w-auto md:!min-h-[34px] !px-3 !text-[13px]">
              Toplu kabul
            </button>
            <button type="button" onClick={() => handleBulkAction('REJECTED')}
              className="btn-danger md:!min-h-[34px] !px-3 !text-[13px]">
              Toplu ret
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="btn-ghost md:!min-h-[34px] !px-2 !text-[13px]">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Dalga H4 — chip filtresine gore kolonlari goster.
          Mobil/tablet: kolonlar alt alta (dikey akis korunur).
          lg+: birden fazla kolon varsa yan yana pano; sigmazsa yatay kaydirma.
          Tek kolon (chip filtresi) tam genislikte kart izgarasi olarak kalir. */}
      {(() => {
        const board = visibleColumns.length > 1
        return (
          <div
            className={board
              ? 'space-y-4 lg:space-y-0 lg:flex lg:items-stretch lg:gap-3 lg:overflow-x-auto lg:pb-2 lg:snap-x'
              : 'space-y-4'}
            role="list"
            aria-label="Başvuru panosu"
          >
            {visibleColumns.map(col => (
              <Column key={col.id} col={col} count={grouped[col.id]?.length || 0} board={board}>
                {(grouped[col.id]?.length || 0) === 0 ? (
                  <div className="type-caption text-center py-4 lg:py-8 rounded-lg"
                       style={{ border: '1px dashed var(--ah-line-2)', color: 'var(--ah-ink-3)' }}>
                    Bu sütunda başvuru yok
                  </div>
                ) : (
                  <div className={board
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5'}>
                    {grouped[col.id].map(app => (
                      <Card
                        key={app.id}
                        app={app}
                        selected={selectedIds.has(app.id)}
                        onToggleSelect={() => toggleSelect(app.id)}
                        onClick={() => onCardClick?.(app)}
                        onMessage={() => onOpenMessages?.(app.conversationId)}
                      />
                    ))}
                  </div>
                )}
              </Column>
            ))}
          </div>
        )
      })()}

      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeApp ? <CardSilhouette app={activeApp} /> : null}
      </DragOverlay>

      {busy && (
        <div className="fixed bottom-6 right-6 z-50 tier-featured px-4 py-2 type-meta" role="status"
             style={{ borderRadius: '999px', color: 'var(--ah-ink)' }}>
          Güncelleniyor...
        </div>
      )}
    </DndContext>
  )
}

/* ─────────── Column ─────────── */

function Column({ col, count, children, board = false }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  // Durum dili paketi — kolon basligi renksiz duz metin + sayi; birakma aninda
  // yalniz tier-featured (grafit cerceve), renkli glow yok.
  // Pano duzeninde (lg+) sabit-esnek genislik: 5 kolon 1440'ta sigar, daha dar
  // ekranda yatay kaydirilir. Mobilde min-yukseklik yok (bos kolon alan kaplamasin).
  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-label={`${col.label}: ${count} başvuru`}
      className={`flex flex-col transition-all ${isOver ? 'tier-featured' : 'tier-raised'}
                  ${board ? 'lg:flex-1 lg:min-w-[232px] lg:max-w-[340px] lg:snap-start lg:min-h-[420px]' : ''}`}
    >
      <header className="px-3.5 py-3 flex items-start justify-between gap-2 border-b border-hairline">
        <div className="min-w-0">
          <h3 className="type-subhead truncate" style={{ color: 'var(--ah-ink)' }}>{col.label}</h3>
          <div className="type-caption mt-0.5 truncate" title={col.sub}>{col.sub}</div>
        </div>
        <span className="badge badge-neutral type-num flex-shrink-0" aria-hidden="true">{count}</span>
      </header>
      <div className="p-2.5 flex-1">
        {children}
      </div>
    </section>
  )
}

/* ─────────── Card (draggable) ─────────── */

function Card({ app, selected, onToggleSelect, onClick, onMessage }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id })

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.3 : 1,
  }

  const initial = app.candidate?.fullName?.charAt(0)?.toUpperCase() || '?'
  // Dalga H4 — Relative time + tam tarih tooltip
  const fullDate = app.createdAt ? new Date(app.createdAt) : null
  function relativeDate(d) {
    if (!d) return ''
    const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
    if (days === 0) return 'Bugün'
    if (days === 1) return 'Dün'
    if (days < 7) return `${days} gün önce`
    if (days < 30) return `${Math.floor(days / 7)} hafta önce`
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
  }
  const date = relativeDate(fullDate)
  const dateTooltip = fullDate?.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''

  // FAZ G.2 — Yanit suresi isi seridi: PENDING ise basvurudan beri gecen sure
  // signal-green (<6sa) -> signal-amber (6-24sa) -> signal-coral (>24sa).
  // Boylece isletmeyi "hizli yanit ver" davranisina UI uzerinden nudge'larız.
  const heatColor = app.status === 'PENDING' || app.status === 'REVIEWING'
    ? computeResponseHeat(app.createdAt)
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl cursor-grab active:cursor-grabbing transition-all hover:-translate-y-0.5 group"
      {...attributes}
      {...listeners}
    >
      <div
        className="rounded-xl p-2.5"
        style={{
          // FAZ E — kart acik zeminde; kenarlik/golge de acik tokenlardan.
          // (Eskiden rgba(255,255,255,...) idi: beyaz kartta gorunmuyordu.)
          background: selected ? 'var(--ah-brand-soft)' : 'var(--ah-card)',
          border: `1px solid ${selected ? 'var(--ah-brand)' : 'var(--ah-line)'}`,
          boxShadow: selected ? 'var(--elev-2)' : 'var(--elev-1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {heatColor && (
          <div
            role="img"
            aria-label={`Yanıt bekleyen süre: ${heatColor.label}`}
            title={`Yanıtlanmadı (${heatColor.label})`}
            style={{
              position: 'absolute',
              top: 8,
              bottom: 8,
              left: 0,
              width: 3,
              borderRadius: 2,
              background: heatColor.color,
            }}
          />
        )}

        {/* Dalga H4 — Checkbox sag ust kose */}
        <button type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={selected ? 'Seç kaldır' : 'Seç'}
                title={selected ? 'Seç kaldır' : 'Toplu işlem için seç'}
                className="absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center transition-all"
                style={{
                  background: selected ? 'var(--ah-brand)' : 'var(--ah-card)',
                  border: `2px solid ${selected ? 'var(--ah-brand)' : 'var(--ah-line-2)'}`,
                  color: '#ffffff',
                }}>
          {selected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Kompakt kart (iki satir): ust satir isim + tarih, alt satir ilan + aksiyonlar.
            Eskiden tarih/aksiyonlar ayri bir alt seritteydi; kart ~%25 kisaldi.
            Guvenilirlik halkasi/rozeti KALDIRILDI (kullanici istegi). */}
        <div className="flex items-center gap-2.5">
          <a
            href={app.candidate?.id ? `/p/candidate/${app.candidate.id}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            title="Aday profilini gör"
            aria-label={`${app.candidate?.fullName || 'Aday'} profilini yeni sekmede aç`}
            className="flex-shrink-0 rounded-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ah-brand)]"
            style={{ width: 34, height: 34 }}
          >
            {app.candidate?.avatarUrl ? (
              <img
                src={cldImg(app.candidate.avatarUrl, { w: ImgSize.avatarSm })}
                alt=""
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />
            ) : (
              // Fotograf yoksa: sessiz yer tutucu (marka-soft disk + koyu harf).
              <div className="w-full h-full grid place-items-center text-[13px] font-bold"
                   style={{ background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)',
                            border: '1px solid var(--ah-line)' }}>
                {initial}
              </div>
            )}
          </a>

          <div className="min-w-0 flex-1">
            {/* Ust satir: isim + tarih (sag ustteki secim kutusuna yer birakir) */}
            <div className="flex items-baseline justify-between gap-2 pr-6">
              <span className="text-[13.5px] font-semibold truncate"
                    style={{ color: 'var(--ah-ink)', letterSpacing: '-0.005em' }}>
                {app.candidate?.fullName || 'Anonim'}
              </span>
              {/* ink-4 beyaz zeminde AA alti; ink-3 = 4.7:1. */}
              <span className="text-[12px] flex-shrink-0 whitespace-nowrap type-num" title={dateTooltip}
                    style={{ color: 'var(--ah-ink-3)', fontWeight: 500 }}>
                {date}
              </span>
            </div>
            {/* Alt satir: ilan + aksiyonlar */}
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-[12px] truncate" style={{ color: 'var(--ah-ink-3)' }}>
                {app.listing?.title || 'İlan bilgisi yok'}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {app.conversationId && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onMessage?.() }}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={`${app.candidate?.fullName || 'Aday'} ile mesajlaş`}
                    className="text-[12px] font-medium px-2 min-h-[26px] rounded-md transition-colors hover:bg-[var(--ah-band)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ah-brand)]"
                    style={{ background: 'var(--ah-card)', color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line-2)' }}
                  >
                    Mesaj
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onClick?.() }}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label={`${app.candidate?.fullName || 'Aday'} başvurusunu aç`}
                  className="text-[12px] font-semibold px-2.5 min-h-[26px] rounded-md transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ah-brand)]"
                  style={{ background: 'var(--ah-brand)', color: '#fff', border: '1px solid var(--ah-brand)' }}
                >
                  Aç
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────── DragOverlay siluet ─────────── */
function CardSilhouette({ app }) {
  return (
    <div
      className="rounded-xl p-3 pointer-events-none"
      style={{
        background: 'var(--ah-card)',
        border: '1.5px solid var(--ah-brand)',
        boxShadow: 'var(--elev-3)',
        transform: 'rotate(-2deg)',
        width: '260px',
      }}
    >
      <div className="type-body font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>
        {app.candidate?.fullName || 'Anonim'}
      </div>
      <div className="type-caption truncate" style={{ color: 'var(--ah-ink-3)' }}>
        {app.listing?.title || '—'}
      </div>
    </div>
  )
}
