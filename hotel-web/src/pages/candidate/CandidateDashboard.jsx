import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import ListingsPage from './ListingsPage'
import MessagesPage from '../MessagesPage'
import ChangePasswordCard from '../../components/ChangePasswordCard'
import ReviewModal from '../../components/ReviewModal'
import { validateTurkeyPhone, formatTurkeyPhoneInput, validateAdultAge, birthDateBounds } from '../../utils/validation'
import DistrictNeighborhoodSelect from '../../components/DistrictNeighborhoodSelect'
import { ISTANBUL_DISTRICTS } from '../../data/istanbul'

const POSITION_LABELS = {
  WAITER: 'Garson', DISHWASHER: 'Bulaşıkçı', HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon', KITCHEN_STAFF: 'Mutfak Personeli', BELLBOY: 'Bellboy', SECURITY: 'Güvenlik',
}

const GENDER_LABELS = { MALE: 'Erkek', FEMALE: 'Kadın', OTHER: 'Diğer' }
const EDUCATION_LABELS = {
  HIGH_SCHOOL: 'Lise',
  UNIVERSITY_GRADUATE: 'Üniversite',
}
const LANGUAGE_LABELS = {
  TURKISH:  'Türkçe',  ENGLISH:  'İngilizce', GERMAN:   'Almanca',
  RUSSIAN:  'Rusça',   ARABIC:   'Arapça',    FRENCH:   'Fransızca',
  SPANISH:  'İspanyolca', ITALIAN: 'İtalyanca',
}
const AVAILABILITY_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}
const DOC_TYPE_LABELS = {
  CV: 'CV',
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  CRIMINAL_RECORD: 'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT: 'Kimlik Fotokopisi',
}
const SENSITIVE_DOC_TYPES_CAND = ['CRIMINAL_RECORD', 'HEALTH_CERTIFICATE', 'IDENTITY_DOCUMENT']

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const map = {
    PENDING:   { cls: 'badge-pending',   icon: '⏳', label: 'Bekliyor' },
    REVIEWING: { cls: 'badge-reviewing', icon: '🔍', label: 'İnceleniyor' },
    ACCEPTED:  { cls: 'badge-accepted',  icon: '✅', label: 'Kabul' },
    REJECTED:  { cls: 'badge-rejected',  icon: '❌', label: 'Red' },
    EXPIRED:   { cls: 'badge-expired',   icon: '⌛', label: 'Süresi Doldu' },
    WITHDRAWN: { cls: 'badge-expired',   icon: '🚫', label: 'İptal Edildi' },
  }
  const s = map[status] || { cls: 'badge-pending', icon: '?', label: status }
  return <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>
}

// Aday başvuru status filtre seçenekleri
const CAND_STATUS_FILTERS = [
  { value: '',          label: 'Tümü' },
  { value: 'PENDING',   label: 'Bekleyen' },
  { value: 'REVIEWING', label: 'İnceleniyor' },
  { value: 'ACCEPTED',  label: 'Kabul' },
  { value: 'REJECTED',  label: 'Red' },
  { value: 'WITHDRAWN', label: 'İptal' },
]

