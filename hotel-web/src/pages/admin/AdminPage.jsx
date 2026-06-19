import { useState, useEffect, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
// Ayarlar + Yardım header'daki ⚙ SettingsMenu'ye taşındı

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

  // Kompakt stat strip — renkli SVG kutular kaldırıldı, sadece dot + label + sayı
  const cards = [
    { label: 'Toplam Kullanıcı', value: stats.totalUsers,        dot: 'bg-blue-400' },
    { label: 'Aday',             value: stats.candidates,        dot: 'bg-brand-400' },
    { label: 'İşletme',          value: stats.businessOwners,    dot: 'bg-brand-500' },
    { label: 'Admin',            value: stats.admins,            dot: 'bg-amber-400' },
    { label: 'Banlı',            value: stats.bannedUsers,       dot: 'bg-red-400' },
    { label: 'İşletme Kayıtlı',  value: stats.totalBusinesses,   dot: 'bg-cyan-400' },
    { label: 'Toplam İlan',      value: stats.totalListings,     dot: 'bg-pink-400' },
    { label: 'Toplam Başvuru',   value: stats.totalApplications, dot: 'bg-indigo-400' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {cards.map(c => (
          <div key={c.label} className="stat-card !p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
              <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold truncate">{c.label}</span>
            </div>
            <div className="text-xl font-black text-white leading-none">{c.value}</div>
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
        <div className="p-6 border-b border-cream-200 sticky top-0 bg-white z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink-900">{user.fullName}</h2>
              <p className="text-sm text-ink-500">{user.email}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full
              ${isAdmin ? 'bg-amber-100 text-amber-700'
                : isCandidate ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700'
                : 'bg-emerald-100 text-brand-700'}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Key facts */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-cream-50 rounded-lg p-3 text-center">
              <div className="text-xs text-ink-500">Strike Hakkı</div>
              <div className="text-sm font-semibold mt-0.5">{user.strikesRemaining ?? '—'}</div>
            </div>
            <div className="bg-cream-50 rounded-lg p-3 text-center">
              <div className="text-xs text-ink-500">İlçe</div>
              <div className="text-sm font-semibold mt-0.5">{user.district || '—'}</div>
            </div>
            {isCandidate && (
              <div className="bg-cream-50 rounded-lg p-3 text-center">
                <div className="text-xs text-ink-500">Başvuru</div>
                <div className="text-sm font-semibold mt-0.5">{user.applicationCount ?? 0}</div>
              </div>
            )}
            {user.role === 'BUSINESS_OWNER' && (
              <div className="bg-cream-50 rounded-lg p-3 text-center">
                <div className="text-xs text-ink-500">İlan</div>
                <div className="text-sm font-semibold mt-0.5">{user.listingCount ?? 0}</div>
              </div>
            )}
            <div className={`rounded-lg p-3 text-center ${user.currentlyBanned ? 'bg-red-50' : 'bg-brand-50'}`}>
              <div className={`text-xs ${user.currentlyBanned ? 'text-red-600' : 'text-brand-700'}`}>Durum</div>
              <div className={`text-sm font-semibold mt-0.5 ${user.currentlyBanned ? 'text-red-700' : 'text-brand-700'}`}>
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
            <div className="border-t border-cream-200 pt-4">
              <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Ban Yönetimi</h3>
              {user.currentlyBanned ? (
                <button onClick={handleUnban} disabled={actionLoading}
                  className="w-full py-2.5 rounded-lg bg-brand-700 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
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
          <div className="border-t border-cream-200 pt-3 text-xs text-ink-400">
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
                  : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
              style={roleFilter === f.value ? { background: 'linear-gradient(135deg, #1e3a5f, #234a82)' } : {}}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none">
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
            <Icon d={ICONS.search} className="w-10 h-10 text-ink-300 mb-3" strokeWidth={1.5} />
            <p className="text-ink-500 text-sm">Eşleşen kullanıcı yok</p>
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
                    <div className="font-medium text-ink-800">{u.fullName}</div>
                    <div className="text-xs text-ink-400">{u.email}</div>
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                      ${u.role === 'ADMIN' ? 'bg-amber-100 text-amber-700'
                        : u.role === 'CANDIDATE' ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700'
                        : 'bg-emerald-100 text-brand-700'}`}>
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
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-brand-700">
                        Aktif
                      </span>
                    )}
                  </td>
                  <td className="hidden sm:table-cell text-xs text-ink-400">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '—'}
                  </td>
                  <td>
                    <button onClick={() => openDetail(u)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-md bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-700 hover:bg-brand-200 dark:hover:bg-brand-900/60 transition-colors">
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
  RESOLVED:  { cls: 'bg-emerald-100 text-brand-700', label: 'Çözüldü' },
  DISMISSED: { cls: 'bg-cream-100 text-ink-500',     label: 'Reddedildi' },
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
                : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
            style={statusFilter === f.value ? { background: 'linear-gradient(135deg, #1e3a5f, #234a82)' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : reports.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <Icon d={ICONS.checkCircle} className="w-10 h-10 text-brand-700 mb-3" strokeWidth={1.5} />
            <p className="text-ink-500 text-sm">Şikayet yok</p>
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
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cream-100 text-ink-600">
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
                      <p className="text-sm text-ink-700 mt-2">{r.description}</p>
                    )}
                    <p className="text-xs text-ink-400 mt-1.5">
                      Şikayet eden: {r.reporterName} ({r.reporterEmail}) ·{' '}
                      {new Date(r.createdAt).toLocaleString('tr-TR')}
                    </p>
                    {r.adminNote && (
                      <p className="text-xs text-ink-500 mt-1 italic">Admin notu: {r.adminNote}</p>
                    )}
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleStatus(r.id, 'RESOLVED')} disabled={actionId === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-100 text-brand-700 hover:bg-emerald-200 disabled:opacity-50 inline-flex items-center gap-1">
                        <Icon d={ICONS.check} className="w-3.5 h-3.5" /> Çözüldü
                      </button>
                      <button onClick={() => handleStatus(r.id, 'DISMISSED')} disabled={actionId === r.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded-md bg-cream-100 text-ink-600 hover:bg-cream-200 disabled:opacity-50 inline-flex items-center gap-1">
                        <Icon d={ICONS.xmark} className="w-3.5 h-3.5" /> Reddet
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-ink-400 mt-2 inline-flex items-center gap-1">
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
  UNBAN_USER:     { path: ICONS.check,   label: 'Ban kaldırıldı',      cls: 'bg-brand-50 text-brand-700' },
  MARK_NO_SHOW:   { path: ICONS.ban,     label: 'No-show işaretlendi',  cls: 'bg-amber-50 text-amber-700' },
  AUTO_BAN:       { path: ICONS.bolt,    label: 'Otomatik ban',         cls: 'bg-red-50 text-red-700' },
  RESOLVE_REPORT: { path: ICONS.check,   label: 'Şikayet çözüldü',      cls: 'bg-brand-50 text-brand-700' },
  DISMISS_REPORT: { path: ICONS.xmark,   label: 'Şikayet reddedildi',   cls: 'bg-cream-100 text-ink-500' },
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
                : 'bg-white dark:bg-ink-800 text-ink-600 dark:text-ink-300 border border-cream-300 dark:border-ink-700 hover:border-brand-400 dark:hover:border-brand-500'}`}
            style={actionFilter === f.value ? { background: 'linear-gradient(135deg, #1e3a5f, #234a82)' } : {}}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="card">
          <div className="empty-state py-14">
            <Icon d={ICONS.doc} className="w-10 h-10 text-ink-300 mb-3" strokeWidth={1.5} />
            <p className="text-ink-500 text-sm">Henüz işlem kaydı yok</p>
          </div>
        </div>
      ) : (
        <div className="card divide-y divide-slate-50">
          {logs.map(l => {
            const m = ACTION_META[l.action] || { path: ICONS.doc, label: l.action, cls: 'bg-cream-100 text-ink-600' }
            const isSystem = l.actorEmail === 'SYSTEM'
            return (
              <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1 ${m.cls}`}>
                  <Icon d={m.path} className="w-3.5 h-3.5" /> {m.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-700">{l.details}</div>
                  <div className="text-xs text-ink-400 mt-0.5 inline-flex items-center gap-1">
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
/* ── FAZ 6.3 — Listing moderation tab ── */
function ListingsTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const fetchItems = useCallback(() => {
    setLoading(true)
    hotelApi.adminListListings(statusFilter || undefined, search || undefined)
      .then(setItems)
      .catch(err => toast.error(extractErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [statusFilter, search])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function setStatus(listing, newStatus) {
    const verb = newStatus === 'PAUSED' ? 'askıya alınacak' : (newStatus === 'CLOSED' ? 'kapatılacak' : 'aktif edilecek')
    if (!confirm(`"${listing.title}" ilanı ${verb}. Devam edilsin mi?`)) return
    setBusy(listing.id)
    try {
      await hotelApi.adminSetListingStatus(listing.id, newStatus)
      toast.success(`İlan durumu: ${newStatus}`)
      fetchItems()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const statusColor = (s) => s === 'ACTIVE' ? '#22c55e' : (s === 'PAUSED' ? '#fbbf24' : '#ef4444')

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Başlık veya işletme adı..."
            className="input text-sm flex-1 min-w-[200px]" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="input text-sm" style={{ maxWidth: 160 }}>
            <option value="">Tüm durumlar</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PAUSED">Askıda</option>
            <option value="CLOSED">Kapalı</option>
          </select>
          <div className="text-xs px-3 py-1 rounded-full"
               style={{ background: 'rgba(212, 168, 83, 0.18)', color: '#fde9a5' }}>
            {items.length} ilan
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-ink-400">Yükleniyor...</div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-ink-400">Sonuç yok</div>
      ) : (
        <div className="space-y-2">
          {items.map(l => (
            <div key={l.id} className="card p-4 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={`/listings/${l.id}`} target="_blank" rel="noopener noreferrer"
                    className="font-semibold text-sm" style={{ color: '#dde7f3' }}>
                    {l.title}
                  </a>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      background: `${statusColor(l.status)}22`,
                      color: statusColor(l.status),
                      border: `1px solid ${statusColor(l.status)}55`,
                    }}>
                    {l.status}
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: '#8ba9d2' }}>
                  {l.position} · {l.businessName} · {l.ownerEmail}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#234a82' }}>
                  {new Date(l.createdAt).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {l.status !== 'ACTIVE' && (
                  <button onClick={() => setStatus(l, 'ACTIVE')} disabled={busy === l.id}
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(34, 197, 94, 0.18)', color: '#86efac', border: '1px solid rgba(34, 197, 94, 0.40)' }}>
                    Aktive Et
                  </button>
                )}
                {l.status !== 'PAUSED' && (
                  <button onClick={() => setStatus(l, 'PAUSED')} disabled={busy === l.id}
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(251, 191, 36, 0.18)', color: '#fcd34d', border: '1px solid rgba(251, 191, 36, 0.40)' }}>
                    Askıya Al
                  </button>
                )}
                {l.status !== 'CLOSED' && (
                  <button onClick={() => setStatus(l, 'CLOSED')} disabled={busy === l.id}
                    className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(239, 68, 68, 0.18)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.40)' }}>
                    Kapat
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'users'    && <UsersTab />}
      {activeTab === 'listings' && <ListingsTab />}
      {activeTab === 'reports'  && <ReportsTab />}
      {activeTab === 'audit'    && <AuditTab />}
      {activeTab === 'outbox'   && <OutboxTab />}
    </DashboardLayout>
  )
}

/* ── Outbox Tab (FAZ D.5) ── */
function OutboxTab() {
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await hotelApi.adminListOutbox(filter, 100))
    } catch (e) {
      toast.error(extractErrorMessage(e) || 'Outbox listelenemedi')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function retry(id) {
    try {
      await hotelApi.adminRetryOutbox(id)
      toast.success('Retry sırasına alındı')
      load()
    } catch (e) {
      toast.error(extractErrorMessage(e) || 'İşlem başarısız')
    }
  }

  const FILTERS = [
    { v: 'all',     label: 'Tümü' },
    { v: 'pending', label: 'Sırada' },
    { v: 'dead',    label: 'Dead Letter' },
  ]

  const statusStyle = {
    DELIVERED: { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.10)' },
    PENDING:   { color: '#d97706', bg: 'rgba(217, 119, 6, 0.10)' },
    DEAD:      { color: '#b91c1c', bg: 'rgba(185, 28, 28, 0.10)' },
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.v}
            onClick={() => setFilter(f.v)}
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              border: filter === f.v ? '1px solid #d4a853' : '1px solid rgba(148,163,184,0.3)',
              background: filter === f.v ? 'rgba(212, 168, 83, 0.12)' : 'transparent',
              color: filter === f.v ? '#d4a853' : '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8' }}>Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div style={{ color: '#94a3b8', padding: 24, textAlign: 'center' }}>Bu filtreyle event yok.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(e => {
            const s = statusStyle[e.status] || statusStyle.PENDING
            return (
              <div key={e.id} style={{
                padding: 14,
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(212, 168, 83, 0.12)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: s.bg,
                      color: s.color,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                    }}>{e.status}</span>
                    <span style={{ color: '#cbd5e1', fontSize: 13, fontWeight: 600 }}>#{e.id}</span>
                    <span style={{ color: '#d4a853', fontSize: 11, fontWeight: 600 }}>{e.eventType}</span>
                    <span style={{ color: '#94a3b8', fontSize: 11 }}>
                      deneme {e.attempts}
                    </span>
                    <span style={{ color: '#64748b', fontSize: 11 }}>
                      {new Date(e.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </div>
                  {e.lastError && (
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: '#fca5a5',
                      fontFamily: 'monospace',
                      lineHeight: 1.4,
                    }}>
                      {e.lastError}
                    </div>
                  )}
                  <div style={{
                    marginTop: 6,
                    fontSize: 10,
                    color: '#64748b',
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                  }}>
                    {e.payloadPreview}
                  </div>
                </div>
                {e.status !== 'DELIVERED' && (
                  <button
                    onClick={() => retry(e.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: 'rgba(212, 168, 83, 0.12)',
                      border: '1px solid rgba(212, 168, 83, 0.3)',
                      color: '#d4a853',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}>
                    Tekrar Dene
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
