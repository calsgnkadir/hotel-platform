import { useState, useEffect, useCallback, useId } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import * as hotelApi from '../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../api/client'
import { useConfirm } from '../../lib/useConfirm'
import { POSITION_LABELS, BUSINESS_TYPE_LABELS } from '../../utils/labels'
import { ROLE, resolveTab, defaultTabFor } from '../../lib/navigation'
import { SkeletonList, SkeletonStatGrid } from '../../components/Skeleton'
import LoadError from '../../components/ui/LoadError'
import EmptyState from '../../components/EmptyState'
import DismissReportDialog from './DismissReportDialog'
import {
  ROLE_LABELS, LISTING_STATUS, REPORT_STATUS, SUPPORT_STATUS, OUTBOX_STATUS,
  OUTBOX_EVENT_LABELS, SUPPORT_SUBJECT_LABELS, statusMeta, labelOf,
} from './adminLabels'

/* ── Inline SVG helper (Heroicons stroke stili) ── */
function Icon({ d, className = 'w-4 h-4', strokeWidth = 2 }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true"
         strokeWidth={strokeWidth} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

const ICONS = {
  search:   'm21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
  check:    'm4.5 12.75 6 6 9-13.5',
  xmark:    'M6 18 18 6M6 6l12 12',
  ban:      'm5.636 5.636 12.728 12.728M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  bolt:     'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z',
  doc:      'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  user:     'M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z',
  cpuChip:  'M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z',
  info:     'm11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
  external: 'M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25',
  users:    'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  building: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21',
  shield:   'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
  briefcase:'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0',
  inbox:    'M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z',
}

const fmtDateTime = (v) => v ? new Date(v).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const fmtDate = (v) => v ? new Date(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

/** Arama kutusu: her tuşta istek atılmasın (400ms). */
export function useDebouncedValue(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

/* ── Ortak parçalar ── */

/** Filtre çipleri — .chip / .chip.is-active, aria-pressed. */
function FilterChips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`chip ${value === o.value ? 'is-active' : ''}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Arama kutusu — görünmez etiket + büyüteç ikonu. */
function SearchInput({ value, onChange, placeholder, label, className = '' }) {
  const id = useId()
  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--ah-ink-4)' }}>
        <Icon d={ICONS.search} className="w-4 h-4" />
      </span>
      <input id={id} type="search" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className="input" autoComplete="off"
        // .input kendi padding'ini koyup pl-9'u eziyor; simge için sol boşluk burada
        style={{ paddingLeft: '2.25rem' }} />
    </div>
  )
}

/** Sekme başlığı: kısa açıklama + sağda sayaç. Başlık masaüstünde DashboardLayout'un
 *  H1'inde zaten var; burada yalnız mobilde görünür (orada H1 görsel olarak gizli). */
function TabHeader({ title, description, count, countLabel }) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <h2 className="type-section md:hidden">{title}</h2>
        {description && <p className="type-meta mt-0.5">{description}</p>}
      </div>
      {typeof count === 'number' && (
        <span className="badge badge-neutral type-num">{count} {countLabel}</span>
      )}
    </div>
  )
}

/** Liste gövdesi: yükleniyor / hata / boş / içerik. */
function ListState({ loading, error, onRetry, empty, emptyTitle, emptyDescription, emptyType = 'search', children }) {
  if (loading) return <SkeletonList count={4} />
  if (error) return <LoadError message={error} onRetry={onRetry} />
  if (empty) {
    return (
      <div className="card !p-0">
        <EmptyState compact type={emptyType} title={emptyTitle} description={emptyDescription} />
      </div>
    )
  }
  return children
}

/* ── Genel bakış ── */
function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    hotelApi.adminGetStats()
      .then(setStats)
      .catch(() => setError('İstatistikler yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  if (loading) return <SkeletonStatGrid count={4} />
  if (error || !stats) return <LoadError message={error || 'İstatistikler yüklenemedi.'} onRetry={load} />

  const groups = [
    {
      title: 'Kullanıcılar',
      items: [
        { label: 'Toplam kullanıcı', value: stats.totalUsers,     icon: 'users',  tab: 'users' },
        { label: 'Aday',             value: stats.candidates,     icon: 'user',   tab: 'users' },
        { label: 'İşletme sahibi',   value: stats.businessOwners, icon: 'building', tab: 'users' },
        { label: 'Yönetici',         value: stats.admins,         icon: 'shield', tab: 'users' },
        { label: 'Banlı hesap',      value: stats.bannedUsers,    icon: 'ban',    tab: 'users', warn: (stats.bannedUsers || 0) > 0 },
      ],
    },
    {
      title: 'İçerik',
      items: [
        { label: 'Kayıtlı işletme', value: stats.totalBusinesses,   icon: 'building',  tab: 'businesses' },
        { label: 'Toplam ilan',     value: stats.totalListings,     icon: 'briefcase', tab: 'listings' },
        // Admin panelinde başvuru sekmesi yok; kart bilgi amaçlı, bağlantısız
        { label: 'Toplam başvuru',  value: stats.totalApplications, icon: 'inbox' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <TabHeader title="Genel bakış" description="Platformdaki hesap ve içerik sayıları." />
      {groups.map(g => (
        <section key={g.title} aria-labelledby={`admin-stat-${g.title}`} className="space-y-2.5">
          <h3 id={`admin-stat-${g.title}`} className="type-card">{g.title}</h3>
          <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {g.items.map(c => (
              <li key={c.label} className="min-w-0">
                <AdminKpiCard {...c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** KPI kartı: ikon kutusu + etiket üstte + sayı altta. `tab` verilirse ilgili sekmeye bağlanır. */
function AdminKpiCard({ label, value, icon, tab, warn }) {
  const body = (
    <>
      <span className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0"
            style={warn
              ? { background: 'var(--ah-danger-soft)', color: 'var(--ah-danger)' }
              : { background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)' }}>
        <Icon d={ICONS[icon] || ICONS.info} className="w-4 h-4" strokeWidth={1.7} />
      </span>
      <span className="min-w-0">
        <span className="type-meta block truncate">{label}</span>
        <span className="type-page type-num block mt-0.5"
              style={{ color: warn ? 'var(--ah-danger)' : 'var(--ah-ink)' }}>
          {(value ?? 0).toLocaleString('tr-TR')}
        </span>
      </span>
    </>
  )
  const base = 'card !p-4 h-full flex items-start gap-3'
  if (!tab) return <div className={base}>{body}</div>
  return (
    <Link to={`/admin?tab=${tab}`}
          className={`${base} transition-[border-color,box-shadow] duration-150 hover:border-[var(--ah-line-2)] hover:shadow-[var(--elev-hover)]
                      focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ah-brand)]`}>
      {body}
    </Link>
  )
}

/* ── Kullanıcı detayı ──
 * variant='modal' (mobil) — modal-overlay.
 * variant='panel' (masaüstü) — liste yanında yapışkan panel. */
function UserDetailModal({ user, onClose, onUpdated, variant = 'modal' }) {
  const confirm = useConfirm()
  const [actionLoading, setActionLoading] = useState(false)
  const [banDays, setBanDays] = useState(30)
  const banDaysId = useId()

  async function handleBan() {
    const ok = await confirm({
      title: 'Kullanıcıyı banla',
      description: `${user.fullName} ${banDays} gün süreyle banlanacak. Süre bitince ban kendiliğinden kalkar.`,
      confirmLabel: `${banDays} gün banla`,
      destructive: true,
    })
    if (!ok) return
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

  const facts = [
    { label: 'Kalan uyarı hakkı', value: user.strikesRemaining ?? '—' },
    { label: 'İlçe', value: user.district || '—' },
    isCandidate && { label: 'Başvuru', value: user.applicationCount ?? 0 },
    user.role === 'BUSINESS_OWNER' && { label: 'İlan', value: user.listingCount ?? 0 },
  ].filter(Boolean)

  const body = (
    <>
      <div className="p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--ah-line)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="admin-user-detail-title" className="type-card truncate">{user.fullName}</h2>
            <p className="type-meta truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="badge badge-neutral">{labelOf(ROLE_LABELS, user.role)}</span>
              {user.currentlyBanned
                ? <span className="badge badge-negative">Banlı</span>
                : <span className="badge badge-positive">Aktif</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Detayı kapat" className="ah-icon-btn flex-shrink-0 -mr-2 -mt-2">
            <span className="ah-icon-btn__face"><Icon d={ICONS.xmark} className="w-4 h-4" /></span>
          </button>
        </div>
      </div>

      <div className={`p-5 space-y-5 ${variant === 'panel' ? 'flex-1 overflow-y-auto' : ''}`}>
        <dl className="grid grid-cols-2 gap-2">
          {facts.map(f => (
            <div key={f.label} className="rounded-lg p-3" style={{ background: 'var(--ah-band)' }}>
              <dt className="type-caption">{f.label}</dt>
              <dd className="type-body font-semibold type-num mt-0.5" style={{ color: 'var(--ah-ink)' }}>{f.value}</dd>
            </div>
          ))}
        </dl>

        {user.currentlyBanned && user.bannedUntil && (
          <div className="rounded-lg p-3 type-body" role="status"
               style={{ background: 'var(--ah-danger-soft)', color: 'var(--ah-danger)' }}>
            Ban bitişi: {fmtDateTime(user.bannedUntil)}
          </div>
        )}

        {!isAdmin && (
          <section className="pt-4 border-t space-y-3" style={{ borderColor: 'var(--ah-line)' }}>
            <h3 className="type-label">Ban yönetimi</h3>
            {user.currentlyBanned ? (
              <button type="button" onClick={handleUnban} disabled={actionLoading} className="btn-secondary w-full">
                <Icon d={ICONS.check} className="w-4 h-4" /> Banı kaldır
              </button>
            ) : (
              <div className="flex items-end gap-2">
                <div className="w-28 flex-shrink-0">
                  <label htmlFor={banDaysId} className="label">Süre (gün)</label>
                  <input id={banDaysId} type="number" inputMode="numeric" value={banDays}
                    onChange={e => setBanDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                    min="1" max="365" className="input" />
                </div>
                <button type="button" onClick={handleBan} disabled={actionLoading} className="btn-danger flex-1">
                  <Icon d={ICONS.ban} className="w-4 h-4" /> {banDays} gün banla
                </button>
              </div>
            )}
          </section>
        )}

        <p className="type-caption pt-3 border-t" style={{ borderColor: 'var(--ah-line)' }}>
          Kayıt: {fmtDateTime(user.createdAt)} · Kimlik no: {user.id}
        </p>
      </div>
    </>
  )

  if (variant === 'panel') {
    return (
      <aside aria-labelledby="admin-user-detail-title"
        className="card !p-0 sticky top-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col">
        {body}
      </aside>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-y-auto"
           role="dialog" aria-modal="true" aria-labelledby="admin-user-detail-title"
           onClick={e => e.stopPropagation()}>
        {body}
      </div>
    </div>
  )
}

const ROLE_FILTERS = [
  { value: '',               label: 'Tümü' },
  { value: 'CANDIDATE',      label: 'Adaylar' },
  { value: 'BUSINESS_OWNER', label: 'İşletmeler' },
  { value: 'ADMIN',          label: 'Yöneticiler' },
]

/* ── Kullanıcılar — masaüstünde liste + detay paneli ── */
function UsersTab() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  useEffect(() => {
    function onResize() { setIsDesktop(window.innerWidth >= 1024) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [roleFilter, setRoleFilter] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const [selected, setSelected] = useState(null)

  const fetchUsers = useCallback(() => {
    setLoading(true)
    setError(null)
    hotelApi.adminListUsers(roleFilter || undefined, debouncedSearch || undefined)
      .then(setUsers)
      .catch(() => setError('Kullanıcılar yüklenemedi.'))
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
    setSelected(prev => prev ? { ...prev, ...updatedSummary } : null)
    setUsers(prev => prev.map(u => u.id === updatedSummary.id ? { ...u, ...updatedSummary } : u))
  }

  const split = !!selected && isDesktop

  return (
    <div className="space-y-4">
      <TabHeader title="Kullanıcılar" description="Hesapları incele, gerekirse süreli ban uygula."
        count={loading ? undefined : users.length} countLabel="kullanıcı" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <FilterChips label="Rol filtresi" options={ROLE_FILTERS} value={roleFilter} onChange={setRoleFilter} />
        <SearchInput value={search} onChange={setSearch} label="Kullanıcı ara"
          placeholder="E-posta veya ad ara" className="flex-1 sm:max-w-xs sm:ml-auto" />
      </div>

      <ListState loading={loading} error={error} onRetry={fetchUsers} empty={users.length === 0}
        emptyTitle="Eşleşen kullanıcı yok" emptyDescription="Aramayı ya da rol filtresini değiştirip yeniden dene.">
        <div className={split ? 'grid gap-4' : ''}
             style={split ? { gridTemplateColumns: 'minmax(0, 380px) minmax(0, 1fr)', alignItems: 'start' } : undefined}>
          <ul className="space-y-2 min-w-0">
            {users.map(u => {
              const isActive = selected?.id === u.id
              return (
                <li key={u.id}>
                  <button type="button" onClick={() => openDetail(u)} aria-current={isActive ? 'true' : undefined}
                    className={`w-full text-left transition-colors focus-visible:outline focus-visible:outline-2 ${isActive ? 'tier-featured' : 'tier-raised tier-raised-hover'} ${split ? 'p-3' : 'p-4'}`}
                    style={{ outlineColor: 'var(--ah-brand)', outlineOffset: 2 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="type-body font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>{u.fullName}</div>
                        <div className="type-meta truncate">{u.email}</div>
                        {!split && (
                          <div className="type-caption mt-1">
                            Kalan uyarı hakkı: <span className="type-num font-semibold" style={{ color: 'var(--ah-ink-2)' }}>{u.strikesRemaining ?? '—'}</span>
                            {' · '}Kayıt: {fmtDate(u.createdAt)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span className="badge badge-neutral">{labelOf(ROLE_LABELS, u.role)}</span>
                        {u.currentlyBanned
                          ? <span className="badge badge-negative">Banlı</span>
                          : <span className="badge badge-positive">Aktif</span>}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {split && (
            <UserDetailModal user={selected} onClose={() => setSelected(null)}
                             onUpdated={handleUpdated} variant="panel" />
          )}
        </div>
      </ListState>

      {selected && !isDesktop && (
        <UserDetailModal user={selected} onClose={() => setSelected(null)}
                         onUpdated={handleUpdated} variant="modal" />
      )}
    </div>
  )
}

/* ── Şikâyetler ── */
const REPORT_REASON_LABELS = {
  FAKE: 'Sahte', SPAM: 'Spam', SCAM: 'Dolandırıcılık',
  INAPPROPRIATE: 'Uygunsuz', HARASSMENT: 'Taciz', OTHER: 'Diğer',
}
const REPORT_TYPE_LABELS = { LISTING: 'İlan', BUSINESS: 'İşletme', USER: 'Kullanıcı' }
const REPORT_FILTERS = [
  { value: '',          label: 'Tümü' },
  { value: 'PENDING',   label: 'Bekleyen' },
  { value: 'RESOLVED',  label: 'Çözülen' },
  { value: 'DISMISSED', label: 'Reddedilen' },
]

function ReportsTab() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [actionId, setActionId] = useState(null)
  const [dismissing, setDismissing] = useState(null)   // reddedilecek şikâyet

  const fetchReports = useCallback(() => {
    setLoading(true)
    setError(null)
    hotelApi.adminListReports(statusFilter || undefined)
      .then(setReports)
      .catch(() => setError('Şikâyetler yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [statusFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  async function updateStatus(id, status, adminNote = null) {
    setActionId(id)
    try {
      await hotelApi.adminUpdateReportStatus(id, status, adminNote)
      toast.success(status === 'RESOLVED' ? 'Çözüldü olarak işaretlendi' : 'Şikâyet reddedildi')
      setDismissing(null)
      fetchReports()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionId(null) }
  }

  const targetLabel = (r) => `${labelOf(REPORT_TYPE_LABELS, r.targetType, 'Kayıt')} #${r.targetId}`

  return (
    <div className="space-y-4">
      <TabHeader title="Şikâyetler" description="Kullanıcıların bildirdiği ilan, işletme ve hesaplar."
        count={loading ? undefined : reports.length} countLabel="şikâyet" />
      <FilterChips label="Durum filtresi" options={REPORT_FILTERS} value={statusFilter} onChange={setStatusFilter} />

      <ListState loading={loading} error={error} onRetry={fetchReports} empty={reports.length === 0}
        emptyType="generic" emptyTitle="Şikâyet yok"
        emptyDescription={statusFilter ? 'Bu filtrede şikâyet bulunmuyor.' : 'Şu an incelenecek bir şikâyet bulunmuyor.'}>
        <ul className="space-y-3">
          {reports.map(r => {
            const sm = statusMeta(REPORT_STATUS, r.status)
            return (
              <li key={r.id} className="card !p-4 sm:!p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={sm.cls}>{sm.label}</span>
                      <span className="badge badge-neutral">{targetLabel(r)}</span>
                      <span className="badge badge-neutral">{labelOf(REPORT_REASON_LABELS, r.reason)}</span>
                    </div>
                    {r.description && (
                      <p className="type-body mt-2.5 whitespace-pre-wrap break-words">{r.description}</p>
                    )}
                    <p className="type-caption mt-2 break-words">
                      Şikâyet eden: {r.reporterName} ({r.reporterEmail}) · {fmtDateTime(r.createdAt)}
                    </p>
                    {r.adminNote && (
                      <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--ah-band)' }}>
                        <div className="type-label">Admin notu</div>
                        <p className="type-body mt-0.5 whitespace-pre-wrap break-words">{r.adminNote}</p>
                      </div>
                    )}
                  </div>

                  {r.status === 'PENDING' && (
                    <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                      <button type="button" onClick={() => updateStatus(r.id, 'RESOLVED')} disabled={actionId === r.id}
                        className="btn-secondary flex-1 sm:flex-none">
                        <Icon d={ICONS.check} className="w-4 h-4" /> Çözüldü
                      </button>
                      <button type="button" onClick={() => setDismissing(r)} disabled={actionId === r.id}
                        className="btn-ghost flex-1 sm:flex-none">
                        <Icon d={ICONS.xmark} className="w-4 h-4" /> Reddet
                      </button>
                    </div>
                  )}
                </div>
                {r.status === 'PENDING' && (
                  <p className="type-caption mt-3 inline-flex items-start gap-1.5">
                    <Icon d={ICONS.info} className="w-4 h-4 flex-shrink-0" />
                    Gerekirse Kullanıcılar sekmesinden ilgili hesabı bulup banlayabilirsin.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      </ListState>

      <DismissReportDialog
        open={!!dismissing}
        report={dismissing ? { targetLabel: targetLabel(dismissing) } : null}
        busy={!!dismissing && actionId === dismissing.id}
        onCancel={() => setDismissing(null)}
        onConfirm={(note) => updateStatus(dismissing.id, 'DISMISSED', note)}
      />
    </div>
  )
}

/* ── İşlem geçmişi ── */
const ACTION_META = {
  BAN_USER:       { path: ICONS.ban,   label: 'Kullanıcı banlandı',   tone: 'badge-negative' },
  UNBAN_USER:     { path: ICONS.check, label: 'Ban kaldırıldı',       tone: 'badge-neutral' },
  MARK_NO_SHOW:   { path: ICONS.ban,   label: 'Gelmedi işaretlendi',  tone: 'badge-attention' },
  AUTO_BAN:       { path: ICONS.bolt,  label: 'Otomatik ban',         tone: 'badge-negative' },
  RESOLVE_REPORT: { path: ICONS.check, label: 'Şikâyet çözüldü',      tone: 'badge-positive' },
  DISMISS_REPORT: { path: ICONS.xmark, label: 'Şikâyet reddedildi',   tone: 'badge-neutral' },
  SUPPORT_IN_PROGRESS: { path: ICONS.doc,   label: 'Destek incelemede', tone: 'badge-neutral' },
  SUPPORT_RESOLVED:    { path: ICONS.check, label: 'Destek çözüldü',    tone: 'badge-positive' },
  SUPPORT_DISMISSED:   { path: ICONS.xmark, label: 'Destek reddedildi', tone: 'badge-neutral' },
}
const AUDIT_FILTERS = [
  { value: '',               label: 'Tümü' },
  { value: 'BAN_USER',       label: 'Banlar' },
  { value: 'AUTO_BAN',       label: 'Otomatik ban' },
  { value: 'MARK_NO_SHOW',   label: 'Gelmedi' },
  { value: 'RESOLVE_REPORT', label: 'Şikâyet işlemleri' },
]

function AuditTab() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionFilter, setActionFilter] = useState('')

  const fetchLogs = useCallback(() => {
    setLoading(true)
    setError(null)
    hotelApi.adminListAuditLogs(actionFilter || undefined, 100)
      .then(setLogs)
      .catch(() => setError('İşlem geçmişi yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [actionFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  return (
    <div className="space-y-4">
      <TabHeader title="İşlem geçmişi" description="Yönetici ve sistem işlemlerinin son 100 kaydı." />
      <FilterChips label="İşlem filtresi" options={AUDIT_FILTERS} value={actionFilter} onChange={setActionFilter} />

      <ListState loading={loading} error={error} onRetry={fetchLogs} empty={logs.length === 0}
        emptyType="history" emptyTitle="Henüz işlem kaydı yok" emptyDescription="Ban, şikâyet ve destek işlemleri burada listelenir.">
        <ul className="card !p-0 divide-y" style={{ borderColor: 'var(--ah-line)' }}>
          {logs.map(l => {
            const m = ACTION_META[l.action] || { path: ICONS.doc, label: 'Diğer işlem', tone: 'badge-neutral' }
            const isSystem = l.actorEmail === 'SYSTEM'
            return (
              <li key={l.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3" style={{ borderColor: 'var(--ah-line)' }}>
                <span className={`badge ${m.tone} self-start flex-shrink-0`}>
                  <Icon d={m.path} className="w-3.5 h-3.5" /> {m.label}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="type-body break-words">{l.details}</div>
                  <div className="type-caption mt-0.5 inline-flex items-center gap-1 flex-wrap">
                    <Icon d={isSystem ? ICONS.cpuChip : ICONS.user} className="w-3.5 h-3.5" />
                    <span className="break-all">{isSystem ? 'Sistem' : l.actorEmail}</span>
                    <span aria-hidden="true">·</span>
                    {fmtDateTime(l.createdAt)}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </ListState>
    </div>
  )
}

/* ── İlan moderasyonu ── */
const LISTING_FILTERS = [
  { value: '',       label: 'Tümü' },
  { value: 'ACTIVE', label: 'Yayında' },
  { value: 'PAUSED', label: 'Askıda' },
  { value: 'CLOSED', label: 'Kapalı' },
]
const LISTING_ACTIONS = {
  ACTIVE: { button: 'Yayına al', title: 'İlanı yayına al', verb: 'yeniden yayına alınacak', done: 'İlan yayına alındı' },
  PAUSED: { button: 'Askıya al', title: 'İlanı askıya al', verb: 'askıya alınacak ve adaylara görünmeyecek', done: 'İlan askıya alındı' },
  CLOSED: { button: 'Kapat',     title: 'İlanı kapat',     verb: 'kapatılacak', done: 'İlan kapatıldı' },
}

function ListingsTab() {
  const confirm = useConfirm()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())

  const fetchItems = useCallback(() => {
    setLoading(true)
    setError(null)
    hotelApi.adminListListings(statusFilter || undefined, debouncedSearch || undefined)
      .then(setItems)
      .catch(err => setError(extractErrorMessage(err) || 'İlanlar yüklenemedi.'))
      .finally(() => setLoading(false))
  }, [statusFilter, debouncedSearch])

  useEffect(() => { fetchItems() }, [fetchItems])

  async function setStatus(listing, newStatus) {
    const a = LISTING_ACTIONS[newStatus]
    const ok = await confirm({
      title: a.title,
      description: `"${listing.title}" ilanı ${a.verb}.`,
      confirmLabel: a.button,
      destructive: newStatus === 'CLOSED',
    })
    if (!ok) return
    setBusy(listing.id)
    try {
      await hotelApi.adminSetListingStatus(listing.id, newStatus)
      toast.success(a.done)
      fetchItems()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <TabHeader title="İlanlar" description="İlanları yayına al, askıya al ya da kapat."
        count={loading ? undefined : items.length} countLabel="ilan" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <FilterChips label="Durum filtresi" options={LISTING_FILTERS} value={statusFilter} onChange={setStatusFilter} />
        <SearchInput value={search} onChange={setSearch} label="İlan ara"
          placeholder="Başlık veya işletme adı" className="flex-1 sm:max-w-xs sm:ml-auto" />
      </div>

      <ListState loading={loading} error={error} onRetry={fetchItems} empty={items.length === 0}
        emptyTitle="İlan bulunamadı" emptyDescription="Aramayı ya da durum filtresini değiştirip yeniden dene.">
        <ul className="space-y-2">
          {items.map(l => {
            const sm = statusMeta(LISTING_STATUS, l.status)
            return (
              <li key={l.id} className="card !p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <a href={`/listings/${l.id}`} target="_blank" rel="noopener noreferrer"
                      className="type-body font-semibold inline-flex items-center gap-1 hover:underline break-words"
                      style={{ color: 'var(--ah-ink)' }}>
                      {l.title}
                      <Icon d={ICONS.external} className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="sr-only">(yeni sekmede açılır)</span>
                    </a>
                    <span className={sm.cls}>{sm.label}</span>
                  </div>
                  <div className="type-meta mt-1 break-words">
                    {labelOf(POSITION_LABELS, l.position, 'Pozisyon')} · {l.businessName} · {l.ownerEmail}
                  </div>
                  <div className="type-caption mt-0.5">Oluşturma: {fmtDateTime(l.createdAt)}</div>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap">
                  {['ACTIVE', 'PAUSED', 'CLOSED'].filter(s => s !== l.status).map(s => (
                    <button key={s} type="button" onClick={() => setStatus(l, s)} disabled={busy === l.id}
                      className={`${s === 'CLOSED' ? 'btn-danger' : 'btn-secondary'} flex-1 sm:flex-none`}>
                      {LISTING_ACTIONS[s].button}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </ListState>
    </div>
  )
}

const resolveAdminTab = (t) => resolveTab(ROLE.ADMIN, t)

export default function AdminPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = resolveAdminTab(params.get('tab'))?.tab || defaultTabFor(ROLE.ADMIN)

  // Geçersiz id (ör. eski yer imi) reddedilir; sekme adresle paylaşılabilir (?tab=reports).
  function setActiveTab(t) {
    const r = resolveAdminTab(t)
    if (!r) return false
    setParams({ tab: r.tab }, { replace: true })
    return true
  }

  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div key={activeTab} className="page-enter">
        {activeTab === 'overview'   && <OverviewTab />}
        {activeTab === 'users'      && <UsersTab />}
        {activeTab === 'listings'   && <ListingsTab />}
        {activeTab === 'reports'    && <ReportsTab />}
        {activeTab === 'audit'      && <AuditTab />}
        {activeTab === 'businesses' && <BusinessesTab />}
        {activeTab === 'support'    && <SupportTab />}
        {activeTab === 'outbox'     && <OutboxTab />}
      </div>
    </DashboardLayout>
  )
}

/* ── Destek talepleri ── */
const SUPPORT_FILTERS = [
  { value: 'all',         label: 'Tümü' },
  { value: 'OPEN',        label: 'Yeni' },
  { value: 'IN_PROGRESS', label: 'İnceleniyor' },
  { value: 'RESOLVED',    label: 'Çözüldü' },
  { value: 'DISMISSED',   label: 'Reddedildi' },
]

function SupportTab() {
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openId, setOpenId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const noteBaseId = useId()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = filter === 'all' ? null : filter
      setItems(await hotelApi.adminListSupport(status, 100))
    } catch (e) {
      setError(extractErrorMessage(e) || 'Destek talepleri yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function setStatus(id, newStatus, note) {
    setBusy(true)
    try {
      await hotelApi.adminUpdateSupportStatus(id, newStatus, note)
      toast.success('Durum güncellendi')
      setOpenId(null)
      setNoteDraft('')
      load()
    } catch (e) {
      toast.error(extractErrorMessage(e) || 'İşlem başarısız')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <TabHeader title="Destek talepleri" description="Kullanıcıların iletişim formundan gönderdiği talepler."
        count={loading ? undefined : items.length} countLabel="talep" />
      <FilterChips label="Durum filtresi" options={SUPPORT_FILTERS} value={filter} onChange={setFilter} />

      <ListState loading={loading} error={error} onRetry={load} empty={items.length === 0}
        emptyType="messages" emptyTitle="Destek talebi yok"
        emptyDescription={filter === 'all' ? 'Yeni bir talep geldiğinde burada görünür.' : 'Bu filtrede talep bulunmuyor.'}>
        <ul className="space-y-3">
          {items.map(t => {
            const sm = statusMeta(SUPPORT_STATUS, t.status)
            const isOpen = openId === t.id
            const closed = t.status === 'RESOLVED' || t.status === 'DISMISSED'
            const noteId = `${noteBaseId}-${t.id}`
            return (
              <li key={t.id} className="card !p-4 sm:!p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={sm.cls}>{sm.label}</span>
                      <span className="badge badge-neutral">{labelOf(SUPPORT_SUBJECT_LABELS, t.subject, 'Genel')}</span>
                      <span className="type-caption type-num">#{t.id}</span>
                    </div>
                    <p className="type-meta mt-1.5 break-words">
                      {t.userFullName} · {labelOf(ROLE_LABELS, t.userRole, 'Kullanıcı')} · {t.userEmail}
                    </p>
                    <p className="type-body mt-2.5 whitespace-pre-wrap break-words" style={{ color: 'var(--ah-ink)' }}>
                      {t.message}
                    </p>
                    {t.adminNote && (
                      <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--ah-band)' }}>
                        <div className="type-label">Admin notu</div>
                        <p className="type-body mt-0.5 whitespace-pre-wrap break-words">{t.adminNote}</p>
                      </div>
                    )}
                    <p className="type-caption mt-2">
                      Açılış: {fmtDateTime(t.createdAt)}
                      {t.resolvedAt && <> · Kapanış: {fmtDateTime(t.resolvedAt)}</>}
                    </p>
                  </div>
                  {!isOpen && !closed && (
                    <button type="button" className="btn-secondary flex-shrink-0"
                      onClick={() => { setOpenId(t.id); setNoteDraft(t.adminNote || '') }}>
                      Yanıtla
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'var(--ah-line)' }}>
                    <div>
                      <label htmlFor={noteId} className="label">Admin notu (isteğe bağlı)</label>
                      <textarea id={noteId} value={noteDraft} onChange={e => setNoteDraft(e.target.value)}
                        rows={3} className="input" placeholder="Talebe ilişkin kısa notun" />
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {t.status !== 'IN_PROGRESS' && (
                        <button type="button" disabled={busy} className="btn-secondary"
                          onClick={() => setStatus(t.id, 'IN_PROGRESS', noteDraft)}>İncelemeye al</button>
                      )}
                      <button type="button" disabled={busy} className="btn-primary !w-auto"
                        onClick={() => setStatus(t.id, 'RESOLVED', noteDraft)}>Çözüldü</button>
                      <button type="button" disabled={busy} className="btn-danger"
                        onClick={() => setStatus(t.id, 'DISMISSED', noteDraft)}>Reddet</button>
                      <button type="button" disabled={busy} className="btn-ghost"
                        onClick={() => { setOpenId(null); setNoteDraft('') }}>Vazgeç</button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </ListState>
    </div>
  )
}

/* ── İşletme doğrulama ── */
const BUSINESS_FILTERS = [
  { value: 'all',        label: 'Tümü' },
  { value: 'verified',   label: 'Doğrulanmış' },
  { value: 'unverified', label: 'Onay bekliyor' },
]

function BusinessesTab() {
  const confirm = useConfirm()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search.trim())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const verified = filter === 'all' ? null : filter === 'verified'
      setItems(await hotelApi.adminListBusinesses(verified, debouncedSearch))
    } catch (e) {
      setError(extractErrorMessage(e) || 'İşletmeler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [filter, debouncedSearch])

  useEffect(() => { load() }, [load])

  async function toggleVerified(biz) {
    if (biz.verifiedAt) {
      const ok = await confirm({
        title: 'Doğrulamayı kaldır',
        description: `"${biz.name}" işletmesinin doğrulandı rozeti kaldırılacak.`,
        confirmLabel: 'Doğrulamayı kaldır',
        destructive: true,
      })
      if (!ok) return
    }
    setBusyId(biz.id)
    try {
      await hotelApi.adminSetBusinessVerified(biz.id, !biz.verifiedAt)
      toast.success(biz.verifiedAt ? 'Doğrulama kaldırıldı' : 'İşletme doğrulandı')
      load()
    } catch (e) {
      toast.error(extractErrorMessage(e) || 'İşlem başarısız')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <TabHeader title="İşletmeler" description="Belgelerini kontrol ettiğin işletmeleri doğrula."
        count={loading ? undefined : items.length} countLabel="işletme" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <FilterChips label="Doğrulama filtresi" options={BUSINESS_FILTERS} value={filter} onChange={setFilter} />
        <SearchInput value={search} onChange={setSearch} label="İşletme ara"
          placeholder="İşletme adı veya e-posta" className="flex-1 sm:max-w-xs sm:ml-auto" />
      </div>

      <ListState loading={loading} error={error} onRetry={load} empty={items.length === 0}
        emptyTitle="İşletme bulunamadı" emptyDescription="Aramayı ya da filtreyi değiştirip yeniden dene.">
        <ul className="space-y-2">
          {items.map(b => (
            <li key={b.id} className="card !p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="type-body font-semibold break-words" style={{ color: 'var(--ah-ink)' }}>{b.name}</span>
                  {b.verifiedAt
                    ? <span className="badge badge-positive"><Icon d={ICONS.check} className="w-3.5 h-3.5" /> Doğrulandı</span>
                    : <span className="badge badge-attention">Onay bekliyor</span>}
                </div>
                <div className="type-meta mt-0.5 break-words">
                  {labelOf(BUSINESS_TYPE_LABELS, b.type, 'İşletme')} · {b.district || 'İlçe yok'} · {b.ownerEmail}
                </div>
                {b.verifiedAt && (
                  <div className="type-caption mt-0.5">
                    Doğrulama: {fmtDateTime(b.verifiedAt)}{b.verifiedBy ? ` · yönetici #${b.verifiedBy}` : ''}
                  </div>
                )}
              </div>
              <button type="button" onClick={() => toggleVerified(b)} disabled={busyId === b.id}
                className={b.verifiedAt ? 'btn-ghost self-start sm:self-auto' : 'btn-primary sm:!w-auto'}>
                {b.verifiedAt ? 'Doğrulamayı kaldır' : 'Doğrula'}
              </button>
            </li>
          ))}
        </ul>
      </ListState>
    </div>
  )
}

/* ── Giden kuyruk (outbox) ── */
const OUTBOX_FILTERS = [
  { value: 'all',     label: 'Tümü' },
  { value: 'pending', label: 'Sırada' },
  { value: 'dead',    label: 'Başarısız' },
]

function OutboxTab() {
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await hotelApi.adminListOutbox(filter, 100))
    } catch (e) {
      setError(extractErrorMessage(e) || 'Giden kuyruk yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  async function retry(id) {
    setBusyId(id)
    try {
      await hotelApi.adminRetryOutbox(id)
      toast.success('Yeniden gönderim sırasına alındı')
      load()
    } catch (e) {
      toast.error(extractErrorMessage(e) || 'İşlem başarısız')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      <TabHeader title="Giden kuyruk" description="Arka planda gönderilen e-posta ve işlem kayıtları."
        count={loading ? undefined : items.length} countLabel="kayıt" />
      <FilterChips label="Kuyruk filtresi" options={OUTBOX_FILTERS} value={filter} onChange={setFilter} />

      <ListState loading={loading} error={error} onRetry={load} empty={items.length === 0}
        emptyType="generic" emptyTitle="Bu filtrede kayıt yok" emptyDescription="Kuyruk temiz görünüyor.">
        <ul className="space-y-2">
          {items.map(e => {
            const sm = statusMeta(OUTBOX_STATUS, e.status)
            return (
              <li key={e.id} className="card !p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <span className={sm.cls}>{sm.label}</span>
                    <span className="badge badge-neutral">{labelOf(OUTBOX_EVENT_LABELS, e.eventType, 'Diğer kayıt')}</span>
                    <span className="type-caption type-num">#{e.id}</span>
                  </div>
                  <p className="type-caption mt-1.5">
                    {e.attempts} deneme · {fmtDateTime(e.createdAt)}
                  </p>
                  {e.lastError && (
                    <p className="type-meta mt-1.5 break-words" style={{ color: 'var(--ah-danger)' }}>
                      Son hata: {e.lastError}
                    </p>
                  )}
                  {e.payloadPreview && (
                    <pre className="type-caption mt-2 p-2.5 rounded-lg whitespace-pre-wrap break-all overflow-x-auto"
                      style={{ background: 'var(--ah-band)', fontFamily: 'var(--font-mono)' }}>
                      {e.payloadPreview}
                    </pre>
                  )}
                </div>
                {e.status !== 'DELIVERED' && (
                  <button type="button" onClick={() => retry(e.id)} disabled={busyId === e.id}
                    className="btn-secondary flex-shrink-0 self-start">
                    Tekrar dene
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </ListState>
    </div>
  )
}
