// FAZ 23.3 — Sadeleştirildi: dekoratif "sertifika cüzdanı" (3 kategori + hero +
// orbit/shimmer) kaldırıldı. Kullanıcı istegi: CV + Adli Sicil + Hijyen/Sağlık
// yeterli. Tek beyaz kart, 3 upload satiri.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import { useConfirm } from '../../../lib/useConfirm'

const DOC_TYPES = [
  { type: 'CV',                 label: 'CV / Özgeçmiş',            ext: 'PDF / DOCX', hint: 'Başvurularına otomatik eklenir' },
  { type: 'CRIMINAL_RECORD',    label: 'Adli Sicil Kaydı',        ext: 'PDF',        hint: 'Sadece izin verdiğin işletmeler görür' },
  { type: 'HEALTH_CERTIFICATE', label: 'Hijyen / Sağlık Belgesi', ext: 'PDF / JPG',  hint: 'Gıda ve serviste sıkça istenir' },
]

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
    if (file.size > 15 * 1024 * 1024) { toast.error('Dosya boyutu 15 MB\'ı aşamaz'); return }
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

  if (loading) {
    return <div className="card p-8 text-center" style={{ color: 'var(--ah-ink-3)' }}>Belgeler yükleniyor...</div>
  }

  return (
    <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--ah-line)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ah-ink)' }}>Belgelerim</h3>
        <p style={{ fontSize: 12.5, color: 'var(--ah-ink-3)', marginTop: 2 }}>
          CV, adli sicil ve hijyen/sağlık belgeni yükle — başvurularına otomatik eklensin.
        </p>
      </div>

      {DOC_TYPES.map((t, i) => {
        const doc = docs.find(d => d.type === t.type)
        const uploaded = !!doc
        return (
          <div key={t.type} className="flex items-center gap-3 px-5 py-4"
               style={i > 0 ? { borderTop: '1px solid var(--ah-line)' } : undefined}>
            <span className="w-10 h-10 rounded-lg grid place-items-center flex-shrink-0"
                  style={{ background: uploaded ? 'var(--ah-brand-soft)' : '#f1f4f4', color: uploaded ? 'var(--ah-brand)' : 'var(--ah-ink-4)' }}>
              {uploaded ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 12.75 6 6 9-13.5" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></svg>
              )}
            </span>
            <div className="flex-1 min-w-0">
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ah-ink)' }}>{t.label}</div>
              <div className="truncate" style={{ fontSize: 12, color: 'var(--ah-ink-3)', marginTop: 1 }}>
                {uploaded ? doc.originalFileName : `${t.ext} · max 15 MB · ${t.hint}`}
              </div>
            </div>
            {uploaded ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button type="button" onClick={() => handleView(doc.id)}
                        className="text-[12.5px] font-semibold rounded-lg px-3 py-1.5"
                        style={{ background: '#fff', color: 'var(--ah-ink-2)', border: '1px solid var(--ah-line-2)' }}>
                  Görüntüle
                </button>
                <button type="button" onClick={() => handleDelete(doc.id, t.label)} disabled={deletingId === doc.id}
                        className="text-[12.5px] font-semibold rounded-lg px-3 py-1.5 disabled:opacity-50"
                        style={{ background: '#fff', color: '#992d22', border: '1px solid var(--ah-line-2)' }}>
                  Sil
                </button>
              </div>
            ) : (
              <label className="text-[12.5px] font-semibold rounded-lg px-3.5 py-1.5 cursor-pointer flex-shrink-0"
                     style={{ background: 'var(--ah-brand)', color: '#fff' }}>
                {uploadingType === t.type ? 'Yükleniyor...' : '+ Yükle'}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                       disabled={uploadingType === t.type}
                       onChange={e => handleUpload(t.type, e.target.files?.[0])} />
              </label>
            )}
          </div>
        )
      })}

      <div className="px-5 py-3 flex items-start gap-2"
           style={{ borderTop: '1px solid var(--ah-line)', background: '#f7f9f9' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="var(--ah-ink-4)"
             strokeWidth={1.6} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
        </svg>
        <span style={{ fontSize: 11.5, color: 'var(--ah-ink-3)' }}>
          Hassas belgeler (Adli Sicil, Sağlık) sadece izin verdiğin işletmeler tarafından görülür.
        </span>
      </div>
    </div>
  )
}
