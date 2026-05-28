import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'

const ROLE_LABELS = {
  CANDIDATE: 'Aday',
  BUSINESS_OWNER: 'İşletme',
  ADMIN: 'Admin',
}

const ROLE_FILTERS = [
  { value: '',                 label: 'Tümü' },
  { value: 'CANDIDATE',        label: 'Adaylar' },
  { value: 'BUSINESS_OWNER',   label: 'İşletmeler' },
  { value: 'ADMIN',            label: 'Adminler' },
]

/* ── Overview Tab ── */
function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hotelApi.adminGetStats()
      .then(setStats)
      .catch(() => toast.error('İstatistikler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><div className="spinner" /></div>
  if (!stats) return null

  const cards = [
    { label: 'Toplam Kullanıcı', value: stats.totalUsers,         color: 'from-blue-500 to-blue-600',     icon: '👥' },
    { label: 'Aday',             value: stats.candidates,         color: 'from-violet-500 to-violet-600', icon: '💼' },
    { label: 'İşletme',          value: stats.businessOwners,     color: 'from-emerald-500 to-emerald-600', icon: '🏢' },
    { label: 'Admin',            value: stats.admins,             color: 'from-amber-500 to-amber-600',   icon: '🛡' },
    { label: 'Banlı',            value: stats.bannedUsers,        color: 'from-red-500 to-red-600',       icon: '🚫' },
    { label: 'İşletme Kayıtlı',  value: stats.totalBusinesses,    color: 'from-cyan-500 to-cyan-600',     icon: '🏨' },
    { label: 'Toplam İlan',      value: stats.totalListings,      color: 'from-pink-500 to-pink-600',     icon: '📌' },
    { label: 'Toplam Başvuru',   value: stats.totalApplications,  color: 'from-indigo-500 to-indigo-600', icon: '📋' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-xl mb-3`}>
              {c.icon}
            </div>
            <div className="text-2xl font-bold text-slate-900">{c.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── User Detail Modal ── */
function UserDetailModal({ user, onClose, onUpdated }) {
  const [actionLoading, setActionLoading] = useState(false)
  const [banDays, setBanDays] = useState(30)

  async function handleApproveStudent(approved) {
    setActionLoading(true)
    try {
      const updated = await hotelApi.adminSetStudentStatus(user.id, approved)
      toast.success(approved ? 'Öğrenci onaylandı' : 'Öğrenci onayı kaldırıldı')
      onUpdated(updated)
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleBan() {
    if (!confirm(`Bu kullanıcı ${banDays} gün banlanacak. Devam edilsin mi?`)) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.adminBanUser(user.id, banDays)
      toast.success(`Kullanıcı ${banDays} gün banlandı`)
      onUpdated(updated)
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleUnban() {
    setActionLoading(true)
    try {
      const updated = await hotelApi.adminUnbanUser(user.id)
      toast.success('Ban kaldırıldı')
      onUpdated(updated)
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  const isCandidate = user.role === 'CANDIDATE'
  const isAdmin = user.role === 'ADMIN'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{user.fullName}</h2>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full
              ${isAdmin ? 'bg-amber-100 text-amber-700'
                : isCandidate ? 'bg-violet-100 text-violet-700'
                : 'bg-emerald-100 text-emerald-700'}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Key facts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500">Strike Hakkı</div>
              <div className="text-sm font-semibold mt-0.5">{user.strikesRemaining ?? '—'}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500">İlçe</div>
              <div className="text-sm font-semibold mt-0.5">{user.district || '—'}</div>
            </div>
            {isCandidate && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-500">Başvuru</div>
                <div className="text-sm font-semibold mt-0.5">{user.applicationCount ?? 0}</div>
              </div>
            )}
            {user.role === 'BUSINESS_OWNER' && (
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <div className="text-xs text-slate-500">İlan</div>
                <div className="text-sm font-semibold mt-0.5">{user.listingCount ?? 0}</div>
              </div>
            )}
            <div className={`rounded-lg p-3 text-center ${user.currentlyBanned ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <div className={`text-xs ${user.currentlyBanned ? 'text-red-600' : 'text-emerald-600'}`}>Durum</div>
              <div className={`text-sm font-semibold mt-0.5 ${user.currentlyBanned ? 'text-red-700' : 'text-emerald-700'}`}>
                {user.currentlyBanned ? 'Banlı' : 'Aktif'}
              </div>
            </div>
          </div>

          {/* Banned info */}
          {user.currentlyBanned && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              Ban bitiş: {new Date(user.bannedUntil).toLocaleString('tr-TR')}
            </div>
          )}

          {/* Ban yönetimi — admin değilse */}
          {!isAdmin && (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ban Yönetimi</h3>
              {user.currentlyBanned ? (
                <button onClick={handleUnban} disabled={actionLoading}
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">
                  ✓ Banı Kaldır
                </button>
              ) : (
                <div className="flex gap-2">
                  <input type="number" value={banDays} onChange={e => setBanDays(parseInt(e.target.value) || 1)}
                    min="1" max="365" className="input text-sm w-24" />
                  <button onClick={handleBan} disabled={actionLoading}
                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50">
                    🚫 {banDays} Gün Banla
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Meta */}
          <div className="border-t border-slate-100 pt-3 text-xs text-slate-400">
            Kayıt: {user.createdAt ? new Date(user.createdAt).toLocaleString('tr-TR') : '—'} · ID: {user.id}
          </div>
        </div>

        <div className="px-6 pb-5">
          <button onClick={onClose} className="btn-secondary text-sm">Kapat</button>
        </div>
      </div>
    </div>
  )
}

/* ── Users Tab ── */
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selected, setSelected] = useState(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const fetchUsers = useCallback(() => {
    setLoading(true)
    hotelApi.adminListUsers(roleFilter || undefined, debouncedSearch || undefined)
      .then(setUsers)
      .catch(() => toast.error('Kullanıcılar yüklenemedi'))
      .finally(() => setLoading(false))
  }, [roleFilter, debouncedSearch])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function openDetail(userSummary) {
    try {
      const full = await hotelApi.adminGetUser(userSummary.id)
      setSelected(full)
    } catch (err) { toast.error(extractErrorMessage(err)) }
  }

  function handleUpdated(updatedSummary) {
    // Detail modal refresh — selected'ı update et + listede de güncelle
    setSelected(prev => prev ? { ...prev, ...updatedSummary } : null)
    setUsers(prev => prev.map(u => u.id === updatedSummary.id ? { ...u, ...updatedSummary } : u))
  }

  return (
    <div className="space-y-4">
      {/* Filtre + arama */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {ROLE_FILTERS.map(f => (
            <button key={f.value} onClick={() => setRoleFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${roleFilter === f.value
                  ? 'text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'}`}
              style={roleFilter === f.value ? { background: 'linear-gradient(135deg, #7c3aed, #2563eb)' } : {}}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Email veya isim ara..." className="input pl-9 text-sm" />
        </div>
      </div>

      {/* User table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : users.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <span className="text-4xl mb-3">🔎</span>
            <p className="text-slate-500 text-sm">Eşleşen kullanıcı yok</p>
          </div>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Rol</th>
                <th className="hidden md:table-cell">Strike</th>
                <th>Durum</th>
                <th className="hidden sm:table-cell">Kayıt</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium text-slate-800">{u.fullName}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700'
                        : u.role === 'CANDIDATE' ? 'bg-violet-100 text-violet-700'
                        : 'bg-emerald-100 text-emerald-700'}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="hidden md:table-cell text-sm">{u.strikesRemaining ?? '—'}</td>
                  <td>
                    {u.currentlyBanned ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        🚫 Banlı
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell text-xs text-slate-400">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td>
                    <button onClick={() => openDetail(u)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-md bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors">
                      Yönet
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <UserDetailModal user={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </div>
  )
}

/* ── Reports Tab (D8) ── */
const REPORT_REASON_LABELS = {
  FAKE: 'Sahte', SPAM: 'Spam', SCAM: 'Dolandırıcılık',
  INAPPROPRIATE: 'Uygunsuz', HARASSMENT: 'Taciz', OTHER: 'Diğer',
}
const REPORT_TYPE_LABELS = { LISTING: 'İlan', BUSINESS: 'İşletme', USER: 'Kullanıcı' }
const REPORT_STATUS_META = {
  PENDING:   { cls: 'bg-amber-100 text-amber-700',     label: 'Bekliyor' },
  RESOLVED:  { cls: 'bg-emerald-100 text-emerald-700', label: 'Çözüldü' },
  DISMISSED: { cls: 'bg-slate-100 text-slate-500',     label: 'Reddedildi' },
}
const REPORT_FILTERS = [
  { value: '',          label: 'Tümü' },
  { value: 'PENDING',   label: 'Bekleyen' },
  { value: 'RESOLVED',  label: 'Çözülen' },
  { value: 'DISMISSED', label: 'Reddedilen' },
]

function ReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [actionId, setActionId] = useState(null)

  const fetchReports = useCallback(() => {
    setLoading(true)
    hotelApi.adminListReports(statusFilter || undefined)
      .then(setReports)
      .catch(() => toast.error('Şikayetler yüklenemedi'))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function handleStatus(id, status) {
    let adminNote = null
    if (status === 'DISMISSED') {
      adminNote = prompt('Neden reddediliyor? (opsiyonel)') || null
    }
    setActionId(id)
    try {
      await hotelApi.adminUpdateReportStatus(id, status, adminNote)
      toast.success(status === 'RESOLVED' ? 'Çözüldü olarak işaretlendi' : 'Reddedildi')
      fetchReports()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionId(null) }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {REPORT_FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
              ${statusFilter === f.value
                ? 'text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300'}`}
            style={statusFilter === f.value ? { background: 'linear-gradient(135deg, #7c3aed, #2563eb)' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <span className="text-4xl mb-3">✅</span>
            <p className="text-slate-500 text-sm">Şikayet yok</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const sm = REPORT_STATUS_META[r.status] || REPORT_STATUS_META.PENDING
            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {REPORT_TYPE_LABELS[r.targetType] || r.targetType} #{r.targetId}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                        {REPORT_REASON_LABELS[r.reason] || r.reason}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${sm.cls}`}>
                        {sm.label}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-sm text-slate-700 mt-2">{r.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5">
                      Şikayet eden: {r.reporterName} ({r.reporterEmail}) ·{' '}
                      {new Date(r.createdAt).toLocaleString('tr-TR')}
                    </p>
                    {r.adminNote && (
                      <p className="text-xs text-slate-500 mt-1 italic">Admin notu: {r.adminNote}</p>
                    )}
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleStatus(r.id, 'RESOLVED')} disabled={actionId === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50">
                        ✓ Çözüldü
                      </button>
                      <button onClick={() => handleStatus(r.id, 'DISMISSED')} disabled={actionId === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50">
                        ✕ Reddet
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  💡 İşlem için: Kullanıcılar sekmesinden ilgili kullanıcıyı bulup banlayabilirsin.
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Main Page ── */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'users'    && <UsersTab />}
      {activeTab === 'reports'  && <ReportsTab />}
    </DashboardLayout>
  )
}
