import { useState, useEffect, useRef, useCallback } from 'react'
import * as hotelApi from '../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../api/client'
import cldImg, { ImgSize } from '../lib/cldImg'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const MAX_PHOTOS = 10
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
const MAX_SIZE = 10 * 1024 * 1024  // 10 MB

/**
 * Isletme galerisi editoru.
 * - Coklu yukleme (file input multiple)
 * - @dnd-kit ile masaustu + mobil drag-drop siralama (FAZ 5.5c)
 * - Her foto: kapak yap, sil
 * - Limit: 10 foto, max 10 MB her biri
 */
export default function GalleryEditor() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const fileInputRef = useRef(null)

  const fetchPhotos = useCallback(async () => {
    try {
      const data = await hotelApi.getMyBusinessPhotos()
      setPhotos(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  function validate(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return `'.${ext}' desteklenmiyor. JPG/PNG/WEBP/HEIC kullanın.`
    }
    if (file.size > MAX_SIZE) {
      return `Foto çok büyük (${(file.size / 1024 / 1024).toFixed(1)} MB). Maksimum 10 MB.`
    }
    return null
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    e.target.value = ''

    const remaining = MAX_PHOTOS - photos.length
    if (files.length > remaining) {
      toast.error(`En fazla ${remaining} foto daha ekleyebilirsiniz`)
      return
    }

    setUploading(true)
    let success = 0
    for (const file of files) {
      const err = validate(file)
      if (err) { toast.error(err); continue }
      try {
        const dto = await hotelApi.uploadBusinessPhoto(file)
        setPhotos(prev => [...prev, dto])
        success++
      } catch (e2) {
        toast.error(extractErrorMessage(e2))
      }
    }
    setUploading(false)
    if (success > 0) toast.success(`${success} foto yüklendi`)
  }

  async function handleDelete(photoId) {
    if (!confirm('Bu fotoğraf silinsin mi?')) return
    setBusyId(photoId)
    try {
      await hotelApi.deleteBusinessPhoto(photoId)
      await fetchPhotos()
      toast.success('Foto silindi')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleSetCover(photoId) {
    setBusyId(photoId)
    try {
      await hotelApi.setBusinessCoverPhoto(photoId)
      setPhotos(prev => prev.map(p => ({ ...p, isCover: p.id === photoId })))
      toast.success('Kapak fotoğrafı güncellendi')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  // FAZ 5.5c — @dnd-kit ile siralama
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function handleDragEnd(e) {
    const { active, over } = e
    if (!over || active.id === over.id) return

    const from = photos.findIndex(p => p.id === active.id)
    const to   = photos.findIndex(p => p.id === over.id)
    if (from < 0 || to < 0) return

    const next = arrayMove(photos, from, to)
    setPhotos(next)  // optimistic

    try {
      const updated = await hotelApi.reorderBusinessPhotos(next.map(p => p.id))
      setPhotos(updated)
    } catch (err) {
      toast.error(extractErrorMessage(err))
      fetchPhotos()
    }
  }

  if (loading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-8"><div className="spinner" /></div>
      </div>
    )
  }

  const remaining = MAX_PHOTOS - photos.length

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink-800 uppercase tracking-wider">Galeri</h3>
          <p className="text-xs text-ink-500 mt-0.5">
            {photos.length}/{MAX_PHOTOS} foto · sürükleyerek sırala · kapak yap
          </p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={handleFiles} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            disabled={uploading || remaining <= 0}
            className="text-xs font-semibold px-3 py-2 rounded-lg text-white disabled:opacity-50 bg-brand-700 hover:bg-brand-800 transition-colors">
            {uploading ? 'Yükleniyor...' : remaining > 0 ? '+ Foto Ekle' : 'Limit doldu'}
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="empty-state py-10 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-ink-300 mb-3 mx-auto">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          <p className="text-sm text-ink-500">Galeri boş</p>
          <p className="text-xs text-ink-400 mt-1">İlk foto eklenince otomatik kapak olur</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photos.map(p => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map(p => (
                <SortablePhoto
                  key={p.id}
                  photo={p}
                  busy={busyId === p.id}
                  onSetCover={() => handleSetCover(p.id)}
                  onDelete={() => handleDelete(p.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

/* FAZ 5.5c — sortable foto karti (grid icin) */
function SortablePhoto({ photo, busy, onSetCover, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 20 : 'auto',
    boxShadow: isDragging ? '0 16px 36px rgba(205, 183, 143, 0.32)' : undefined,
  }

  // Butona dokununca drag baslamasin
  const stopDrag = (e) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="relative group aspect-square rounded-lg overflow-hidden border-2 border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-600 cursor-grab active:cursor-grabbing touch-none bg-cream-100 dark:bg-ink-700"
    >
      <img src={cldImg(photo.url, { w: ImgSize.thumb })} alt=""
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy" decoding="async" />

      {photo.isCover && (
        <div className="absolute top-1 left-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md bg-brand-700">
          Kapak
        </div>
      )}

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
        {!photo.isCover && (
          <button
            onPointerDown={stopDrag}
            onClick={onSetCover}
            disabled={busy}
            title="Kapak yap"
            className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-amber-600 shadow disabled:opacity-50">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"
                 className="w-4 h-4 mx-auto">
              <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>
        )}
        <button
          onPointerDown={stopDrag}
          onClick={onDelete}
          disabled={busy}
          title="Sil"
          className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-red-600 shadow disabled:opacity-50">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               strokeWidth={2} stroke="currentColor" className="w-4 h-4 mx-auto">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21q.115.144.116.32V5.79c0 .15-.038.288-.116.43L18 6c0 1.005-.105 1.98-.305 2.92M19.228 5.79a48.108 48.108 0 0 0-3.478-.397m0 0a48.11 48.11 0 0 0-3.478-.397m0 0v3.66M4.772 5.79c.115.144.116.32-.116.43L4.5 6c0 1.005.105 1.98.305 2.92M4.772 5.79a48.11 48.11 0 0 1 3.478-.397m0 0V3.75a2.25 2.25 0 0 1 2.25-2.25h2.85a2.25 2.25 0 0 1 2.25 2.25v1.643" />
          </svg>
        </button>
      </div>
    </div>
  )
}
