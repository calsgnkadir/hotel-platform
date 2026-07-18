// FAZ 5.2 — Sertifika Cuzdani v3 (Bento grid + asymmetric tiles)
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import { DOC_CATEGORIES } from '../../../utils/labels'
import { useConfirm } from '../../../lib/useConfirm'

export default function DocumentsTab() {
  const confirm = useConfirm()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadingType, setUploadingType] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  async function loadDocs() {
    setLoading(true)
    try {
      const data = await hotelApi.getMyDocuments()
      setDocs(data || [])
    } catch { setDocs([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { loadDocs() }, [])

  async function handleUpload(type, file) {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      toast.error('Dosya boyutu 15 MB\'ı aşamaz')
      return
    }
    setUploadingType(type)
    try {
      await hotelApi.uploadDocument(file, type)
      toast.success('Belge yüklendi')
      await loadDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setUploadingType(null) }
  }

  async function handleDelete(docId, label) {
    const ok = await confirm({
      title: `"${label}" belgesini sil`,
      description: 'Bu işlem geri alınamaz.',
      confirmLabel: 'Evet, sil',
      destructive: true,
    })
    if (!ok) return
    setDeletingId(docId)
    try {
      await hotelApi.deleteDocument(docId)
      toast.success('Belge silindi')
      await loadDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setDeletingId(null) }
  }

  async function handleView(docId) {
    try {
      const url = await hotelApi.getDocumentUrl(docId)
      window.open(url, '_blank')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  const totalTypes = DOC_CATEGORIES.reduce((sum, c) => sum + c.types.length, 0)
  const uploadedTypes = new Set(docs.map(d => d.type))
  const completion = Math.round((uploadedTypes.size / totalTypes) * 100)

  if (loading) {
    return <div className="p-8 text-center" style={{ color: '#6b7574' }}>Belgeler yükleniyor...</div>
  }

  return (
    <motion.div
      className="space-y-4"
      initial="hidden" animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
    >
      <HeroCard completion={completion} uploaded={uploadedTypes.size} total={totalTypes} />

      {/* BENTO GRID — kategori kartları yan yana, dar ekranda bile 2 sutun */}
      <motion.div variants={ITEM}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DOC_CATEGORIES.map((cat, idx) => {
          const filled = cat.types.filter(t => uploadedTypes.has(t.type)).length
          return (
            <CategoryCard
              key={cat.key}
              cat={cat}
              idx={idx}
              filled={filled}
              docs={docs}
              uploadingType={uploadingType}
              deletingId={deletingId}
              onUpload={handleUpload}
              onView={handleView}
              onDelete={handleDelete}
            />
          )
        })}
      </motion.div>

      <motion.div variants={ITEM}
        className="px-4 py-3 rounded-2xl text-[12px] italic flex items-start gap-2"
        style={{
          background: 'rgba(15, 118, 110, 0.04)',
          border: '1px solid rgba(15, 118, 110, 0.10)',
          color: '#6b7574',
        }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth={1.6} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        Hassas belgeler (Sağlık, Kimlik, Adli Sicil) sadece izin verdiğin işletmeler tarafından görülür.
      </motion.div>

      <style>{`
        @keyframes doc-shimmer {
          0%, 100% { transform: translateX(0) skewX(-20deg) }
          50%      { transform: translateX(400%) skewX(-20deg) }
        }
        @keyframes doc-orbit {
          from { transform: rotate(0deg) }
          to   { transform: rotate(360deg) }
        }
      `}</style>
    </motion.div>
  )
}

/* ────────── HERO ────────── */

function HeroCard({ completion, uploaded, total }) {
  return (
    <motion.div variants={ITEM}
      className="relative overflow-hidden p-7 sm:p-8"
      style={{
        background: '#ffffff',
        borderRadius: '28px 12px 28px 12px',
        border: 'none',
        boxShadow: '0 18px 48px rgba(0,0,0,0.32), inset 0 1px 0 rgba(245,239,226,0.03)',
      }}>
      {/* Orbital champagne yörünge */}
      <div aria-hidden className="absolute -top-32 -right-32 w-96 h-96 pointer-events-none"
           style={{ animation: 'doc-orbit 40s linear infinite' }}>
        <div className="absolute inset-0 rounded-full"
             style={{
               background: 'radial-gradient(circle, rgba(15, 118, 110, 0.22) 0%, transparent 60%)',
               filter: 'blur(28px)',
             }} />
      </div>
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl sm:text-[28px] font-semibold"
              style={{ color: '#12201f', letterSpacing: '-0.025em', lineHeight: 1.08 }}>
            Sertifika{' '}
            <em className="not-italic font-semibold"
                style={{ color: '#0f766e', letterSpacing: '-0.015em' }}>
              cüzdanım
            </em>
          </h2>
          <p className="text-[13px] mt-2 max-w-md leading-relaxed" style={{ color: '#6b7574' }}>
            Belgelerini güvenle sakla — başvurularına otomatik eklensin.
          </p>
        </div>
        <CountUpBadge value={completion} />
      </div>
      <div className="relative mt-6 h-1.5 rounded-full overflow-hidden"
           style={{ background: 'rgba(15, 118, 110, 0.08)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${completion}%` }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, #0b5d57, #0f766e, #0f766e)',
            boxShadow: '0 0 12px rgba(15, 118, 110, 0.42)',
          }} />
        <span aria-hidden className="absolute inset-y-0 -left-1/4 w-1/4 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(245,239,226,0.28), transparent)',
                animation: 'doc-shimmer 2.4s ease-in-out infinite',
              }} />
      </div>
      <div className="flex items-center justify-between mt-3 text-[10px] uppercase tracking-[0.28em] font-medium"
           style={{ color: '#6b7574' }}>
        <span>{uploaded} yüklendi</span>
        <span>{total} toplam</span>
      </div>
    </motion.div>
  )
}

/* ────────── BENTO CATEGORY CARD ────────── */

function CategoryCard({ cat, idx, filled, docs, uploadingType, deletingId, onUpload, onView, onDelete }) {
  const pct = Math.round((filled / cat.types.length) * 100)
  const complete = filled === cat.types.length
  // Her karta farklı asimetrik corner pattern
  const cornerPattern = [
    'rounded-tl-[28px] rounded-tr-[12px] rounded-br-[28px] rounded-bl-[12px]',
    'rounded-tl-[12px] rounded-tr-[28px] rounded-br-[12px] rounded-bl-[28px]',
    'rounded-tl-[28px] rounded-tr-[28px] rounded-br-[12px] rounded-bl-[12px]',
  ][idx % 3]

  return (
    <motion.div variants={CARD}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 220, damping: 20 }}
      className={`relative overflow-hidden ${cornerPattern} group`}
      style={{
        background: '#ffffff',
        border: 'none',
        boxShadow: `0 14px 36px rgba(0,0,0,0.28), inset 0 1px 0 rgba(245,239,226,0.03)`,
      }}>
      {/* Köşede yüzen kategori rengi blob */}
      <div aria-hidden className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none transition-opacity duration-500 opacity-50 group-hover:opacity-80"
           style={{
             background: `radial-gradient(circle, ${cat.color}40 0%, transparent 70%)`,
             filter: 'blur(20px)',
           }} />
      {/* Çapraz hat aksanı — alt */}
      <div aria-hidden className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
           style={{ background: `linear-gradient(90deg, transparent, ${cat.color}55, transparent)` }} />

      {/* HEADER */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Büyük dekoratif harf */}
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-semibold text-lg"
                 style={{
                   background: `linear-gradient(135deg, ${cat.color}28, ${cat.color}10)`,
                   border: `1px solid ${cat.color}40`,
                   color: cat.color,
                 }}>
              {cat.label.charAt(0)}
            </div>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: '#12201f', letterSpacing: '-0.015em' }}>
                {cat.label}
              </h3>
              <p className="text-[10px] uppercase tracking-[0.22em] mt-1 font-medium"
                 style={{ color: '#6b7574' }}>
                {cat.types.length} belge
              </p>
            </div>
          </div>
          {/* Sağ üst tamamlama badge */}
          <div className="text-right">
            <div className="text-[20px] font-semibold tabular-nums leading-none"
                 style={{ color: complete ? '#a8c8a8' : cat.color, letterSpacing: '-0.03em' }}>
              {filled}<span style={{ color: '#98a1a0' }}>/{cat.types.length}</span>
            </div>
            {complete && (
              <span className="text-[9px] uppercase tracking-[0.22em] font-semibold mt-1 inline-block"
                    style={{ color: '#a8c8a8' }}>tamam</span>
            )}
          </div>
        </div>
        {/* Mini progress */}
        <div className="mt-3 h-1 rounded-full overflow-hidden"
             style={{ background: 'rgba(15, 118, 110, 0.08)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 + idx * 0.1 }}
            className="h-full rounded-full"
            style={{
              background: `linear-gradient(90deg, ${cat.color}99, ${cat.color})`,
              boxShadow: `0 0 8px ${cat.color}40`,
            }} />
        </div>
      </div>

      {/* DOC TILES */}
      <motion.div
        className="px-3 pb-3 space-y-1.5"
        initial="hidden" animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      >
        {cat.types.map(t => {
          const doc = docs.find(d => d.type === t.type)
          const isUploaded = !!doc
          return (
            <DocTile key={t.type}
              t={t}
              doc={doc}
              isUploaded={isUploaded}
              catColor={cat.color}
              uploading={uploadingType === t.type}
              deleting={deletingId === doc?.id}
              onUpload={(file) => onUpload(t.type, file)}
              onView={() => onView(doc.id)}
              onDelete={() => onDelete(doc.id, t.label)}
            />
          )
        })}
      </motion.div>
    </motion.div>
  )
}

