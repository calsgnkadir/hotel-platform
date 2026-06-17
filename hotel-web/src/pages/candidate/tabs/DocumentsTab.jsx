// FAZ 5.2 — CandidateDashboard'dan ayrildi (FAZ 2/#33 Sertifika Cuzdani v2)
// Redesign: glass cards + spring micro-interactions + stagger entrance
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import { DOC_CATEGORIES } from '../../../utils/labels'

export default function DocumentsTab() {
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
    if (!confirm(`"${label}" belgesini silmek istiyor musun?\n\nBu işlem geri alınamaz.`)) return
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
    return <div className="font-geist p-8 text-center" style={{ color: 'rgba(139, 169, 210, 0.7)' }}>Belgeler yükleniyor...</div>
  }

  return (
    <motion.div
      className="space-y-4 font-geist"
      initial="hidden" animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
    >
      {/* CÜZDAN HERO — animasyonlu progress, sheen sweep */}
      <motion.div variants={ITEM}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 38, 0.85) 0%, rgba(30, 58, 95, 0.65) 100%)',
          border: '1px solid rgba(212, 168, 83, 0.20)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
        {/* Köşede yüzen altın blob */}
        <div aria-hidden className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
             style={{
               background: 'radial-gradient(circle, rgba(212, 168, 83, 0.20) 0%, transparent 65%)',
               filter: 'blur(20px)',
             }} />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight" style={{ color: '#ffffff', letterSpacing: '-0.02em' }}>
              Sertifika <em className="not-italic font-semibold" style={{
                background: 'linear-gradient(135deg, #f7c43c 0%, #d4a853 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>cüzdanım</em>
            </h2>
            <p className="text-[12.5px] mt-2 max-w-md" style={{ color: 'rgba(139, 169, 210, 0.85)' }}>
              Belgelerini güvenle sakla — başvurularına otomatik eklensin.
            </p>
          </div>
          <CountUpBadge value={completion} />
        </div>
        <div className="relative mt-5 h-1.5 rounded-full overflow-hidden"
             style={{ background: 'rgba(212, 168, 83, 0.10)' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completion}%` }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #b8902d, #d4a853, #f7c43c)',
              boxShadow: '0 0 12px rgba(212, 168, 83, 0.45)',
            }}
          />
          {/* Sheen sweep */}
          <span aria-hidden className="absolute inset-y-0 -left-1/4 w-1/4 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
                  transform: 'skewX(-20deg)',
                  animation: 'doc-shimmer 2.4s ease-in-out infinite',
                }} />
        </div>
        <div className="flex items-center justify-between mt-3 text-[11px] uppercase tracking-[0.2em]"
             style={{ color: 'rgba(253, 233, 165, 0.7)' }}>
          <span>{uploadedTypes.size} yüklendi</span>
          <span>{totalTypes} toplam</span>
        </div>
      </motion.div>

      {/* KATEGORİ KARTLARI */}
      {DOC_CATEGORIES.map((cat) => {
        const filled = cat.types.filter(t => uploadedTypes.has(t.type)).length
        const pct = Math.round((filled / cat.types.length) * 100)
        return (
          <motion.section key={cat.key} variants={ITEM}
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(21, 36, 61, 0.55)',
              border: '1px solid rgba(212, 168, 83, 0.12)',
              backdropFilter: 'blur(14px)',
            }}>
            <div className="relative px-5 py-3.5 flex items-center justify-between"
                 style={{ borderBottom: '1px solid rgba(212, 168, 83, 0.10)' }}>
              {/* Sol kenar accent — kategori rengi */}
              <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                    style={{ background: cat.color, boxShadow: `0 0 8px ${cat.color}66` }} />
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: '#fde9a5' }}>
                {cat.label}
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1 rounded-full overflow-hidden"
                     style={{ background: 'rgba(212, 168, 83, 0.10)' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                    className="h-full"
                    style={{ background: `linear-gradient(90deg, ${cat.color}99, ${cat.color})` }} />
                </div>
                <span className="text-[11px] font-semibold tabular-nums"
                      style={{ color: filled === cat.types.length ? '#86efac' : '#fde9a5' }}>
                  {filled} / {cat.types.length}
                </span>
              </div>
            </div>
            <motion.div
              initial="hidden" animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
            >
              {cat.types.map((t, i) => {
                const doc = docs.find(d => d.type === t.type)
                const isUploaded = !!doc
                return (
                  <motion.div key={t.type} variants={ROW}
                    className="group relative px-5 py-3.5 flex items-center gap-3"
                    style={{ borderBottom: i < cat.types.length - 1 ? '1px solid rgba(212, 168, 83, 0.06)' : 'none' }}>
                    {/* Hover background sweep */}
                    <span aria-hidden className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                          style={{ background: `linear-gradient(90deg, ${cat.color}10 0%, transparent 50%)` }} />

                    <StatusIcon isUploaded={isUploaded} color={cat.color} />

                    <div className="relative flex-1 min-w-0">
                      <div className="text-[14px] font-medium flex items-center gap-2"
                           style={{ color: '#ffffff', letterSpacing: '-0.005em' }}>
                        {t.label}
                        {t.required && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.12)',
                                  color: '#fca5a5',
                                  border: '1px solid rgba(239, 68, 68, 0.30)',
                                }}>
                            Zorunlu
                          </span>
                        )}
                      </div>
                      <div className="text-[11.5px] truncate mt-0.5"
                           style={{ color: 'rgba(139, 169, 210, 0.75)' }}>
                        {isUploaded
                          ? `${doc.originalFileName} · ${new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}`
                          : `${t.ext} · max 15 MB`}
                      </div>
                    </div>

                    <div className="relative flex items-center gap-1.5 flex-shrink-0">
                      {isUploaded ? (
                        <>
                          <SmallButton onClick={() => handleView(doc.id)} tint={cat.color}>
                            Görüntüle
                          </SmallButton>
                          <SmallButton onClick={() => handleDelete(doc.id, t.label)}
                                       disabled={deletingId === doc.id} variant="danger">
                            Sil
                          </SmallButton>
                        </>
                      ) : (
                        <UploadLabel
                          isLoading={uploadingType === t.type}
                          onChange={e => handleUpload(t.type, e.target.files?.[0])}
                          color={cat.color}
                        />
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </motion.section>
        )
      })}

      <motion.div variants={ITEM}
        className="px-4 py-3 rounded-xl text-[12px] italic flex items-start gap-2"
        style={{
          background: 'rgba(212, 168, 83, 0.05)',
          border: '1px solid rgba(212, 168, 83, 0.12)',
          color: 'rgba(253, 233, 165, 0.85)',
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
        @keyframes doc-checkmark {
          from { stroke-dashoffset: 24 }
          to   { stroke-dashoffset: 0 }
        }
      `}</style>
    </motion.div>
  )
}

