import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'

/* ── Status Badge ── */
function StatusBadge({ status }) {
  const map = {
    PENDING:   { cls: 'badge-pending',   icon: '⏳', label: 'Bekliyor' },
    REVIEWING: { cls: 'badge-reviewing', icon: '🔍', label: 'İnceleniyor' },
    ACCEPTED:  { cls: 'badge-accepted',  icon: '✅', label: 'Kabul Edildi' },
    REJECTED:  { cls: 'badge-rejected',  icon: '❌', label: 'Reddedildi' },
    EXPIRED:   { cls: 'badge-expired',   icon: '⌛', label: 'Süresi Doldu' },
  }
  const s = map[status] || { cls: 'badge-pending', icon: '?', label: status }
  return <span className={`badge ${s.cls}`}>{s.icon} {s.label}</span>
}

/* ── Overview Tab ── */
function OverviewTab({ applications, onTabChange }) {
  const pending   = applications.filter(a => a.status === 'PENDING').length
  const reviewing = applications.filter(a => a.status === 'REVIEWING').length
  const accepted  = applications.filter(a => a.status === 'ACCEPTED').length
  const total     = applications.length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Başvuru', value: total,     color: 'from-blue-500 to-blue-600', icon: '📋' },
          { label: 'Bekleyen',       value: pending,   color: 'from-amber-500 to-amber-600', icon: '⏳' },
          { label: 'İnceleniyor',    value: reviewing, color: 'from-indigo-500 to-indigo-600', icon: '🔍' },
          { label: 'Kabul Edildi',   value: accepted,  color: 'from-emerald-500 to-emerald-600', icon: '✅' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl mb-3`}>
              {s.icon}
            </div>
            <div className="text-2xl font-bold text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent Applications */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800">Son Başvurular</h2>
          <button onClick={() => onTabChange('applications')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium">
            Tümünü Gör →
          </button>
        </div>
        {applications.length === 0 ? (
          <div className="empty-state">
            <span className="text-4xl mb-3">📭</span>
            <p className="text-slate-500 text-sm">Henüz başvuru yok</p>
          </div>
        ) : (
          <div className="table-container rounded-none border-0 border-t border-slate-100">
            <table className="table">
              <thead>
                <tr>
                  <th>Öğrenci</th>
                  <th className="hidden md:table-cell">Üniversite</th>
                  <th>Durum</th>
                  <th className="hidden sm:table-cell">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 5).map(app => (
                  <tr key={app.id}>
                    <td>
                      <div className="font-medium text-slate-800">{app.student?.fullName}</div>
                      <div className="text-xs text-slate-400">{app.student?.email}</div>
                    </td>
                    <td className="hidden md:table-cell text-slate-600">{app.student?.university}</td>
                    <td><StatusBadge status={app.status} /></td>
                    <td className="hidden sm:table-cell text-slate-500 text-xs">
                      {new Date(app.createdAt).toLocaleDateString('tr-TR')}
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

/* ── Applications Tab ── */
function ApplicationsTab({ applications, onRefresh }) {
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [note, setNote] = useState('')

  const filtered = filter === 'ALL' ? applications
    : applications.filter(a => a.status === filter)

  async function handleReview(appId) {
    setActionLoading(true)
    try {
      await hotelApi.startReview(appId)
      toast.success('Başvuru incelemeye alındı')
      onRefresh()
    } catch(e) { toast.error(extractErrorMessage(e)) }
    finally { setActionLoading(false) }
  }

  async function handleDecision(appId, decision) {
    setActionLoading(true)
    try {
      await hotelApi.reviewApplication(appId, decision, note)
      toast.success(decision === 'ACCEPTED' ? 'Başvuru kabul edildi ✅' : 'Başvuru reddedildi')
      setSelected(null)
      setNote('')
      onRefresh()
    } catch(e) { toast.error(extractErrorMessage(e)) }
    finally { setActionLoading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Filter Pills */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'PENDING', 'REVIEWING', 'ACCEPTED', 'REJECTED'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-150
              ${filter === f
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'}`}>
            {f === 'ALL' ? `Tümü (${applications.length})`
              : f === 'PENDING'   ? `Bekleyen (${applications.filter(a=>a.status==='PENDING').length})`
              : f === 'REVIEWING' ? `İnceleniyor (${applications.filter(a=>a.status==='REVIEWING').length})`
              : f === 'ACCEPTED'  ? `Kabul (${applications.filter(a=>a.status==='ACCEPTED').length})`
              : `Red (${applications.filter(a=>a.status==='REJECTED').length})`}
          </button>
        ))}
      </div>

      {/* Applications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-slate-500 text-sm">Bu filtreye uyan başvuru yok</p>
            </div>
          </div>
        ) : filtered.map(app => (
          <div key={app.id} className="card hover:border-blue-200 cursor-pointer transition-all"
               onClick={() => setSelected(app)}>
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-600
                               flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {app.student?.fullName?.charAt(0) || '?'}
                </div>
                <div>
                  <div className="font-semibold text-slate-800">{app.student?.fullName}</div>
                  <div className="text-xs text-slate-500">{app.student?.university} · {app.student?.department}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {new Date(app.createdAt).toLocaleDateString('tr-TR', { day:'numeric', month:'long', year:'numeric' })}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <StatusBadge status={app.status} />
                {app.status === 'PENDING' && (
                  <button onClick={e => { e.stopPropagation(); handleReview(app.id) }}
                    disabled={actionLoading}
                    className="btn-sm bg-blue-600 text-white hover:bg-blue-700">
                    İncelemeye Al
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selected.student?.fullName}</h2>
                  <p className="text-sm text-slate-500">{selected.student?.email}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Öğrenci Bilgileri</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Üniversite</div>
                    <div className="text-sm font-medium text-slate-700">{selected.student?.university || '—'}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <div className="text-xs text-slate-400">Bölüm</div>
                    <div className="text-sm font-medium text-slate-700">{selected.student?.department || '—'}</div>
                  </div>
                </div>
              </div>

              {selected.coverLetter && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Ön Yazı</h3>
                  <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
                    {selected.coverLetter}
                  </div>
                </div>
              )}

              {selected.availabilities?.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Müsaitlik Saatleri</h3>
                  <div className="flex flex-wrap gap-2">
                    {selected.availabilities.map((av, i) => (
                      <span key={i} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg border border-blue-200">
                        {av.dayOfWeek} · {av.startTime}–{av.endTime}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selected.hotelNote && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Otel Notu</h3>
                  <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-700 border border-amber-200">
                    {selected.hotelNote}
                  </div>
                </div>
              )}

              {/* Karar Verme (REVIEWING durumunda) */}
              {selected.status === 'REVIEWING' && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Karar Ver</h3>
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    className="input resize-none h-20 text-sm"
                    placeholder="Öğrenciye iletilecek not (opsiyonel)..."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleDecision(selected.id, 'ACCEPTED')}
                      disabled={actionLoading}
                      className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                      ✅ Kabul Et
                    </button>
                    <button onClick={() => handleDecision(selected.id, 'REJECTED')}
                      disabled={actionLoading}
                      className="py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors">
                      ❌ Reddet
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 pb-5">
              <button onClick={() => setSelected(null)}
                className="btn-secondary text-sm">
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Main Dashboard ── */
export default function HotelDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchApplications = useCallback(async () => {
    try {
      const data = await hotelApi.getHotelApplications()
      setApplications(data)
    } catch(e) {
      toast.error('Başvurular yüklenemedi')
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
            <OverviewTab applications={applications} onTabChange={setActiveTab} />
          )}
          {activeTab === 'applications' && (
            <ApplicationsTab applications={applications} onRefresh={fetchApplications} />
          )}
          {activeTab === 'documents' && (
            <div className="card">
              <div className="card-body empty-state">
                <span className="text-4xl mb-3">📁</span>
                <p className="font-medium text-slate-700">Belge Yönetimi</p>
                <p className="text-sm text-slate-500 mt-1">Başvurudan belge talebinde bulunabilirsiniz</p>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