/* ── Applications Tab ── */
function ApplicationsTab({ applications, onRefresh, onOpenMessages }) {
  const [respondingId, setRespondingId] = useState(null)
  const [myDocs, setMyDocs] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [openingChatId, setOpeningChatId] = useState(null)

  async function handleStartChat(app) {
    const ownerId = app.listing?.businessOwnerId
    if (!ownerId) return toast.error('İşletme bilgisi bulunamadı')
    setOpeningChatId(app.id)
    try {
      await hotelApi.startConversation({ otherPartyId: ownerId, applicationId: app.id })
      onOpenMessages?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setOpeningChatId(null)
    }
  }

  // Aday'ın yüklediği belge tipleri — Onayla butonunu validate için
  useEffect(() => {
    hotelApi.getMyDocuments().then(setMyDocs).catch(() => setMyDocs([]))
  }, [applications])  // başvuru güncellenince belgeler de yeniden okunsun

  const uploadedTypes = new Set(myDocs.map(d => d.type))

  async function handleRespond(reqId, grant) {
    setRespondingId(reqId)
    try {
      await hotelApi.respondDocumentRequest(reqId, grant)
      toast.success(grant ? 'Belgeye izin verildi' : 'Talep reddedildi')
      onRefresh?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setRespondingId(null)
    }
  }

  // R4: Yorum hedefi
  const [reviewTarget, setReviewTarget] = useState(null)

  // D6: Aday başvurusunu iptal eder
  const [withdrawingId, setWithdrawingId] = useState(null)
  async function handleWithdraw(appId) {
    if (!confirm('Bu başvuruyu iptal etmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.')) return
    setWithdrawingId(appId)
    try {
      await hotelApi.withdrawApplication(appId)
      toast.success('Başvurunuz iptal edildi')
      onRefresh?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setWithdrawingId(null)
    }
  }

  if (applications.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <span className="text-4xl mb-3">📋</span>
          <p className="font-medium text-slate-700">Henüz başvurunuz yok</p>
          <p className="text-sm text-slate-500 mt-1">İlanlar bölümünden bir ilana başvurun</p>
        </div>
      </div>
    )
  }

  // #84: Client-side status filtresi (aday genelde az başvuruya sahip)
  const filtered = statusFilter
    ? applications.filter(a => a.status === statusFilter)
    : applications

  return (
    <div className="space-y-3">
      {/* Status filtre pill'leri */}
      <div className="flex gap-1.5 flex-wrap">
        {CAND_STATUS_FILTERS.map(f => {
          const count = f.value ? applications.filter(a => a.status === f.value).length : applications.length
          return (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${statusFilter === f.value
                  ? 'text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'}`}
              style={statusFilter === f.value ? { background: 'linear-gradient(135deg, #7c3aed, #2563eb)' } : {}}>
              {f.label} <span className="opacity-70">({count})</span>
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state py-10">
            <p className="text-sm text-slate-500">Bu filtrede başvuru yok</p>
          </div>
        </div>
      ) : filtered.map(app => (
        <div key={app.id} className="card">
          <div className="p-4 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0"
                   style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}>
                🏨
              </div>
              <div>
                <div className="font-semibold text-slate-800">{app.listing?.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{app.listing?.businessName}</div>
                <div className="text-xs text-slate-400 mt-1">
                  {new Date(app.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={app.status} />
              {/* D6: Sadece PENDING/REVIEWING başvurular iptal edilebilir.
                  ACCEPTED ise iptal yasak — backend "iletişime geçin" mesajı döner. */}
              {(app.status === 'PENDING' || app.status === 'REVIEWING') && (
                <button onClick={() => handleWithdraw(app.id)}
                  disabled={withdrawingId === app.id}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium disabled:opacity-50">
                  {withdrawingId === app.id ? 'İptal ediliyor...' : 'İptal Et'}
                </button>
              )}
              {/* #77: Kabul edilmiş başvuruda işletmeyle mesajlaş */}
              {app.status === 'ACCEPTED' && (
                <button onClick={() => handleStartChat(app)}
                  disabled={openingChatId === app.id}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors font-medium disabled:opacity-50">
                  {openingChatId === app.id ? 'Açılıyor...' : '💬 Mesaj Gönder'}
                </button>
              )}
              {/* R4 + R5: Sadece ACCEPTED + çalışma tamamlanmış başvuruda puanla */}
              {app.status === 'ACCEPTED' && (
                app.workCompleted ? (
                  <button onClick={() => setReviewTarget({
                      id: app.id,
                      title: app.listing?.businessName || 'İşletme',
                    })}
                    className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors font-medium">
                    ⭐ Puanla
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 italic"
                    title="Vardiya günü geçince puanlayabilirsiniz">
                    Çalışma sonrası puanlanır
                  </span>
                )
              )}
            </div>
          </div>

          {app.note && (
            <div className="px-4 pb-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                <span className="font-medium">İşletme Notu:</span> {app.note}
              </div>
            </div>
          )}

          {app.documentRequests?.length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Belge Talepleri</div>
              <div className="space-y-2">
                {app.documentRequests.map(dr => {
                  const label = DOC_TYPE_LABELS[dr.documentType] || dr.documentType
                  const isPending = dr.status === 'PENDING'
                  const hasUploaded = uploadedTypes.has(dr.documentType)
                  return (
                    <div key={dr.id}
                      className={`rounded-lg px-3 py-2.5 ${isPending ? 'bg-violet-50 border border-violet-200' : 'bg-slate-50'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm text-slate-700 font-medium">{label}</span>
                        {!isPending && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            dr.status === 'GRANTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {dr.status === 'GRANTED' ? 'İzin Verdin' : 'Reddettin'}
                          </span>
                        )}
                      </div>
                      {isPending && (
                        <>
                          {!hasUploaded && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
                              ⚠ Bu belgeyi henüz yüklemedin. <b>Belgelerim</b> sekmesinden yükledikten sonra izin verebilirsin.
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleRespond(dr.id, true)}
                              disabled={respondingId === dr.id || !hasUploaded}
                              title={!hasUploaded ? 'Önce bu belgeyi yükle' : ''}
                              className="flex-1 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                              İzin Ver
                            </button>
                            <button onClick={() => handleRespond(dr.id, false)}
                              disabled={respondingId === dr.id}
                              className="flex-1 py-1.5 rounded-md bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50">
                              Reddet
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ))}

      {reviewTarget && (
        <ReviewModal
          applicationId={reviewTarget.id}
          title={reviewTarget.title}
          onClose={() => setReviewTarget(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  )
}

/* ── Documents Tab ── */
function DocumentsTab() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedType, setSelectedType] = useState('CV')

  const docTypes = ['CV', 'TRANSCRIPT', 'CRIMINAL_RECORD', 'HEALTH_CERTIFICATE', 'IDENTITY_DOCUMENT']

  const fetchDocs = useCallback(async () => {
    try {
      const data = await hotelApi.getMyDocuments()
      setDocuments(data)
    } catch {
      toast.error('Belgeler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    // Client-side ön kontrol — backend'e gitmeden hızlı feedback
    const MAX_SIZE = 15 * 1024 * 1024  // 15 MB (backend ile aynı)
    if (file.size > MAX_SIZE) {
      const mb = (file.size / (1024 * 1024)).toFixed(1)
      toast.error(`Dosya çok büyük (${mb} MB). Maksimum 15 MB olmalı.`)
      e.target.value = ''
      return
    }

    const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'doc', 'docx']
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!allowed.includes(ext)) {
      toast.error(`'.${ext}' formatı desteklenmiyor. Kabul edilenler: PDF, JPG, PNG, WEBP, HEIC, DOC, DOCX`)
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      await hotelApi.uploadDocument(file, selectedType)
      toast.success('Belge yüklendi')
      fetchDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete(docId) {
    if (!confirm('Belge silinsin mi?')) return
    try {
      await hotelApi.deleteDocument(docId)
      toast.success('Belge silindi')
      fetchDocs()
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-header"><h2 className="font-semibold text-slate-800">Belge Yükle</h2></div>
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
              className="input sm:w-52 flex-shrink-0">
              {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              border-2 border-dashed cursor-pointer text-sm font-medium transition-colors
              ${uploading ? 'border-violet-300 bg-violet-50 text-violet-400 cursor-wait'
                : 'border-slate-300 hover:border-violet-400 hover:bg-violet-50 text-slate-600 hover:text-violet-600'}`}>
              <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,image/*,application/pdf"/>
              {uploading ? '⏳ Yükleniyor...' : '📎 Dosya Seç (PDF, JPG, PNG, WEBP, HEIC, DOC, max 15 MB)'}
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800">Belgelerim</h2>
          <span className="text-xs text-slate-400">{documents.length} belge</span>
        </div>
        {documents.length === 0 ? (
          <div className="empty-state py-10">
            <span className="text-4xl mb-3">📁</span>
            <p className="text-slate-500 text-sm">Henüz belge yüklenmedi</p>
          </div>
        ) : (
          <div className="table-container rounded-none border-0 border-t border-slate-100">
            <table className="table">
              <thead>
                <tr>
                  <th>Dosya Adı</th>
                  <th>Tür</th>
                  <th>Hassas</th>
                  <th className="hidden sm:table-cell">Tarih</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => (
                  <tr key={doc.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>📄</span>
                        <span className="font-medium text-slate-700 text-sm">{doc.originalFileName}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-reviewing">{doc.type}</span></td>
                    <td>
                      {doc.sensitive
                        ? <span className="text-amber-600 text-xs font-medium">🔒 Hassas</span>
                        : <span className="text-slate-400 text-xs">Açık</span>}
                    </td>
                    <td className="hidden sm:table-cell text-slate-400 text-xs">
                      {new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => hotelApi.viewDocument(doc.id)}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors font-medium">
                          Görüntüle
                        </button>
                        <button onClick={() => handleDelete(doc.id)} className="btn-danger">Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Overview Tab ── */
function OverviewTab({ user, applications, onTabChange }) {
  const accepted  = applications.filter(a => a.status === 'ACCEPTED').length
  const pending   = applications.filter(a => a.status === 'PENDING').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Başvuru',  value: applications.length, color: 'from-blue-500 to-blue-600',
            svg: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
          { label: 'Bekleyen', value: pending,              color: 'from-amber-500 to-amber-600',
            svg: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
          { label: 'Kabul',    value: accepted,             color: 'from-emerald-500 to-emerald-600',
            svg: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mx-auto mb-2`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.8} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={s.svg} />
              </svg>
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'İlanları Keşfet',  tab: 'listings',     desc: 'Aktif iş ilanlarına göz at',
            svg: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z' },
          { label: 'Başvurularım',     tab: 'applications', desc: 'Başvuru durumlarını takip et',
            svg: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
          { label: 'Belgelerim',       tab: 'documents',    desc: 'CV, transkript ve diğerleri',
            svg: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6 9 2.25 2.25L19.5 12m-9.75 9h9.75c.621 0 1.125-.504 1.125-1.125V11.25c0-3-3.375-9-9-9H4.875c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h5.25' },
        ].map(action => (
          <button key={action.tab} onClick={() => onTabChange(action.tab)}
            className="card text-left p-5 hover:border-violet-200 hover:-translate-y-0.5 transition-all duration-200 w-full">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.8} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={action.svg} />
              </svg>
            </div>
            <div className="font-semibold text-slate-800 text-sm">{action.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
          </button>
        ))}
      </div>

      {/* Recent applications */}
      {applications.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800">Son Başvurular</h2>
            <button onClick={() => onTabChange('applications')}
              className="text-xs font-medium" style={{ color: '#7c3aed' }}>Tümü →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {applications.slice(0, 3).map(app => (
              <div key={app.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">{app.listing?.title}</div>
                  <div className="text-xs text-slate-400">{app.listing?.businessName}</div>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Profile Tab ── */
function ProfileTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(null)
  const [profile, setProfile] = useState(null)  // readonly meta (email, role, isStudent)

  useEffect(() => {
    hotelApi.getCandidateProfile()
      .then(data => {
        setProfile(data)
        setForm({
          fullName:           data.fullName           || '',
          phone:              data.phone              || '',
          district:           data.district           || '',
          neighborhood:       data.neighborhood       || '',
          birthDate:          data.birthDate          || '',
          gender:             data.gender             || '',
          education:          data.education          || '',
          languages:          data.languages          || [],
          availabilityTypes:  data.availabilityTypes  || [],
          previousExperience: data.previousExperience || '',
          smokes:             data.smokes ?? null,
          hasLicense:         data.hasLicense ?? null,
          preferredDistricts: data.preferredDistricts || [],
          preferredPositions: data.preferredPositions || [],
        })
      })
      .catch(() => toast.error('Profil yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  // D7: Avatar upload/delete
  const [avatarUploading, setAvatarUploading] = useState(false)
  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    const MAX = 5 * 1024 * 1024
    if (file.size > MAX) {
      toast.error(`Foto çok büyük (${(file.size/1024/1024).toFixed(1)} MB). Maksimum 5 MB.`)
      e.target.value = ''; return
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!['jpg','jpeg','png','webp','heic','heif'].includes(ext)) {
      toast.error(`'.${ext}' desteklenmiyor. JPG/PNG/WEBP/HEIC kullanın.`)
      e.target.value = ''; return
    }

    setAvatarUploading(true)
    try {
      const updated = await hotelApi.uploadCandidateAvatar(file)
      setProfile(updated)
      toast.success('Profil fotoğrafı güncellendi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setAvatarUploading(false); e.target.value = '' }
  }

  async function handleAvatarDelete() {
    if (!confirm('Profil fotoğrafı silinsin mi?')) return
    try {
      await hotelApi.deleteCandidateAvatar()
      setProfile(prev => ({ ...prev, avatarUrl: null }))
      toast.success('Profil fotoğrafı silindi')
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function toggleSetField(field, value) {
    setForm(prev => {
      const has = prev[field].includes(value)
      return {
        ...prev,
        [field]: has ? prev[field].filter(x => x !== value) : [...prev[field], value],
      }
    })
  }

  function setTriState(field, raw) {
    setForm(prev => ({
      ...prev,
      [field]: raw === 'unknown' ? null : raw === 'yes',
    }))
  }

  const triValue = (v) => v === null || v === undefined ? 'unknown' : (v ? 'yes' : 'no')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fullName.trim()) return toast.error('Ad soyad zorunlu')

    // #74: Phone + yaş validation (backend ile aynı kurallar)
    const phoneError = validateTurkeyPhone(form.phone, { mobileOnly: true })
    if (phoneError) return toast.error(phoneError)
    const ageError = validateAdultAge(form.birthDate)
    if (ageError) return toast.error(ageError)

    setSaving(true)
    try {
      const payload = {
        fullName:           form.fullName.trim(),
        phone:              form.phone.trim() || null,
        district:           form.district || null,
        neighborhood:       form.neighborhood?.trim() || null,
        birthDate:          form.birthDate || null,
        gender:             form.gender || null,
        education:          form.education || null,
        languages:          form.languages,
        availabilityTypes:  form.availabilityTypes,
        previousExperience: form.previousExperience.trim() || null,
        smokes:             form.smokes,
        hasLicense:         form.hasLicense,
        preferredDistricts: form.preferredDistricts,
        preferredPositions: form.preferredPositions,
      }
      const data = await hotelApi.updateCandidateProfile(payload)
      setProfile(data)
      toast.success('Profil güncellendi!')
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>
  if (!form) return null

  return (
    <div className="space-y-5 max-w-3xl">
    {/* D7: Profil fotoğrafı — form'un dışında ayrı kart (kendi upload akışı) */}
    <div className="card p-5">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Profil Fotoğrafı</h3>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl text-slate-300">👤</span>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <label className={`block px-4 py-2 text-sm font-medium rounded-lg cursor-pointer text-center transition-colors
            ${avatarUploading
              ? 'bg-violet-50 text-violet-400 cursor-wait'
              : 'bg-violet-100 text-violet-700 hover:bg-violet-200'}`}>
            <input type="file" className="sr-only" accept="image/*,.heic,.heif"
              onChange={handleAvatarUpload} disabled={avatarUploading} />
            {avatarUploading
              ? '⏳ Yükleniyor...'
              : (profile?.avatarUrl ? '🔄 Fotoyu Değiştir' : '📷 Foto Yükle')}
          </label>
          {profile?.avatarUrl && (
            <button type="button" onClick={handleAvatarDelete}
              className="block w-full px-4 py-2 text-sm font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
              🗑 Fotoyu Kaldır
            </button>
          )}
          <p className="text-xs text-slate-400">Max 5 MB · JPG/PNG/WEBP/HEIC · Yüze odaklı 400x400 olarak kaydedilir</p>
        </div>
      </div>
    </div>

    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Block 1: Temel Bilgiler */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Temel Bilgiler</h3>

        <div>
          <label className="label">Ad Soyad *</label>
          <input type="text" name="fullName" value={form.fullName} onChange={handleChange} className="input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">E-posta <span className="text-slate-400 font-normal">(değiştirilemez)</span></label>
            <input type="email" value={profile?.email || ''} disabled
              className="input bg-slate-50 text-slate-500 cursor-not-allowed" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input type="tel" name="phone" value={form.phone} maxLength={14}
              onChange={e => setForm(prev => ({ ...prev, phone: formatTurkeyPhoneInput(e.target.value) }))}
              className="input" placeholder="0555 123 45 67" />
          </div>
        </div>

        {/* İlçe + Mahalle (cascading) */}
        <DistrictNeighborhoodSelect
          district={form.district}
          neighborhood={form.neighborhood}
          onChange={({ district, neighborhood }) =>
            setForm(prev => ({ ...prev, district, neighborhood }))
          } />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Doğum Tarihi <span className="text-slate-400 font-normal text-[10px]">(16-65 yaş)</span></label>
            <input type="date" name="birthDate" value={form.birthDate} onChange={handleChange}
              {...birthDateBounds()} className="input" />
          </div>
          <div>
            <label className="label">Cinsiyet</label>
            <select name="gender" value={form.gender} onChange={handleChange} className="input">
              <option value="">Belirtmedim</option>
              {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Block 2: Eğitim */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Eğitim</h3>

        <div>
          <label className="label">Eğitim Durumu <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
          <select name="education" value={form.education} onChange={handleChange} className="input">
            <option value="">Seçin</option>
            {Object.entries(EDUCATION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Block 3: İş Tercihleri */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">İş Tercihleri</h3>

        <div>
          <label className="label">Müsaitlik Türü <span className="text-slate-400 font-normal">(birden fazla seçebilirsin)</span></label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(AVAILABILITY_LABELS).map(([key, label]) => {
              const active = form.availabilityTypes.includes(key)
              return (
                <button key={key} type="button" onClick={() => toggleSetField('availabilityTypes', key)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all
                    ${active
                      ? 'border-violet-400 bg-violet-50 text-violet-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="label">Önceki Deneyim <span className="text-slate-400 font-normal">(opsiyonel)</span></label>
          <textarea name="previousExperience" value={form.previousExperience} onChange={handleChange}
            className="input resize-none h-24 text-sm"
            placeholder="Daha önce çalıştığın yerler, pozisyonlar, kazandığın deneyimler..." />
        </div>
      </div>

      {/* Block 4: Diğer */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Diğer</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Ehliyet</label>
            <select value={triValue(form.hasLicense)} onChange={e => setTriState('hasLicense', e.target.value)} className="input">
              <option value="unknown">Belirtmedim</option>
              <option value="yes">Var</option>
              <option value="no">Yok</option>
            </select>
          </div>
        </div>
      </div>

      {/* ADIM J: Bildirim tercihleri — ilgilendiği ilçeler + pozisyonlar */}
      <div className="card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Bildirim Tercihleri</h3>
          <p className="text-xs text-slate-500 mt-1">
            🎯 İlgini çekebilecek yeni ilan açıldığında otomatik bildirim al. Hiçbirini seçmezsen bildirim yok.
          </p>
        </div>

        <div>
          <label className="label">İlgilendiğin İlçeler</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded-lg">
            {ISTANBUL_DISTRICTS.map(d => {
              const active = form.preferredDistricts.includes(d)
              return (
                <label key={d}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer
                    ${active ? 'bg-violet-50 text-violet-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={active}
                    onChange={() => toggleSetField('preferredDistricts', d)}
                    className="w-3.5 h-3.5 accent-violet-600" />
                  {d}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 mt-1">{form.preferredDistricts.length} ilçe seçili</p>
        </div>

        <div>
          <label className="label">İlgilendiğin Pozisyonlar</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(POSITION_LABELS).map(([value, label]) => {
              const active = form.preferredPositions.includes(value)
              return (
                <label key={value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm
                    ${active ? 'border-violet-400 bg-violet-50 text-violet-700 font-medium' : 'border-slate-200 hover:border-violet-300'}`}>
                  <input type="checkbox" checked={active}
                    onChange={() => toggleSetField('preferredPositions', value)}
                    className="w-4 h-4 accent-violet-600" />
                  {label}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 mt-1">{form.preferredPositions.length} pozisyon seçili</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={saving}
          className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg transition-all disabled:opacity-60 hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 3px 12px rgba(124,58,237,0.3)' }}>
          {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>
    </form>

    {/* D3: Şifre Değiştir — ayrı form, profil form'unun dışında */}
    <ChangePasswordCard />
    </div>
  )
}

/* ── Main Dashboard ── */
export default function CandidateDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = useCallback(async () => {
    try {
      const data = await hotelApi.getMyApplications()
      // #84: Backend artık PageResponse döner → içeriği çıkar
      setApplications(Array.isArray(data) ? data : (data?.content ?? []))
    } catch {
      // Fail silently on overview — errors shown per-tab
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApplications() }, [fetchApplications])

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="spinner"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview'      && <OverviewTab user={user} applications={applications} onTabChange={setActiveTab} />}
          {activeTab === 'listings'      && <ListingsPage onApplicationSubmitted={fetchApplications} />}
          {activeTab === 'applications'  && <ApplicationsTab applications={applications} onRefresh={fetchApplications} onOpenMessages={() => setActiveTab('messages')} />}
          {activeTab === 'messages'      && <MessagesPage />}
          {activeTab === 'documents'     && <DocumentsTab />}
          {activeTab === 'profile'       && <ProfileTab />}
        </>
      )}
    </DashboardLayout>
  )
}
