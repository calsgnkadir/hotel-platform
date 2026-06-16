import { useState } from 'react'
import toast from 'react-hot-toast'
import cldImg, { ImgSize } from '../../../lib/cldImg'

/**
 * İşletme logosu ve galeri yönetimi (logo upload/delete).
 * Galeri ayrı bir kart (GalleryEditor component'i) ile yönetilir.
 */
export default function MediaBlock({
  logoUrl, logoVersion, photos,
  onLogoUpload, onLogoDelete, onPhotoUpload, onPhotoDelete,
}) {
  const [logoUploading, setLogoUploading] = useState(false)
  const [photoUploading, setPhotoUploading] = useState(false)
  const MAX_PHOTOS = 10
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024  // 10 MB (backend ile aynı)
  const ALLOWED_IMG_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']

  function validateImage(file) {
    if (file.size > MAX_IMAGE_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(1)
      toast.error(`Görsel çok büyük (${mb} MB). Maksimum 10 MB.`)
      return false
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED_IMG_EXT.includes(ext)) {
      toast.error(`'.${ext}' formatı desteklenmiyor. Kabul edilenler: JPG, PNG, WEBP, HEIC`)
      return false
    }
    return true
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!validateImage(file)) { e.target.value = ''; return }
    setLogoUploading(true)
    try { await onLogoUpload(file) }
    finally { setLogoUploading(false); e.target.value = '' }
  }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!validateImage(file)) { e.target.value = ''; return }
    setPhotoUploading(true)
    try { await onPhotoUpload(file) }
    finally { setPhotoUploading(false); e.target.value = '' }
  }

  return (
    <div className="card p-5 space-y-5">
      <h3 className="font-bebas text-base tracking-[0.2em] uppercase pb-2 border-b"
          style={{ color: '#fde9a5', borderColor: 'rgba(212, 168, 83, 0.18)' }}>
        Görseller
      </h3>

      {/* Logo */}
      <div>
        <label className="label">Logo</label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden flex-shrink-0"
               style={{ background: 'rgba(21, 36, 61, 0.55)', borderColor: 'rgba(212, 168, 83, 0.25)' }}>
            {logoUrl ? (
              <img src={`${cldImg(logoUrl, { w: ImgSize.avatarLg })}?v=${logoVersion}`} alt="Logo"
                   loading="lazy" decoding="async"
                   className="w-full h-full object-cover" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-ink-400 dark:text-ink-500">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
              </svg>
            )}
          </div>
          <div className="flex-1 space-y-2">
            <label className="block px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer text-center transition-all hover:-translate-y-0.5"
                   style={logoUploading
                     ? { background: 'rgba(212, 168, 83, 0.20)', color: '#fde9a5', cursor: 'wait' }
                     : { background: 'linear-gradient(135deg, #1e3a5f, #b8902d)', color: '#fff', boxShadow: '0 0 14px rgba(212, 168, 83, 0.40)' }}>
              <input type="file" className="sr-only" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
                onChange={handleLogoChange} disabled={logoUploading} />
              {logoUploading
                ? 'Yükleniyor...'
                : (logoUrl ? 'Logoyu Değiştir' : 'Logo Yükle')}
            </label>
            {logoUrl && (
              <button type="button" onClick={onLogoDelete}
                className="block w-full px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-full transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.28)' }}>
                Logoyu Kaldır
              </button>
            )}
            <p className="text-xs text-ink-400">Max 10 MB · JPG/PNG/WEBP/HEIC</p>
          </div>
        </div>
      </div>

      {/* Galeri ayrı kartta — #87 GalleryEditor component'i ile yönetilir */}
    </div>
  )
}