/* ────────── DOC TILE (compact, action overlay) ────────── */

function DocTile({ t, doc, isUploaded, catColor, uploading, deleting, onUpload, onView, onDelete }) {
  const [hover, setHover] = useState(false)

  return (
    <motion.div variants={TILE}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="relative rounded-xl overflow-hidden transition-colors"
      style={{
        background: isUploaded ? `${catColor}0a` : 'rgba(255, 255, 255, 0.55)',
        border: `1px solid ${isUploaded ? catColor + '30' : 'rgba(15, 118, 110, 0.08)'}`,
      }}>
      <div className="relative p-3 flex items-center gap-2.5">
        <StatusIcon isUploaded={isUploaded} color={catColor} size={36} />
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium flex items-center gap-1.5"
               style={{ color: '#3f4b4a', letterSpacing: '-0.005em' }}>
            <span className="truncate">{t.label}</span>
            {t.required && !isUploaded && (
              <span className="text-[8px] px-1 py-0.5 rounded font-semibold uppercase tracking-[0.16em] flex-shrink-0"
                    style={{
                      background: 'rgba(180, 106, 85, 0.12)',
                      color: '#d39481',
                      border: '1px solid rgba(180, 106, 85, 0.30)',
                    }}>
                zorunlu
              </span>
            )}
          </div>
          <div className="text-[10px] truncate mt-0.5"
               style={{ color: '#6b7574' }}>
            {isUploaded
              ? `${doc.originalFileName.length > 22 ? doc.originalFileName.slice(0, 22) + '…' : doc.originalFileName}`
              : `${t.ext} · max 15 MB`}
          </div>
        </div>

        {/* Hover'da görünür action bar */}
        <AnimatePresence>
          {isUploaded && hover && (
            <motion.div
              initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 4 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1 flex-shrink-0">
              <IconBtn title="Görüntüle" onClick={onView} color={catColor}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </IconBtn>
              <IconBtn title="Sil" onClick={onDelete} disabled={deleting} variant="danger">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round"
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </IconBtn>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Yükle butonu (sadece boş tile için) */}
        {!isUploaded && (
          <motion.label
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
            className="relative overflow-hidden text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1 flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${catColor}, ${catColor}cc)`,
              color: '#ffffff',
              boxShadow: `0 4px 12px ${catColor}40, inset 0 1px 0 rgba(255,255,255,0.25)`,
            }}>
            <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    transform: 'skewX(-20deg)',
                    animation: 'doc-shimmer 3.2s ease-in-out infinite',
                  }} />
            {uploading ? (
              <span className="relative">...</span>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth={2.4} className="w-3.5 h-3.5 relative">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span className="relative">Yükle</span>
              </>
            )}
            <input type="file" className="hidden"
                   accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                   disabled={uploading}
                   onChange={e => onUpload(e.target.files?.[0])} />
          </motion.label>
        )}
      </div>
    </motion.div>
  )
}

