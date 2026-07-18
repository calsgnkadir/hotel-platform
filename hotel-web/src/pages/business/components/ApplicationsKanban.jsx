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
import ReliabilityBadge from '../../../components/ReliabilityBadge'
import ReliabilityRing from '../../../components/ReliabilityRing'
import { useConfirm } from '../../../lib/useConfirm'

/*
 * FAZ 5.5a — Basvuru Kanban
 * 4 kolon (PENDING/HELD/ACCEPTED/REJECTED). REVIEWING -> PENDING ile birlestirilir.
 * Drag-drop ile durum degisikligi confirm + backend call.
 */

const COLUMNS = [
  {
    id: 'PENDING',
    label: 'Bekleyen',
    sub: 'Yeni başvurular + incelemede',
    color: '#0f766e',
    bg: 'rgba(15, 118, 110, 0.08)',
    border: 'rgba(15, 118, 110, 0.18)',
  },
  {
    id: 'HELD',
    label: 'Hold',
    sub: 'Aday onayı bekleniyor (24 sa)',
    color: '#c8923a',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  {
    id: 'ACCEPTED',
    label: 'Kabul',
    sub: 'Çalışmaya hazır',
    color: '#7a9f7a',
    bg: 'rgba(122, 159, 122, 0.08)',
    border: 'rgba(122, 159, 122, 0.22)',
  },
  {
    id: 'REJECTED',
    label: 'Red',
    sub: 'Süreç kapandı',
    color: '#b46a55',
    bg: 'rgba(180, 106, 85, 0.08)',
    border: 'rgba(180, 106, 85, 0.22)',
  },
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
    PENDING: 'PENDING', REVIEWING: 'REVIEWING', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED',
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
    const label = targetStatus === 'ACCEPTED' ? 'kabul' : 'red'
    const ok = await confirm({
      title: `Toplu ${label} işlemi`,
      description: `${ids.length} başvuru ${label} edilecek. Bu işlem geri alınamaz.`,
      confirmLabel: `Evet, ${label} et`,
      destructive: targetStatus === 'REJECTED',
    })
    if (!ok) return
    try {
      // Sirayla tek tek update — backend bulk endpoint yoksa
      const hotelApi = await import('../../../api/hotel')
      await Promise.allSettled(
        ids.map(id => hotelApi.updateApplicationStatus(id, targetStatus))
      )
      const toast = (await import('react-hot-toast')).default
      toast.success(`${ids.length} başvuru güncellendi`)
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
        toast.error('Sadece bekleyen başvurular hold\'a alınabilir.')
        return
      }
      confirmOpts = {
        title: `${candidateName} 24 saat HOLD'a alınsın`,
        description: 'Aday 24 saat içinde yanıt vermezse başvuru otomatik düşer.',
        confirmLabel: 'Evet, HOLD\'a al',
      }
      action = () => hotelApi.holdApplication(app.id)
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
        <div className="tier-featured mb-4 sticky top-0 z-10 px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="numeral-hero text-champagne-300" style={{ fontSize: '22px' }}>
              {selectedIds.size}
            </span>
            <span className="type-overline text-ivory-200">
              başvuru seçildi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleBulkAction('ACCEPTED')}
              className="type-overline px-3 py-1.5 rounded-full hover:-translate-y-0.5 transition-all"
              style={{ background: 'rgba(122, 159, 122, 0.18)', color: '#a8c8a8', border: '1px solid rgba(122, 159, 122, 0.40)' }}>
              Toplu Kabul
            </button>
            <button type="button" onClick={() => handleBulkAction('REJECTED')}
              className="type-overline px-3 py-1.5 rounded-full hover:-translate-y-0.5 transition-all"
              style={{ background: 'rgba(180, 106, 85, 0.18)', color: '#d39481', border: '1px solid rgba(180, 106, 85, 0.40)' }}>
              Toplu Red
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="type-overline px-2 py-1 rounded-full text-ivory-700 hover:text-ivory-400">
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Dalga H4 — chip filtresine gore kolonlari goster */}
      <div className="space-y-5">
        {visibleColumns.map(col => (
          <Column key={col.id} col={col} count={grouped[col.id]?.length || 0}>
            {(grouped[col.id]?.length || 0) === 0 ? (
              <div className="type-overline italic py-6 text-center">
                Bu kolonda başvuru yok
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {grouped[col.id].map(app => (
                  <Card
                    key={app.id}
                    app={app}
                    accent={col.color}
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

      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeApp ? <CardSilhouette app={activeApp} /> : null}
      </DragOverlay>

      {busy && (
        <div className="fixed bottom-6 right-6 z-50 tier-featured px-4 py-2 type-overline text-ivory-200"
             style={{ borderRadius: '999px' }}>
          Güncelleniyor...
        </div>
      )}
    </DndContext>
  )
}

/* ─────────── Column ─────────── */

function Column({ col, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  // Column bg neutral (graphite.700) — status color yalniz header chip + drop-over rim'de.
  // Boylece 4 kolon = 4 status renkli blok yerine 1 tier + accent rail hierarchy.
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[480px] transition-all ${isOver ? 'tier-featured' : 'tier-raised'}`}
      style={{
        borderColor: isOver ? col.color : undefined,
        boxShadow: isOver ? `0 0 24px ${col.color}55, inset 0 1px 0 rgba(15, 118, 110,0.12)` : undefined,
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-hairline">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
            <span className="type-overline" style={{ color: col.color, fontSize: '11px' }}>
              {col.label}
            </span>
            <span className="type-overline px-1.5 py-0.5 rounded-full tabular-nums"
                  style={{ background: `${col.color}22`, color: col.color, minWidth: '22px', textAlign: 'center' }}>
              {count}
            </span>
          </div>
          <div className="type-caption mt-0.5">
            {col.sub}
          </div>
        </div>
      </div>
      <div className="p-2.5 space-y-2 overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  )
}

/* ─────────── Card (draggable) ─────────── */

function Card({ app, accent, selected, onToggleSelect, onClick, onMessage }) {
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
        className="rounded-xl p-3"
        style={{
          // Beyaz kart korundu (dark kolon uzerinde okunabilirlik icin). Selected
          // state artik champagne (marka accent), amber degil.
          background: selected ? '#f9f1e0' : '#fefefc',
          border: `1px solid ${selected ? '#0f766e' : 'rgba(13, 11, 9, 0.10)'}`,
          boxShadow: selected
            ? '0 6px 18px rgba(15, 118, 110, 0.35), 0 0 0 3px rgba(15, 118, 110, 0.18)'
            : '0 2px 8px rgba(13, 11, 9, 0.08), 0 1px 2px rgba(13, 11, 9, 0.04)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {heatColor && (
          <div
            aria-label={`Yanit bekleyen sure: ${heatColor.label}`}
            title={`Yanitlanmadi (${heatColor.label})`}
            style={{
              position: 'absolute',
              top: 8,
              bottom: 8,
              left: 0,
              width: 3,
              borderRadius: 2,
              background: heatColor.color,
              boxShadow: `0 0 8px ${heatColor.color}66`,
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
                  background: selected ? '#0f766e' : '#ffffff',
                  border: `2px solid ${selected ? '#a08654' : 'rgba(13, 11, 9, 0.25)'}`,
                  color: '#ffffff',
                }}>
          {selected && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <div className="flex items-start gap-2.5 pr-7">
          {/* FAZ G.4: avatar etrafında reliability ring (Apple Watch tarzı)
              Dalga G3: avatar tiklayinca public profil sayfasini ac */}
          <a
            href={app.candidate?.id ? `/p/candidate/${app.candidate.id}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            title="Aday profilini gor"
            className="cursor-pointer hover:scale-105 transition-transform"
          >
            <ReliabilityRing score={app.candidate?.reliabilityScore} size={42} stroke={3}>
              {app.candidate?.avatarUrl ? (
                <img
                  src={cldImg(app.candidate.avatarUrl, { w: ImgSize.avatarSm })}
                  alt={app.candidate.fullName}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-base text-white"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}80)` }}
                >
                  {initial}
                </div>
              )}
            </ReliabilityRing>
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {/* Aday adi — koyu graphite text (beyaz kart uzerinde) */}
              <div className="type-body font-semibold truncate flex-1 min-w-0"
                   style={{ color: '#ffffff', letterSpacing: '-0.005em' }}>
                {app.candidate?.fullName || 'Anonim'}
              </div>
              <ReliabilityBadge score={app.candidate?.reliabilityScore} />
            </div>
            {/* Ilan basligi — daha belirgin */}
            <div className="type-caption font-medium truncate mt-0.5"
                 style={{ color: 'rgba(255, 255, 255, 0.78)' }}>
              {app.listing?.title || 'İlan bilgisi yok'}
            </div>
            {/* Pozisyon + ilçe chip seti */}
            {(app.listing?.position || app.candidate?.district) && (
              <div className="flex items-center gap-1.5 mt-1 type-caption"
                   style={{ color: 'rgba(255, 255, 255, 0.55)', fontSize: '10.5px' }}>
                {app.listing?.position && <span>{app.listing.position}</span>}
                {app.listing?.position && app.candidate?.district && <span style={{ opacity: 0.4 }}>·</span>}
                {app.candidate?.district && <span>{app.candidate.district}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t"
             style={{ borderColor: 'rgba(13, 11, 9, 0.10)' }}>
          <span className="type-overline" title={dateTooltip}
                style={{ color: 'rgba(255, 255, 255, 0.55)' }}>
            {date}
          </span>
          <div className="flex items-center gap-1.5">
            {app.conversationId && (
              <button
                onClick={(e) => { e.stopPropagation(); onMessage?.() }}
                onPointerDown={(e) => e.stopPropagation()}
                className="type-overline px-2.5 py-1 rounded-md transition-all hover:scale-105"
                style={{ background: 'rgba(15, 118, 110, 0.10)', color: '#ffffff', border: '1px solid rgba(15, 118, 110, 0.22)' }}
              >
                Mesaj
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClick?.() }}
              onPointerDown={(e) => e.stopPropagation()}
              className="type-overline px-2.5 py-1 rounded-md transition-all hover:scale-105"
              style={{ background: 'rgba(15, 118, 110, 0.18)', color: '#7c5618', border: '1px solid rgba(15, 118, 110, 0.45)' }}
            >
              Aç
            </button>
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
        background: 'rgba(13, 11, 9, 0.95)',
        border: '1.5px solid rgba(15, 118, 110, 0.45)',
        boxShadow: '0 16px 40px rgba(15, 118, 110, 0.22)',
        transform: 'rotate(-2deg)',
        width: '260px',
      }}
    >
      <div className="type-body font-semibold text-white truncate">
        {app.candidate?.fullName || 'Anonim'}
      </div>
      <div className="type-caption truncate" style={{ color: 'var(--text-faint)' }}>
        {app.listing?.title || '—'}
      </div>
    </div>
  )
}
