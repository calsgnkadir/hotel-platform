import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'

/* ── Inline SVG helper (Heroicons stroke stili) ── */
function Icon({ d, className = 'w-4 h-4', strokeWidth = 2 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
         strokeWidth={strokeWidth} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

// Sık kullanılan ikon path'leri
const ICONS = {
  search:   'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  check:    'm4.5 12.75 6 6 9-13.5',
  xmark:    'M6 18 18 6M6 6l12 12',
  ban:      'm5.636 5.636 12.728 12.728M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  bolt:     'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
  doc:      'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  user:     'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
  cpuChip:  'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z',
  bulb:     'M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.354a14.4 14.4 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18',
  checkCircle: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
}

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
    { label: 'Toplam Kullanıcı', value: stats.totalUsers,         color: 'from-blue-500 to-blue-600',
      svg: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' },
    { label: 'Aday',             value: stats.candidates,         color: 'from-brand-600 to-brand-700',
      svg: 'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' },
    { label: 'İşletme',          value: stats.businessOwners,     color: 'from-emerald-500 to-emerald-600',
      svg: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
    { label: 'Admin',            value: stats.admins,             color: 'from-amber-500 to-amber-600',
      svg: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z' },
    { label: 'Banlı',            value: stats.bannedUsers,        color: 'from-red-500 to-red-600',
      svg: 'M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636' },
    { label: 'İşletme Kayıtlı',  value: stats.totalBusinesses,    color: 'from-cyan-500 to-cyan-600',
      svg: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z' },
    { label: 'Toplam İlan',      value: stats.totalListings,      color: 'from-pink-500 to-pink-600',
      svg: 'M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z' },
    { label: 'Toplam Başvuru',   value: stats.totalApplications,  color: 'from-indigo-500 to-indigo-600',
      svg: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   strokeWidth={1.8} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={c.svg} />
              </svg>
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
                : isCandidate ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
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
                  className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                  <Icon d={ICONS.check} className="w-4 h-4" /> Banı Kaldır
                </button>
              ) : (
                <div className="flex gap-2">
                  <input type="number" value={banDays} onChange={e => setBanDays(parseInt(e.target.value) || 1)}
                    min="1" max="365" className="input text-sm w-24" />
                  <button onClick={handleBan} disabled={actionLoading}
                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
                    <Icon d={ICONS.ban} className="w-4 h-4" /> {banDays} Gün Banla
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
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
              style={roleFilter === f.value ? { background: '#047857' } : {}}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Icon d={ICONS.search} className="w-4 h-4" />
          </span>
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
            <Icon d={ICONS.search} className="w-10 h-10 text-slate-300 mb-3" strokeWidth={1.5} />
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
                        : u.role === 'CANDIDATE' ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
                        : 'bg-emerald-100 text-emerald-700'}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="hidden md:table-cell text-sm">{u.strikesRemaining ?? '—'}</td>
                  <td>
                    {u.currentlyBanned ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 inline-flex items-center gap-1">
                        <Icon d={ICONS.ban} className="w-3 h-3" /> Banlı
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
                      className="text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-900/60 transition-colors">
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
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
            style={statusFilter === f.value ? { background: '#047857' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <Icon d={ICONS.checkCircle} className="w-10 h-10 text-emerald-400 mb-3" strokeWidth={1.5} />
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
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 disabled:opacity-50 inline-flex items-center gap-1">
                        <Icon d={ICONS.check} className="w-3.5 h-3.5" /> Çözüldü
                      </button>
                      <button onClick={() => handleStatus(r.id, 'DISMISSED')} disabled={actionId === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50 inline-flex items-center gap-1">
                        <Icon d={ICONS.xmark} className="w-3.5 h-3.5" /> Reddet
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2 inline-flex items-center gap-1">
                  <Icon d={ICONS.bulb} className="w-3.5 h-3.5 flex-shrink-0" />
                  İşlem için: Kullanıcılar sekmesinden ilgili kullanıcıyı bulup banlayabilirsin.
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Audit Log Tab (D4) ── */
const ACTION_META = {
  BAN_USER:       { path: ICONS.ban,     label: 'Kullanıcı banlandı',  cls: 'bg-red-50 text-red-700' },
  UNBAN_USER:     { path: ICONS.check,   label: 'Ban kaldırıldı',      cls: 'bg-emerald-50 text-emerald-700' },
  MARK_NO_SHOW:   { path: ICONS.ban,     label: 'No-show işaretlendi',  cls: 'bg-amber-50 text-amber-700' },
  AUTO_BAN:       { path: ICONS.bolt,    label: 'Otomatik ban',         cls: 'bg-red-50 text-red-700' },
  RESOLVE_REPORT: { path: ICONS.check,   label: 'Şikayet çözüldü',      cls: 'bg-emerald-50 text-emerald-700' },
  DISMISS_REPORT: { path: ICONS.xmark,   label: 'Şikayet reddedildi',   cls: 'bg-slate-100 text-slate-500' },
}
const AUDIT_FILTERS = [
  { value: '',             label: 'Tümü' },
  { value: 'BAN_USER',     label: 'Banlar' },
  { value: 'AUTO_BAN',     label: 'Otomatik ban' },
  { value: 'MARK_NO_SHOW', label: 'No-show' },
  { value: 'RESOLVE_REPORT', label: 'Şikayet işlem' },
]

function AuditTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')

  const fetchLogs = useCallback(() => {
    setLoading(true)
    hotelApi.adminListAuditLogs(actionFilter || undefined, 100)
      .then(setLogs)
      .catch(() => toast.error('İşlem geçmişi yüklenemedi'))
      .finally(() => setLoading(false))
  }, [actionFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {AUDIT_FILTERS.map(f => (
          <button key={f.value} onClick={() => setActionFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all
              ${actionFilter === f.value
                ? 'text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
            style={actionFilter === f.value ? { background: '#047857' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <Icon d={ICONS.doc} className="w-10 h-10 text-slate-300 mb-3" strokeWidth={1.5} />
            <p className="text-slate-500 text-sm">Henüz işlem kaydı yok</p>
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-slate-50">
          {logs.map(l => {
            const m = ACTION_META[l.action] || { path: ICONS.doc, label: l.action, cls: 'bg-slate-100 text-slate-600' }
            const isSystem = l.actorEmail === 'SYSTEM'
            return (
              <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1 ${m.cls}`}>
                  <Icon d={m.path} className="w-3.5 h-3.5" /> {m.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700">{l.details}</div>
                  <div className="text-xs text-slate-400 mt-0.5 inline-flex items-center gap-1">
                    <Icon d={isSystem ? ICONS.cpuChip : ICONS.user} className="w-3.5 h-3.5" />
                    {isSystem ? 'Sistem' : l.actorEmail}
                    {' · '}
                    {new Date(l.createdAt).toLocaleString('tr-TR')}
                  </div>
                </div>
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
      {activeTab === 'audit'    && <AuditTab />}
    </DashboardLayout>
  )
}