/* ────────── Atomic pieces ────────── */

const ITEM = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 170, damping: 22 } },
}
const CARD = {
  hidden:  { opacity: 0, y: 24, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 180, damping: 22 } },
}
const TILE = {
  hidden:  { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 230, damping: 24 } },
}

function CountUpBadge({ value }) {
  const [displayed, setDisplayed] = useState(0)
  useEffect(() => {
    let raf
    const startTime = performance.now()
    const duration = 900
    function step(t) {
      const p = Math.min(1, (t - startTime) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplayed(Math.round(eased * value))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <div className="text-right flex-shrink-0">
      <div className="text-4xl sm:text-[44px] font-semibold tabular-nums leading-none"
           style={{
             color: '#12201f',
             letterSpacing: '-0.04em',
             filter: 'drop-shadow(0 0 16px rgba(15, 118, 110, 0.30))',
           }}>
        %{displayed}
      </div>
      <div className="text-[10px] uppercase tracking-[0.28em] font-medium mt-2"
           style={{ color: '#6b7574' }}>
        Doluluk
      </div>
    </div>
  )
}

function StatusIcon({ isUploaded, color, size = 36 }) {
  return (
    <div className="relative flex items-center justify-center flex-shrink-0 rounded-xl"
         style={{
           width: size, height: size,
           background: isUploaded
             ? `linear-gradient(135deg, ${color}28, ${color}10)`
             : 'rgba(15, 118, 110, 0.06)',
           border: `1px solid ${isUploaded ? color + '50' : 'rgba(15, 118, 110, 0.14)'}`,
           boxShadow: isUploaded ? `0 0 10px ${color}30` : 'none',
         }}>
      <AnimatePresence mode="wait">
        {isUploaded ? (
          <motion.svg key="check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 20 }}
            stroke={color} strokeWidth={2.4}
            style={{ width: size * 0.46, height: size * 0.46 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </motion.svg>
        ) : (
          <motion.svg key="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            strokeWidth={1.7} stroke="#6b7574"
            style={{ width: size * 0.46, height: size * 0.46 }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  )
}

function IconBtn({ children, onClick, disabled, color, variant, title }) {
  const isDanger = variant === 'danger'
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="w-7 h-7 grid place-items-center rounded-lg transition-colors disabled:opacity-50"
      style={isDanger
        ? {
            background: 'rgba(180, 106, 85, 0.10)',
            color: '#d39481',
            border: '1px solid rgba(180, 106, 85, 0.28)',
          }
        : {
            background: `${color}18`,
            color: '#0f766e',
            border: `1px solid ${color}40`,
          }}>
      {children}
    </motion.button>
  )
}
