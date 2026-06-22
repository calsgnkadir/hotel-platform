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
    color: '#d4a853',
    bg: 'rgba(212, 168, 83, 0.10)',
    border: 'rgba(212, 168, 83, 0.25)',
  },
  {
    id: 'HELD',
    label: 'Hold',
    sub: 'Aday onayı bekleniyor (24 sa)',
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.25)',
  },
  {
    id: 'ACCEPTED',
    label: 'Kabul',
    sub: 'Çalışmaya hazır',
    color: '#22c55e',
    bg: 'rgba(34, 197, 94, 0.08)',
    border: 'rgba(34, 197, 94, 0.25)',
  },
  {
    id: 'REJECTED',
    label: 'Red',
    sub: 'Süreç kapandı',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.25)',
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

export default function ApplicationsKanban({ applications, onRefresh, onCardClick, onOpenMessages }) {
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
    const label = targetStatus === 'ACCEPTED' ? 'kabul edilecek' : 'red edilecek'
    if (!window.confirm(`${ids.length} başvuru ${label}. Emin misiniz?`)) return
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

    let confirmMsg = ''
    let action = null
    if (targetCol === 'ACCEPTED') {
      confirmMsg = `${app.candidate?.fullName} adayını KABUL etmek istediğine emin misin?\n\nAday bildirim alacak ve çalışmaya başlayabilecek.`
      action = () => hotelApi.reviewApplication(app.id, 'ACCEPTED')
    } else if (targetCol === 'REJECTED') {
      confirmMsg = `${app.candidate?.fullName} adayını REDDETMEK istediğine emin misin?\n\nKararı sonra değiştiremezsin.`
      action = () => hotelApi.reviewApplication(app.id, 'REJECTED')
    } else if (targetCol === 'HELD') {
      if (from !== 'PENDING') {
        toast.error('Sadece bekleyen başvurular hold\'a alınabilir.')
        return
      }
      confirmMsg = `${app.candidate?.fullName} adayını 24 saat HOLD'a almak istediğine emin misin?\n\nAday 24 saatte yanıt vermezse başvuru otomatik düşer.`
      action = () => hotelApi.holdApplication(app.id)
    } else {
      toast.error('Bu yönde geçiş desteklenmiyor.')
      return
    }

    if (!window.confirm(confirmMsg)) return

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
      {/* Dalga H4 — Toplu islem toolbar (secim varsa gozukur) */}
      {selectedIds.size > 0 && (
        <div className="mb-4 sticky top-0 z-10 rounded-xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md"
             style={{
               background: 'rgba(212, 168, 83, 0.18)',
               border: '1px solid rgba(212, 168, 83, 0.45)',
               boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
             }}>
          <div className="flex items-center gap-2">
            <span className="font-bebas text-xl tracking-wider" style={{ color: '#fde9a5' }}>
              {selectedIds.size}
            </span>
            <span className="text-[12px] uppercase tracking-wider font-semibold"
                  style={{ color: 'rgba(229, 231, 235, 0.85)' }}>
              başvuru seçildi
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleBulkAction('ACCEPTED')}
              className="text-[12px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full hover:-translate-y-0.5 transition-all"
              style={{ background: 'rgba(34, 197, 94, 0.20)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.45)' }}>
              Toplu Kabul
            </button>
            <button type="button" onClick={() => handleBulkAction('REJECTED')}
              className="text-[12px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full hover:-translate-y-0.5 transition-all"
              style={{ background: 'rgba(239, 68, 68, 0.20)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.45)' }}>
              Toplu Red
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())}
              className="text-[11px] uppercase tracking-wider px-2 py-1 rounded-full"
              style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Dalga H4 — Tum kolonlari goster (bos olsa bile drag-drop hedefi) */}
      <div className="space-y-5">
        {COLUMNS.map(col => (
          <Column key={col.id} col={col} count={grouped[col.id]?.length || 0}>
            {(grouped[col.id]?.length || 0) === 0 ? (
              <div className="text-[11px] italic py-6 text-center uppercase tracking-widest"
                   style={{ color: 'rgba(229, 231, 235, 0.30)' }}>
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
        <div className="fixed bottom-6 right-6 z-50 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest"
             style={{
               background: 'rgba(212, 168, 83, 0.20)',
               color: '#dde7f3',
               border: '1px solid rgba(212, 168, 83, 0.40)',
             }}>
          Güncelleniyor...
        </div>
      )}
    </DndContext>
  )
}

/* ─────────── Column ─────────── */

function Column({ col, count, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })

  return (
    <div
      ref={setNodeRef}
      className="rounded-2xl flex flex-col min-h-[480px] transition-all"
      style={{
        background: isOver ? `${col.color}18` : col.bg,
        border: isOver ? `1.5px solid ${col.color}` : `1px solid ${col.border}`,
        boxShadow: isOver ? `0 0 24px ${col.color}40` : 'none',
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between border-b"
           style={{ borderColor: col.border }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: col.color }} />
            <span className="font-bebas text-base tracking-wider uppercase" style={{ color: col.color }}>
              {col.label}
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: `${col.color}25`, color: col.color, minWidth: '22px', textAlign: 'center' }}>
              {count}
            </span>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'rgba(229, 231, 235, 0.50)' }}>
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
          // Dalga H4 — Kullanici 'beyaz kart' istedi: koyu lacivert -> krem/beyaz tema
          background: selected ? '#fef3c7' : '#fefefc',
          border: `1px solid ${selected ? '#f59e0b' : 'rgba(15, 23, 38, 0.10)'}`,
          boxShadow: selected
            ? '0 4px 16px rgba(245, 158, 11, 0.30), 0 0 0 3px rgba(245, 158, 11, 0.15)'
            : '0 2px 8px rgba(15, 23, 38, 0.08), 0 1px 2px rgba(15, 23, 38, 0.04)',
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
                  background: selected ? '#f59e0b' : '#ffffff',
                  border: `2px solid ${selected ? '#d97706' : 'rgba(15, 23, 38, 0.25)'}`,
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
                  className="w-full h-full flex items-center justify-center font-bebas text-base text-white"
                  style={{ background: `linear-gradient(135deg, ${accent}, ${accent}80)` }}
                >
                  {initial}
                </div>
              )}
            </ReliabilityRing>
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {/* Aday adi — koyu lacivert text */}
              <div className="text-[14px] font-semibold truncate flex-1 min-w-0"
                   style={{ color: '#0c1726', letterSpacing: '-0.005em' }}>
                {app.candidate?.fullName || 'Anonim'}
              </div>
              <ReliabilityBadge score={app.candidate?.reliabilityScore} />
            </div>
            {/* Ilan basligi — daha belirgin */}
            <div className="text-[12px] font-medium truncate mt-0.5"
                 style={{ color: 'rgba(15, 23, 38, 0.75)' }}>
              {app.listing?.title || 'İlan bilgisi yok'}
            </div>
            {/* Pozisyon + ilçe chip seti — kullanici 'duzgun yazilsin' istedi */}
            {(app.listing?.position || app.candidate?.district) && (
              <div className="flex items-center gap-1.5 mt-1 text-[10.5px]"
                   style={{ color: 'rgba(15, 23, 38, 0.55)' }}>
                {app.listing?.position && <span>{app.listing.position}</span>}
                {app.listing?.position && app.candidate?.district && <span style={{ opacity: 0.4 }}>·</span>}
                {app.candidate?.district && <span>{app.candidate.district}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3 pt-2.5 border-t"
             style={{ borderColor: 'rgba(15, 23, 38, 0.10)' }}>
          <span className="text-[10px] uppercase tracking-wider font-semibold" title={dateTooltip}
                style={{ color: 'rgba(15, 23, 38, 0.55)' }}>
            {date}
          </span>
          <div className="flex items-center gap-1.5">
            {app.conversationId && (
              <button
                onClick={(e) => { e.stopPropagation(); onMessage?.() }}
                onPointerDown={(e) => e.stopPropagation()}
                className="text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all hover:scale-105"
                style={{ background: 'rgba(35, 74, 130, 0.10)', color: '#1e3a5f', border: '1px solid rgba(35, 74, 130, 0.25)' }}
              >
                Mesaj
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClick?.() }}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-all hover:scale-105"
              style={{ background: 'rgba(212, 168, 83, 0.18)', color: '#7c5618', border: '1px solid rgba(212, 168, 83, 0.45)' }}
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
        background: 'rgba(15, 23, 38, 0.95)',
        border: '1.5px solid rgba(212, 168, 83, 0.55)',
        boxShadow: '0 16px 40px rgba(212, 168, 83, 0.30)',
        transform: 'rotate(-2deg)',
        width: '260px',
      }}
    >
      <div className="text-[13px] font-semibold text-white truncate">
        {app.candidate?.fullName || 'Anonim'}
      </div>
      <div className="text-[10px] truncate" style={{ color: 'rgba(229, 231, 235, 0.55)' }}>
        {app.listing?.title || '—'}
      </div>
    </div>
  )
}