/* ────────── Sub-components ────────── */

const ITEM = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 170, damping: 22 } },
}
const ROW = {
  hidden:  { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 220, damping: 24 } },
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
      <div className="text-4xl font-semibold tabular-nums leading-none"
           style={{
             background: 'linear-gradient(135deg, #f7c43c 0%, #d4a853 100%)',
             WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
             letterSpacing: '-0.04em',
           }}>
        %{displayed}
      </div>
      <div className="text-[10px] uppercase tracking-[0.25em] font-semibold mt-1"
           style={{ color: 'rgba(253, 233, 165, 0.7)' }}>
        Doluluk
      </div>
    </div>
  )
}

function StatusIcon({ isUploaded, color }) {
  return (
    <div className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
         style={{
           background: isUploaded
             ? `linear-gradient(135deg, ${color}28, ${color}10)`
             : 'rgba(212, 168, 83, 0.06)',
           border: `1px solid ${isUploaded ? color + '50' : 'rgba(212, 168, 83, 0.18)'}`,
           boxShadow: isUploaded ? `0 0 12px ${color}30` : 'none',
         }}>
      <AnimatePresence mode="wait">
        {isUploaded ? (
          <motion.svg key="check" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            stroke={color} strokeWidth={2.2} className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5"
                  style={{
                    strokeDasharray: 24,
                    animation: 'doc-checkmark 0.4s ease-out 0.1s both',
                  }} />
          </motion.svg>
        ) : (
          <motion.svg key="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            strokeWidth={1.7} stroke="rgba(253, 233, 165, 0.55)" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  )
}

function SmallButton({ children, onClick, disabled, tint, variant }) {
  const isDanger = variant === 'danger'
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
      style={isDanger
        ? {
            background: 'rgba(239, 68, 68, 0.12)',
            color: '#fca5a5',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }
        : {
            background: `${tint}18`,
            color: '#fde9a5',
            border: `1px solid ${tint}40`,
          }}>
      {children}
    </motion.button>
  )
}

function UploadLabel({ isLoading, onChange, color }) {
  return (
    <motion.label
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className="relative overflow-hidden text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        color: '#0c1726',
        boxShadow: `0 4px 14px ${color}40, inset 0 1px 0 rgba(255,255,255,0.25)`,
      }}>
      {/* Sheen sweep */}
      <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
              transform: 'skewX(-20deg)',
              animation: 'doc-shimmer 3.2s ease-in-out infinite',
            }} />
      {isLoading ? (
        <span className="relative">Yükleniyor...</span>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={2.2} className="w-3.5 h-3.5 relative">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="relative">Yükle</span>
        </>
      )}
      <input type="file" className="hidden"
             accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
             disabled={isLoading}
             onChange={onChange} />
    </motion.label>
  )
}
