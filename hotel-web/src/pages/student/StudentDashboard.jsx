import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import HotelsPage from './HotelsPage'

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const map = {
    PENDING:   { cls: 'badge-pending',   icon: '⏳', label: 'Bekliyor' },
    REVIEWING: { cls: 'badge-reviewing', icon: '🔍', label: 'İnceleniyor' },
    ACCEPTED:  { cls: 'badge-accepted',  icon: '✅', label: 'Kabul' },
    REJECTED:  { cls: 'badge-rejected',  icon: '❌', label: 'Red' },
    EXPIRED:   { cls: 'badge-expired',   icon: '⌛', label: 'Süresi Doldu' },
  }
  const s = map[status] || { cls: 'badge-pending', icon: '?', label: status }
  return <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>
}


/* ── Applications Tab ── */
function ApplicationsTab({ applications }) {
  return (
    <div className="space-y-4">
      {applications.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <span className="text-4xl mb-3">📋</span>
            <p className="font-medium text-slate-700">Henüz başvurunuz yok</p>
            <p className="text-sm text-slate-500 mt-1">Otel listesinden bir otele başvurun</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map(app => (
            <div key={app.id} className="card">
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600
                                 flex items-center justify-center text-white text-xl flex-shrink-0">
                    🏨
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800">{app.hotel?.hotelName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{app.hotel?.email}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      {new Date(app.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })}
                    </div>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </div>

              {app.hotelNote && (
                <div className="px-4 pb-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
                    <span className="font-medium">Otel Notu:</span> {app.hotelNote}
                  </div>
                </div>
              )}

              {/* Belge Talepleri */}
              {app.documentRequests?.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Belge Talepleri</div>
                  <div className="space-y-2">
                    {app.documentRequests.map(dr => (
                      <div key={dr.id} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                        <span className="text-sm text-slate-700">{dr.documentType}</span>
                        <span className={`badge text-xs ${
                          dr.status === 'PENDING' ? 'badge-pending' :
                          dr.status === 'GRANTED' ? 'badge-accepted' : 'badge-rejected'
                        }`}>{dr.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
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
    } catch(e) {
      toast.error('Belgeler yüklenemedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await hotelApi.uploadDocument(file, selectedType)
      toast.success('Belge yüklendi ✅')
      fetchDocs()
    } catch(e) { toast.error(extractErrorMessage(e)) }
    finally { setUploading(false); e.target.value = '' }
  }

  async function handleDelete(docId) {
    if (!confirm('Belge silinsin mi?')) return
    try {
      await hotelApi.deleteDocument(docId)
      toast.success('Belge silindi')
      fetchDocs()
    } catch(e) { toast.error(extractErrorMessage(e)) }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner"></div></div>

  return (
    <div className="space-y-4">
      {/* Upload Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800">Belge Yükle</h2>
        </div>
        <div className="card-body">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
              className="input sm:w-48 flex-shrink-0">
              {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              border-2 border-dashed cursor-pointer text-sm font-medium transition-colors
              ${uploading
                ? 'border-blue-300 bg-blue-50 text-blue-400 cursor-wait'
                : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-600 hover:text-blue-600'}`}>
              <input type="file" className="sr-only" onChange={handleUpload} disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"/>
              {uploading ? '⏳ Yükleniyor...' : '📎 Dosya Seç (PDF, JPEG, PNG, DOC)'}
            </label>
          </div>
        </div>
      </div>

      {/* Documents List */}
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
                        <span className="text-lg">📄</span>
                        <span className="font-medium text-slate-700 text-sm">{doc.originalFileName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-reviewing">{doc.type}</span>
                    </td>
                    <td>
                      {doc.sensitive ? (
                        <span className="text-amber-600 text-xs font-medium">🔒 Hassas</span>
                      ) : (
                        <span className="text-slate-400 text-xs">Açık</span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell text-slate-400 text-xs">
                      {new Date(doc.uploadedAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td>
                      <button onClick={() => handleDelete(doc.id)} className="btn-danger">
                        Sil
                      </button>
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
  const reviewing = applications.filter(a => a.status === 'REVIEWING').length

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 60%, #7c3aed 100%)' }}>
        <div className="relative z-10">
          <div className="text-3xl mb-3">👋</div>
          <h2 className="text-xl font-bold">Hoş geldin, {user?.fullName?.split(' ')[0]}!</h2>
          <p className="text-blue-200 text-sm mt-1">
            {user?.university} · {user?.department}
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 text-9xl opacity-10 select-none">🎓</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Başvuru',     value: applications.length, icon: '📋', color: 'from-blue-500 to-blue-600' },
          { label: 'Bekleyen',    value: pending,             icon: '⏳', color: 'from-amber-500 to-amber-600' },
          { label: 'Kabul',       value: accepted,            icon: '✅', color: 'from-emerald-500 to-emerald-600' },
        ].map(s => (
          <div key={s.label} className="stat-card text-center">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl mx-auto mb-2`}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Otellere Göz At',   icon: '🏨', tab: 'hotels',        desc: 'Staj yapabileceğin otelleri keşfet' },
          { label: 'Başvurularım',       icon: '📋', tab: 'applications',  desc: 'Başvuru durumlarını takip et' },
          { label: 'Belgelerim',         icon: '📁', tab: 'documents',     desc: 'CV, transkript ve diğerleri' },
        ].map(action => (
          <button key={action.tab} onClick={() => onTabChange(action.tab)}
            className="card text-left p-5 hover:border-blue-200 hover:-translate-y-0.5 active:scale-98 transition-all duration-200 w-full">
            <div className="text-2xl mb-3">{action.icon}</div>
            <div className="font-semibold text-slate-800 text-sm">{action.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{action.desc}</div>
          </button>
        ))}
      </div>

      {/* Recent applications preview */}
      {applications.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800">Son Başvurular</h2>
            <button onClick={() => onTabChange('applications')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium">Tümü →</button>
          </div>
          <div className="divide-y divide-slate-50">
            {applications.slice(0, 3).map(app => (
              <div key={app.id} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">{app.hotel?.hotelName}</div>
                  <div className="text-xs text-slate-400">{new Date(app.createdAt).toLocaleDateString('tr-TR')}</div>
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

/* ── Main Dashboard ── */
export default function StudentDashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('overview')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = useCallback(async () => {
    try {
      const data = await hotelApi.getMyApplications()
      setApplications(data)
    } catch(e) {
      // Hata durumunda sessizce devam et
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
          {activeTab === 'overview' && (
            <OverviewTab user={user} applications={applications} onTabChange={setActiveTab} />
          )}
          {activeTab === 'hotels' && (
            <HotelsPage onApplicationSubmitted={fetchApplications} />
          )}
          {activeTab === 'applications' && (
            <ApplicationsTab applications={applications} />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab />
          )}
        </>
      )}
    </DashboardLayout>
  )
}
