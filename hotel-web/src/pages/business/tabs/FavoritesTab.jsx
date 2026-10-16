/**
 * FAZ 2/#32 — Favori adaylar + engellenen adaylar (Ekibim sekmesinde).
 *
 * Üstte "Favoriler / Engellenenler" sayaçlı segment (aday tarafı RelationsTab düzeni).
 * Favoriler: avatar/baş harf, ad, e-posta, ilçe, eklenme tarihi; Mesaj gönder + Kaldır.
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
         style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)', color: 'var(--ah-brand)' }}>
      {name?.charAt(0)?.toLocaleUpperCase('tr-TR') || '?'}
    </div>
  )
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('tr-TR')
}

/**
 * segment (isteğe bağlı): dışarıdan denetlenen görünüm ('favorites' | 'blocked').
 * Verilirse kendi segment çubuğu gizlenir — Ekibim sekmesi (TeamTab) tek bir
 * segment çubuğuyla üç görünümü yönetir.
 */
export default function FavoritesTab({ onOpenMessages, segment: controlledSegment }) {
  const [ownSegment, setSegment] = useState('favorites')
  const controlled = controlledSegment === 'favorites' || controlledSegment === 'blocked'
  const segment = controlled ? controlledSegment : ownSegment
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
      {!controlled && (
      <div className="ah-segment" role="tablist" aria-label="Aday listeleri">
        {segments.map(t => {
          const active = segment === t.id
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active}
              onClick={() => setSegment(t.id)}
              className={`ah-segment__item inline-flex items-center gap-1.5 ${active ? 'is-active' : ''}`}>
              {t.label}
              {t.count > 0 && (
                <span className="type-caption type-num">{t.count > 99 ? '99+' : t.count}</span>
              )}
            </button>
          )
        })}
      </div>
      )}

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
            className="btn-secondary flex-shrink-0">
            {unblockingId === b.candidateId ? 'Kaldırılıyor…' : 'Engeli kaldır'}
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
      title: 'Favorilerden kaldır',
      description: `"${name || 'Aday'}" favori listenden çıkarılacak.`,
      confirmLabel: 'Favorilerden kaldır',
      destructive: true,
    })
    if (!ok) return
    setRemovingId(candidateId)
    try {
      await hotelApi.removeFavorite(candidateId)
      toast.success('Favorilerden kaldırıldı')
      await load()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setRemovingId(null) }
  }

  async function handleStartChat(candidateId) {
    setOpeningChatId(candidateId)
    try {
      const conv = await hotelApi.startConversation({ otherPartyId: candidateId })
      onOpenMessages?.(conv?.id)
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
          title="Henüz favori aday yok"
          description="Beğendiğin adayları buraya topla, sonraki ilanda hızlıca ulaş:"
          steps={[
            { label: 'Başvurular sekmesinde adayı aç', hint: 'Aday kartına tıklayıp ayrıntıyı aç' },
            { label: 'Favorilere ekle',                hint: 'Aday anında bu listeye eklenir' },
            { label: 'Yeni ilan açtığında',            hint: 'Favori adaylarına buradan mesaj at' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="type-meta type-num">
        {favorites.length} favori aday. Yeni bir ilan açtığında buradan mesajla ulaşabilirsin.
      </p>

      {favorites.map(f => {
        const added = formatDate(f.createdAt)
        return (
          <div key={f.id} className="card !p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <CandidateAvatar url={f.candidateAvatarUrl} name={f.candidateName} />
              <div className="flex-1 min-w-0">
                <div className="type-body font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>
                  {f.candidateName}
                </div>
                {f.candidateEmail && (
                  <div className="type-meta truncate">{f.candidateEmail}</div>
                )}
                {(f.candidateDistrict || added) && (
                  <div className="type-caption mt-0.5">
                    {[f.candidateDistrict, added && `${added} tarihinde eklendi`].filter(Boolean).join(' · ')}
                  </div>
                )}
                {f.note && (
                  <p className="type-meta mt-1.5 line-clamp-2 break-words">Not: {f.note}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button type="button" onClick={() => handleStartChat(f.candidateId)}
                disabled={openingChatId === f.candidateId}
                className="btn-secondary flex-1 sm:flex-none">
                {openingChatId === f.candidateId ? 'Açılıyor…' : 'Mesaj gönder'}
              </button>
              <button type="button" onClick={() => handleRemove(f.candidateId, f.candidateName)}
                disabled={removingId === f.candidateId}
                className="btn-danger flex-1 sm:flex-none">
                {removingId === f.candidateId ? 'Kaldırılıyor…' : 'Kaldır'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
