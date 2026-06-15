/**
 * FAZ 1/#54 — Avatar Drag-Drop + Crop modal.
 *
 * Akış:
 *  1. Drop zone'a foto bırak (veya tıkla, file picker)
 *  2. Modal açılır: foto + crop overlay (kare 1:1)
 *  3. Zoom slider + drag ile crop
 *  4. 'Kullan' → canvas üzerinde crop yap → blob → onConfirm(blob)
 *
 * Parent: onConfirm(file) → mevcut upload API'sini çağırır.
 */
import { useRef, useState, useCallback } from 'react'
import useFocusTrap from '../lib/useFocusTrap'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import toast from 'react-hot-toast'

const MAX_SIZE_MB = 5
const ACCEPTED = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

function ext(name) {
  return (name?.split('.').pop() || '').toLowerCase()
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Foto okunamadı'))
    r.readAsDataURL(file)
  })
}

function initialCrop(imgWidth, imgHeight) {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, 1, imgWidth, imgHeight),
    imgWidth, imgHeight
  )
}

/**
 * Crop'lanmış image'i canvas'a basıp Blob döndürür.
 * Boyut: 400x400 (kare).
 */
async function canvasToBlob(image, crop) {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  const SIZE = 400
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0, 0, SIZE, SIZE
  )
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Canvas → blob başarısız')),
      'image/jpeg', 0.92
    )
  })
}

export default function AvatarCropModal({ open, onClose, onConfirm }) {
  const [dragOver, setDragOver] = useState(false)
  const [src, setSrc] = useState(null)
  const [crop, setCrop] = useState(null)
  const [completedCrop, setCompletedCrop] = useState(null)
  const [saving, setSaving] = useState(false)
  const imgRef = useRef(null)
  const fileInputRef = useRef(null)
  const [originalName, setOriginalName] = useState('avatar.jpg')

  function reset() {
    setSrc(null)
    setCrop(null)
    setCompletedCrop(null)
  }

  async function handleFiles(files) {
    const file = files?.[0]
    if (!file) return
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`Foto çok büyük (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_SIZE_MB} MB.`)
      return
    }
    const e = ext(file.name)
    if (!ACCEPTED.includes(e)) {
      toast.error(`'.${e}' desteklenmiyor. JPG/PNG/WEBP/HEIC kullan.`)
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setSrc(dataUrl)
      setOriginalName(file.name)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const onImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight, width, height } = e.currentTarget
    const c = initialCrop(width, height)
    setCrop(c)
    setCompletedCrop({
      x: (width  * c.x) / 100,
      y: (height * c.y) / 100,
      width:  (width  * c.width) / 100,
      height: (height * c.height) / 100,
    })
  }, [])

  async function handleConfirm() {
    if (!imgRef.current || !completedCrop) {
      toast.error('Önce bir foto seç')
      return
    }
    setSaving(true)
    try {
      const blob = await canvasToBlob(imgRef.current, completedCrop)
      const file = new File([blob], originalName.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' })
      await onConfirm(file)
      reset()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Crop başarısız')
    } finally {
      setSaving(false)
    }
  }

  const dialogRef = useRef(null)
  useFocusTrap(dialogRef, open, () => { reset(); onClose() })

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4"
         style={{ background: 'rgba(15, 8, 35, 0.75)', backdropFilter: 'blur(6px)' }}
         onClick={() => { reset(); onClose() }}>
      <div ref={dialogRef}
           role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title"
           className="card max-w-lg w-full p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-cream-200 dark:border-cream-300">
          <h3 id="avatar-crop-title" className="font-bold text-base" style={{ color: '#faf5ff' }}>Profil Fotoğrafı</h3>
          <p className="text-xs mt-0.5" style={{ color: '#c4b5fd' }}>
            Foto yükle → kare bölgeyi sürükle → kullan.
          </p>
        </div>

        {/* Drop zone veya crop */}
        <div className="p-5">
          {!src ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-2xl text-center py-12 px-4 transition-all"
              style={{
                background: dragOver ? 'rgba(168,85,247,0.20)' : 'rgba(168,85,247,0.08)',
                border: `2px dashed ${dragOver ? '#d946ef' : 'rgba(168,85,247,0.40)'}`,
              }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={1.6} stroke="currentColor"
                   className="w-12 h-12 mx-auto mb-3" style={{ color: '#d8b4fe' }}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <p className="font-semibold text-sm" style={{ color: '#faf5ff' }}>
                Foto buraya sürükle veya tıkla
              </p>
              <p className="text-xs mt-1" style={{ color: '#c4b5fd' }}>
                JPG/PNG/WEBP/HEIC · Maks {MAX_SIZE_MB} MB · Kare olarak kaydedilir
              </p>
              <input ref={fileInputRef} type="file"
                     accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                     className="hidden"
                     onChange={(e) => handleFiles(e.target.files)} />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                keepSelection
                style={{ maxHeight: '50vh' }}>
                <img ref={imgRef} src={src} alt="Crop"
                     onLoad={onImageLoad}
                     style={{ maxHeight: '50vh', maxWidth: '100%' }} />
              </ReactCrop>
              <button type="button" onClick={reset}
                className="mt-3 text-xs font-medium hover:underline"
                style={{ color: '#c4b5fd' }}>
                Başka foto seç
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-cream-200 dark:border-cream-300 flex gap-2 justify-end">
          <button type="button" onClick={() => { reset(); onClose() }}
            className="px-4 py-2 text-sm font-semibold rounded-lg"
            style={{ background: 'rgba(255,255,255,0.10)', color: '#fff', border: '1px solid rgba(216,180,254,0.30)' }}>
            İptal
          </button>
          <button type="button" onClick={handleConfirm}
            disabled={!src || saving}
            className="px-5 py-2 text-sm font-bold rounded-lg disabled:opacity-50 transition-all hover:-translate-y-0.5"
            style={{ background: 'linear-gradient(135deg, #d946ef, #a855f7)', color: '#fff', boxShadow: '0 4px 16px rgba(168,85,247,0.40)' }}>
            {saving ? 'Yükleniyor...' : 'Kullan'}
          </button>
        </div>
      </div>
    </div>
  )
}
