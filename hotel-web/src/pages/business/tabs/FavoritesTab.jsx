/**
 * FAZ 2/#32 — Talent Pool / Favori Adaylar sekmesi + Engellenen adaylar.
 *
 * Üstte "Favoriler / Engellenenler" sayaçlı segment (aday tarafı RelationsTab düzeni).
 * Favoriler: avatar/baş harf, ad, e-posta, ilçe, eklenme tarihi; Mesajla + Kaldır.
 * Engellenenler: avatar/baş harf, ad, engellenme tarihi; Engeli kaldır.
 *   (Engellenenler listesi e-posta/telefon göstermez.)
 */
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import EmptyState from '../../../components/EmptyState'
import { SkeletonList } from '../../../components/Skeleton'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import { useConfirm } from '../../../lib/useConfirm'

// ApplicationDetail'deki "Adayı engelle" de bu anahtarı invalidate eder.
const BLOCKED_CANDIDATES_KEY = ['my-blocked-candidates']

function CandidateAvatar({ url, name }) {
  if (url) {
    return (
      <img src={cldImg(url, { w: ImgSize.avatarSm })} alt={name}
        loading="lazy" decoding="async"
        className="w-12 h-12 rounded-full object-cover border border-cream-300 flex-shrink-0" />
    )
  }
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg flex-shrink-0"
         aria-hidden="true"
         style={{
           background: 'rgba(31, 41, 55, 0.08)',
           border: '1px solid rgba(31, 41, 55, 0.22)',
           color: '#1f2937',
         }}>
      {name?.charAt(0) || '?'}
    </div>
  )
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR')
}

export default function FavoritesTab({ onOpenMessages }) {
  const [segment, setSegment] = useState('favorites')
  const [favCount, setFavCount] = useState(0)

  const blockedQuery = useQuery({
    queryKey: BLOCKED_CANDIDATES_KEY,
    queryFn: () => hotelApi.getMyBlockedCandidates(),
  })
  const blockedCount = Array.isArray(blockedQuery.data) ? blockedQuery.data.length : 0

  const segments = [
    { id: 'favorites', label: 'Favoriler',     count: favCount },
    { id: 'blocked',   label: 'Engellenenler', count: blockedCount },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist" aria-label="Aday listeleri">
        {segments.map(t => {
          const active = segment === t.id
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active}
              onClick={() => setSegment(t.id)}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors"
              style={{
                background: active ? 'rgba(31, 41, 55, 0.14)' : 'var(--ah-card)',
                color: active ? '#1f2937' : 'var(--ah-ink-3)',
                border: `1px solid ${active ? 'rgba(31, 41, 55, 0.42)' : 'var(--ah-line)'}`,
              }}>
              {t.label}
              {t.count > 0 && (
                <span className="text-[11px] font-semibold tabular-nums opacity-80">{t.count > 99 ? '99+' : t.count}</span>
              )}
            </button>
          )
        })}
      </div>

      {segment === 'favorites'
        ? <FavoritesList onOpenMessages={onOpenMessages} onCount={setFavCount} />
        : <BlockedList query={blockedQuery} />}
    </div>
  )
}

