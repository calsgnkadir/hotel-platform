import { useState, useEffect, useRef, useCallback } from 'react'
import * as hotelApi from '../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../api/client'

const MAX_PHOTOS = 10
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']
const MAX_SIZE = 10 * 1024 * 1024  // 10 MB

/**
 * İşletme galerisi editörü.
 * - Çoklu yükleme (file input multiple)
 * - HTML5 drag-drop ile sıralama
 * - Her foto: ⭐ kapak yap, 🗑️ sil
 * - Limit: 10 foto, max 10 MB her biri
 */
export default function GalleryEditor() {
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const fileInputRef = useRef(null)
  const dragId = useRef(null)

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
    e.target.value = ''  // tekrar aynı dosyayı seçebilsin

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
      await fetchPhotos()  // kapak/sıralama otomatik güncellenmiş olabilir
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

  // ── Drag-drop sıralama ──
  function onDragStart(id) { dragId.current = id }
  function onDragOver(e) { e.preventDefault() }

  async function onDrop(targetId) {
    const sourceId = dragId.current
    dragId.current = null
    if (!sourceId || sourceId === targetId) return

    const srcIdx = photos.findIndex(p => p.id === sourceId)
    const tgtIdx = photos.findIndex(p => p.id === targetId)
    if (srcIdx < 0 || tgtIdx < 0) return

    const next = photos.slice()
    const [moved] = next.splice(srcIdx, 1)
    next.splice(tgtIdx, 0, moved)
    setPhotos(next)  // optimistic UI

    try {
      const updated = await hotelApi.reorderBusinessPhotos(next.map(p => p.id))
      setPhotos(updated)
    } catch (err) {
      toast.error(extractErrorMessage(err))
      fetchPhotos()  // hata durumunda sunucudan tekrar al
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
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Galeri</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {photos.length}/{MAX_PHOTOS} foto · sürükleyerek sırala · ⭐ kapak yap
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
               strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-300 mb-3 mx-auto">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          <p className="text-sm text-slate-500">Galeri boş</p>
          <p className="text-xs text-slate-400 mt-1">İlk foto eklenince otomatik kapak olur</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map(p => (
            <div key={p.id}
              draggable
              onDragStart={() => onDragStart(p.id)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(p.id)}
              className="relative group aspect-square rounded-lg overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-600 cursor-move bg-slate-100 dark:bg-slate-800">
              <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />

              {/* Kapak badge'i */}
              {p.isCover && (
                <div className="absolute top-1 left-1 text-[10px] font-bold text-white px-1.5 py-0.5 rounded-md bg-brand-700">
                  ⭐ Kapak
                </div>
              )}

              {/* Hover action overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {!p.isCover && (
                  <button onClick={() => handleSetCover(p.id)} disabled={busyId === p.id}
                    title="Kapak yap"
                    className="w-9 h-9 rounded-full bg-white/95 hover:bg-white text-amber-600 text-base shadow disabled:opacity-50">
                    ⭐
                  </button>
                )}
                <button onClick={() => handleDelete(p.id)} disabled={busyId === p.id}
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
          ))}
        </div>
      )}
    </div>
  )
}
