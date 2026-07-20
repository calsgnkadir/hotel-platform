/**
 * FAZ 2/#32 — Talent Pool / Favori Adaylar sekmesi.
 *
 * Isletmenin favorilerine ekledigi adaylari listeler.
 * - Avatar (varsa) veya initials
 * - Ad, email, ilce, eklendigi tarih
 * - "Mesajlasma" + "Favoriden Kaldir" butonlari
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import EmptyState from '../../../components/EmptyState'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import { useConfirm } from '../../../lib/useConfirm'

export default function FavoritesTab({ onOpenMessages }) {
  const confirm = useConfirm()
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)
  const [openingChatId, setOpeningChatId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const data = await hotelApi.listFavorites()
      setFavorites(data || [])
    } catch { setFavorites([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

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

  if (loading) {
    return <div className="card p-8 text-center text-ink-500">Favoriler yukleniyor...</div>
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
           style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #e0b766 100%)', borderColor: 'rgba(217,119,6,0.2)' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black flex items-center gap-2" style={{ color: '#78350f' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
              Talent Pool
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>
              Begendigin adaylari kaydet, sonradan dogrudan ulasab — ilan yayinlamadan calismaya davet et.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-3xl font-black" style={{ color: '#b45309' }}>{favorites.length}</div>
            <div className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#92400e' }}>Aday</div>
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
                   background: 'rgba(15, 118, 110, 0.08)',
                   border: '1px solid rgba(15, 118, 110, 0.22)',
                   color: '#0f766e',
                 }}>
              {f.candidateName?.charAt(0) || '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-ink-800 dark:text-ink-900 truncate">
              {f.candidateName}
            </div>
            <div className="text-xs text-ink-500 truncate">{f.candidateEmail}</div>
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
                background: 'linear-gradient(135deg, #0f766e 0%, #0b5d57 100%)',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
              }}>
              {openingChatId === f.candidateId ? '...' : 'Mesajla'}
            </button>
            <button onClick={() => handleRemove(f.candidateId, f.candidateName)}
              disabled={removingId === f.candidateId}
              className="text-[11px] px-3 py-2 rounded-2xl font-semibold uppercase tracking-[0.06em] transition-colors disabled:opacity-50"
              style={{
                background: 'rgba(180, 106, 85, 0.10)',
                color: '#d39481',
                border: '1px solid rgba(180, 106, 85, 0.28)',
              }}>
              {removingId === f.candidateId ? '...' : 'Kaldir'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