function BlockedList({ query }) {
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [unblockingId, setUnblockingId] = useState(null)
  const { data, isLoading, isError, refetch } = query
  const blocked = Array.isArray(data) ? data : []

  async function handleUnblock(candidateId, name) {
    const ok = await confirm({
      title: 'Engeli kaldır',
      description: `"${name || 'Aday'}" yeniden ilanlarına başvurabilecek ve sana mesaj gönderebilecek. Daha önce reddedilen başvurular geri gelmez.`,
      confirmLabel: 'Evet, engeli kaldır',
    })
    if (!ok) return
    setUnblockingId(candidateId)
    try {
      await hotelApi.unblockCandidate(candidateId)
      toast.success('Engel kaldırıldı.')
      await queryClient.invalidateQueries({ queryKey: BLOCKED_CANDIDATES_KEY })
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setUnblockingId(null) }
  }

  if (isLoading) return <SkeletonList count={3} />

  if (isError) {
    return (
      <div className="card p-6 text-center space-y-3" role="alert">
        <p className="type-body">Engellenen adaylar yüklenemedi.</p>
        <button type="button" onClick={() => refetch()} className="btn-secondary">Tekrar dene</button>
      </div>
    )
  }

  if (blocked.length === 0) {
    return (
      <div className="card">
        <EmptyState
          compact
          title="Engellediğin aday yok."
          description="Bir adayı başvuru detayındaki “Adayı engelle” düğmesiyle engelleyebilirsin."
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {blocked.map(b => (
        <div key={b.candidateId} className="card p-4 flex items-center gap-3">
          <CandidateAvatar url={b.candidateAvatarUrl} name={b.candidateName} />
          <div className="flex-1 min-w-0">
            <div className="type-body font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>
              {b.candidateName}
            </div>
            {formatDate(b.blockedAt) && (
              <div className="type-caption mt-0.5">{formatDate(b.blockedAt)} tarihinde engellendi</div>
            )}
          </div>
          <button type="button"
            onClick={() => handleUnblock(b.candidateId, b.candidateName)}
            disabled={unblockingId === b.candidateId}
            className="btn-secondary flex-shrink-0 !px-3 !text-[13px]">
            {unblockingId === b.candidateId ? 'Kaldırılıyor...' : 'Engeli kaldır'}
          </button>
        </div>
      ))}
    </div>
  )
}

function FavoritesList({ onOpenMessages, onCount }) {
  const confirm = useConfirm()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)
  const [openingChatId, setOpeningChatId] = useState(null)
  const [loadError, setLoadError] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await hotelApi.listFavorites()
      setFavorites(data || [])
      setLoadError(false)
    } catch { setFavorites([]); setLoadError(true) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])
  useEffect(() => { onCount?.(favorites.length) }, [favorites.length, onCount])

  async function handleRemove(candidateId, name) {
    const ok = await confirm({
      title: 'Favoriden kaldır',
      description: `"${name}" adayı favori listenden çıkarılacak.`,
      confirmLabel: 'Evet, kaldır',
      destructive: true,
    })
    if (!ok) return
    setRemovingId(candidateId)
    try {
      await hotelApi.removeFavorite(candidateId)
      toast.success('Favoriden kaldirildi')
      await load()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setRemovingId(null) }
  }

  async function handleStartChat(candidateId) {
    setOpeningChatId(candidateId)
    try {
      await hotelApi.startConversation({ otherPartyId: candidateId })
      onOpenMessages?.()
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setOpeningChatId(null)
    }
  }

  if (loading) return <SkeletonList count={3} />

  if (loadError) {
    return (
      <div className="card p-6 text-center space-y-3" role="alert">
        <p className="type-body">Favoriler yüklenemedi.</p>
        <button type="button" onClick={load} className="btn-secondary">Tekrar dene</button>
      </div>
    )
  }

  if (favorites.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="favorites"
          title="Talent Pool'un boş"
          description="Beğendiğin adayları buraya topla, sonraki ilanda hızlıca eriş:"
          steps={[
            { label: 'Gelen Başvurular > adaya gir', hint: 'Aday kartına tıklayıp detay modali aç' },
            { label: 'Sağ üstte yıldıza tıkla',     hint: 'Anında favoriler listesine eklenir' },
            { label: 'Yeni ilan açtığında',          hint: 'Talent Pool tek tuşla davet etmen için burada' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="card p-4"
           style={{ background: 'linear-gradient(135deg, #f2f2f2 0%, #bababa 100%)', borderColor: 'rgba(132, 132, 132, 0.2)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2" style={{ color: '#414141' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
              Talent Pool
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#4e4e4e' }}>
              Begendigin adaylari kaydet, sonradan dogrudan ulasab — ilan yayinlamadan calismaya davet et.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-black" style={{ color: '#626262' }}>{favorites.length}</div>
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#4e4e4e' }}>Aday</div>
          </div>
        </div>
      </div>

      {/* Liste */}
      {favorites.map(f => (
        <div key={f.id} className="card p-4 flex items-center gap-3">
          {f.candidateAvatarUrl ? (
            <img src={cldImg(f.candidateAvatarUrl, { w: ImgSize.avatarSm })} alt={f.candidateName}
              loading="lazy" decoding="async"
              className="w-12 h-12 rounded-full object-cover border border-cream-300 flex-shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg flex-shrink-0"
                 style={{
                   background: 'rgba(31, 41, 55, 0.08)',
                   border: '1px solid rgba(31, 41, 55, 0.22)',
                   color: '#1f2937',
                 }}>
              {f.candidateName?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-800 dark:text-ink-900 truncate">
              {f.candidateName}
            </div>
            {f.candidateEmail && (
              <div className="text-xs text-ink-500 truncate">{f.candidateEmail}</div>
            )}
            <div className="text-[11px] text-ink-400 mt-0.5">
              {f.candidateDistrict ? `${f.candidateDistrict} · ` : ''}
              {new Date(f.createdAt).toLocaleDateString('tr-TR')} tarihinde eklendi
            </div>
            {f.note && (
              <div className="mt-1 text-xs italic text-ink-500 line-clamp-2">"{f.note}"</div>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={() => handleStartChat(f.candidateId)}
              disabled={openingChatId === f.candidateId}
              className="text-[11px] px-3 py-2 rounded-2xl font-semibold uppercase tracking-[0.06em] transition-all hover:-translate-y-0.5 disabled:opacity-50"
              style={{
                background: 'var(--ah-brand-gradient)',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
              }}>
              {openingChatId === f.candidateId ? '...' : 'Mesajla'}
            </button>
            <button onClick={() => handleRemove(f.candidateId, f.candidateName)}
              disabled={removingId === f.candidateId}
              className="text-[11px] px-3 py-2 rounded-2xl font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-50"
              style={{
                background: 'rgba(107, 117, 116, 0.10)',
                color: '#6b7574',
                border: '1px solid rgba(107, 117, 116, 0.28)',
              }}>
              {removingId === f.candidateId ? '...' : 'Kaldir'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
