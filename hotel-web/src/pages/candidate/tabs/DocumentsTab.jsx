// FAZ 5.2 — CandidateDashboard'dan ayrildi (FAZ 2/#33 Sertifika Cuzdani v2)
import { useEffect, useState } from 'react'
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
    return <div className="card p-8 text-center text-ink-500">Belgeler yükleniyor...</div>
  }

  return (
    <div className="space-y-4">
      <div className="card p-5"
           style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)', borderColor: 'rgba(126,34,206,0.2)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black" style={{ color: '#3b0764' }}>
              Sertifika Cüzdanım
            </h2>
            <p className="text-xs mt-1" style={{ color: '#6b21a8' }}>
              Belgelerini güvenle sakla, başvurularına otomatik eklensin
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-black" style={{ color: '#7e22ce' }}>%{completion}</div>
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#6b21a8' }}>Doluluk</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(126,34,206,0.15)' }}>
          <div className="h-full transition-all" style={{
            width: `${completion}%`,
            background: 'linear-gradient(90deg, #7e22ce, #a855f7)'
          }} />
        </div>
      </div>

      {DOC_CATEGORIES.map(cat => {
        const filled = cat.types.filter(t => uploadedTypes.has(t.type)).length
        return (
          <div key={cat.key} className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-cream-200 dark:border-ink-700 flex items-center justify-between">
              <h3 className="font-semibold text-ink-800 dark:text-ink-900" style={{ color: cat.color }}>
                {cat.label}
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${cat.color}15`, color: cat.color }}>
                {filled} / {cat.types.length}
              </span>
            </div>
            <div className="divide-y divide-cream-100 dark:divide-ink-700">
              {cat.types.map(t => {
                const doc = docs.find(d => d.type === t.type)
                const isUploaded = !!doc
                return (
                  <div key={t.type} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                         style={{ background: isUploaded ? `${cat.color}15` : '#f3f4f6' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                           strokeWidth={1.8} stroke={isUploaded ? cat.color : '#9ca3af'}
                           className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                        {isUploaded ? (
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        )}
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink-700 dark:text-ink-300 flex items-center gap-1.5">
                        {t.label}
                        {t.required && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold">ZORUNLU</span>}
                      </div>
                      <div className="text-xs text-ink-500 truncate">
                        {isUploaded
                          ? `${doc.originalFileName} · ${new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}`
                          : `${t.ext} · max 15 MB`}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isUploaded ? (
                        <>
                          <button onClick={() => handleView(doc.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-semibold transition-colors"
                            style={{ background: `${cat.color}15`, color: cat.color }}>
                            Görüntüle
                          </button>
                          <button onClick={() => handleDelete(doc.id, t.label)}
                            disabled={deletingId === doc.id}
                            className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-semibold transition-colors disabled:opacity-50">
                            Sil
                          </button>
                        </>
                      ) : (
                        <label className="text-xs px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer transition-all hover:-translate-y-0.5"
                               style={{ background: cat.color, color: 'white' }}>
                          {uploadingType === t.type ? 'Yükleniyor...' : 'Yükle'}
                          <input type="file" className="hidden"
                                 accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                                 disabled={uploadingType === t.type}
                                 onChange={e => handleUpload(t.type, e.target.files?.[0])} />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="card p-4 text-xs text-ink-500 italic">
        Hassas belgeler (Sağlık, Kimlik, Adli Sicil) sadece izin verdiğin işletmeler tarafından görülür.
      </div>
    </div>
  )
}
