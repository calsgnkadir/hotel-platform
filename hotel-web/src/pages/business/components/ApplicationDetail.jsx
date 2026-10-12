import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
// App'teki QueryClientProvider ile ayni ornek; bilesen provider'siz da render edilebilir
import { queryClient, keys } from '../../../lib/queryClient'
import { StatusBadge, NoShowBadge } from './Badges'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import { celebrate } from '../../../lib/confetti'
import { useConfirm } from '../../../lib/useConfirm'
import { SgkNotice } from '../../../components/LegalNotice'   // FAZ C.3
import { WEEKDAYS } from '../lib/constants'
import { compareSlots, formatSlotShort, isNoShowAllowed } from '../../../lib/shiftTime'

const DAY_LABEL = Object.fromEntries(WEEKDAYS.map(d => [d.key, d.label]))

/**
 * FAZ 11.W2.2 — Basvuru detayi, standalone panel.
 *
 * Eski ApplicationsTab modal body'sinden cikarildi. Self-contained:
 * belge yukleme, favori toggle, karar butonlari, no-show — hepsi iceride.
 * Confirm'ler FAZ 8 useConfirm hook'u ile (parent'ta ConfirmDialog state yok).
 *
 * variant:
 *   'panel' — split-view sag panel (Wave 2) + message hub context panel (Wave 3)
 *   'modal' — mobile fallback (tam ekran overlay icinde)
 *
 * onChanged(updatedApp) — decision/hold/no-show sonrasi parent'in selected
 * state'ini senkronize etmesi icin.
 */
export default function ApplicationDetail({ app, variant = 'panel', onClose, onRefresh, onOpenMessages, onChanged }) {
  const confirm = useConfirm()
  const [actionLoading, setActionLoading] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  // Gelmedi: birden fazla uygun vardiya varsa seçim listesi açılır
  const [pickingNoShow, setPickingNoShow] = useState(false)
  // Favori durumu
  const [isFavorited, setIsFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  useEffect(() => {
    if (!app?.candidate?.id) { setIsFavorited(false); return }
    hotelApi.checkFavorite(app.candidate.id)
      .then(setIsFavorited)
      .catch(() => setIsFavorited(false))
  }, [app?.candidate?.id])

  if (!app) return null

  // Vardiya bazlı gelmedi: işaretlenen slot requestedSlots'ta kalır, noShowSlotIds'te listelenir
  const noShowIds = new Set((app.noShowSlotIds || []).map(String))
  const isSlotNoShow = (slot) => slot?.id != null && noShowIds.has(String(slot.id))
  const sortedSlots = [...(app.requestedSlots || [])].sort(compareSlots)
  // Seçilebilir: başlangıç + 30 dk geçmiş (gece vardiyası dahil) ve henüz işaretlenmemiş
  const noShowCandidates = sortedSlots.filter(s => s?.id != null && !isSlotNoShow(s) && isNoShowAllowed(s))

  async function handleToggleFavorite() {
    if (!app?.candidate?.id) return
    setFavLoading(true)
    try {
      if (isFavorited) {
        await hotelApi.removeFavorite(app.candidate.id)
        setIsFavorited(false)
        toast.success('Favorilerden kaldırıldı')
      } else {
        await hotelApi.addFavorite(app.candidate.id, null)
        setIsFavorited(true)
        toast.success('Favorilere eklendi. "Favori Adaylar" sayfasından ulaşabilirsin.')
      }
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setFavLoading(false) }
  }

  async function handleDecide(decision) {
    const isAccept = decision === 'ACCEPTED'
    const ok = await confirm({
      title: isAccept ? 'Adayı kabul et' : 'Adayı reddet',
      description: isAccept
        ? 'Aday bildirim alacak ve çalışmaya başlayabilecek.'
        : 'Aday bildirim alacak. Kararı sonra değiştiremezsiniz.',
      confirmLabel: isAccept ? 'Evet, kabul et' : 'Evet, reddet',
      destructive: !isAccept,
    })
    if (!ok) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.reviewApplication(app.id, decision)
      toast.success(isAccept ? 'Aday kabul edildi' : 'Aday reddedildi')
      if (isAccept) celebrate()
      onChanged?.(updated)
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleHold() {
    const ok = await confirm({
      title: 'Adayı 24 saat beklemeye al',
      description: 'Aday 24 saat içinde Onayla/Reddet seçmezse başvuru otomatik düşecek. Bu, adayın gerçek niyetini test eden bir adımdır.',
      confirmLabel: 'Evet, beklemeye al',
    })
    if (!ok) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.holdApplication(app.id)
      toast.success('Aday beklemeye alındı — 24 saat yanıtı bekleniyor')
      onChanged?.(updated)
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  // FAZ C.1 — Yedek aday: no-show olursa otomatik cagrilir
  async function handleStandby() {
    const ok = await confirm({
      title: 'Yedek listesine al',
      description: 'Asıl aday gelmezse bu adaya otomatik acil teklif gider. Aday şimdi yedek olduğuna dair bildirim alır.',
      confirmLabel: 'Evet, yedeğe al',
    })
    if (!ok) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.markStandby(app.id)
      toast.success('Aday yedek listesine alındı')
      onChanged?.(updated)
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleRemoveStandby() {
    setActionLoading(true)
    try {
      const updated = await hotelApi.removeStandby(app.id)
      toast.success('Aday yedeklikten çıkarıldı')
      onChanged?.(updated)
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  function startNoShow() {
    if (noShowCandidates.length === 1) { handleNoShow(noShowCandidates[0]); return }
    setPickingNoShow(true)
  }

  async function handleNoShow(slot) {
    const ok = await confirm({
      title: 'Gelmedi olarak işaretle',
      description: `${formatSlotShort(slot)} vardiyası gelmedi olarak işaretlenecek. Bu vardiya için adaya 1 ceza puanı düşer. Bu işlem geri alınamaz.`,
      confirmLabel: 'Evet, işaretle',
      destructive: true,
    })
    if (!ok) return
    setActionLoading(true)
    try {
      const result = await hotelApi.markNoShow(app.id, slot.id)
      if (result?.autoBanned) {
        const banDate = new Date(result.bannedUntil).toLocaleDateString('tr-TR')
        toast.success(`Gelmedi olarak işaretlendi. Aday ${banDate} tarihine kadar otomatik olarak askıya alındı.`, { duration: 5000 })
      } else {
        toast.success(`Gelmedi olarak işaretlendi. Adayın kalan ceza hakkı: ${result?.candidateStrikesRemaining ?? '-'}`)
      }
      setPickingNoShow(false)
      if (result?.application) onChanged?.(result.application)
      queryClient.invalidateQueries({ queryKey: keys.applications.business() })
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  // Adayı engelle: süren başvurular backend'de reddedilir, ACCEPTED korunur.
  async function handleBlockCandidate() {
    const candidateId = app?.candidate?.id
    if (!candidateId) return
    const ok = await confirm({
      title: 'Adayı engelle',
      description: 'Bu aday işletmenin ilanlarına başvuramaz ve sana mesaj gönderemez. Süren başvuruları reddedilir; kabul edilmiş vardiyalar etkilenmez. Aday bilgilendirilmez.',
      confirmLabel: 'Evet, engelle',
      destructive: true,
    })
    if (!ok) return
    setBlockLoading(true)
    try {
      await hotelApi.blockCandidate(candidateId)
      toast.success('Aday engellendi.')
      queryClient.invalidateQueries({ queryKey: keys.applications.business() })
      queryClient.invalidateQueries({ queryKey: ['my-blocked-candidates'] })
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setBlockLoading(false) }
  }

  async function handleStartConversation() {
    try {
      const conv = await hotelApi.startConversation({
        otherPartyId: app.candidate.id,
        applicationId: app.id,
      })
      onClose?.()
      // Derin link: açılan/var olan sohbet doğrudan seçilsin
      onOpenMessages?.(conv?.id ?? app.conversationId)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  return (
    <div className={variant === 'panel' ? 'flex flex-col h-full overflow-hidden' : ''}>
      {/* ── Header: avatar + name + actions ── */}
      <div className="p-5 border-b border-hairline flex-shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {app.candidate?.avatarUrl ? (
              <img src={cldImg(app.candidate.avatarUrl, { w: ImgSize.avatarMd })} alt={app.candidate.fullName}
                loading="lazy" decoding="async"
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                style={{ border: '1px solid rgba(31, 41, 55, 0.22)' }} />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                   style={{
                     background: 'var(--ah-brand-soft)',
                     color: 'var(--ah-brand)',
                     border: '1px solid var(--ah-line)',
                   }}>
                {app.candidate?.fullName?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="application-detail-title" className="type-heading truncate" style={{ fontSize: '16px' }}>
                  {app.candidate?.fullName}
                </h2>
              </div>
              <p className="type-caption truncate">{app.candidate?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => window.print()}
              title="Yazdır" aria-label="Yazdır"
              className="no-print tier-raised tier-raised-hover w-8 h-8 flex items-center justify-center"
              style={{ borderRadius: '999px', color: 'var(--text-muted)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
            </button>
            <button onClick={handleToggleFavorite} disabled={favLoading}
              title={isFavorited ? 'Favorilerden kaldır' : 'Favorilere ekle'}
              aria-label={isFavorited ? 'Favorilerden kaldır' : 'Favorilere ekle'}
              className={`no-print w-8 h-8 rounded-full flex items-center justify-center transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
                isFavorited ? 'shadow-md' : 'tier-raised tier-raised-hover'
              }`}
              style={isFavorited
                ? { background: 'var(--ah-brand-gradient)', color: '#ffffff' }
                : { color: 'var(--text-muted)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                   fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor"
                   strokeWidth={1.8} className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
              </svg>
            </button>
            <StatusBadge status={app.status} />
            {variant === 'panel' && onClose && (
              <button onClick={onClose} title="Kapat"
                className="tier-raised tier-raised-hover w-8 h-8 flex items-center justify-center"
                style={{ borderRadius: '999px', color: 'var(--text-muted)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={`p-5 space-y-5 ${variant === 'panel' ? 'flex-1 overflow-y-auto' : ''}`}>
        <div>
          <h3 className="type-overline mb-2">İlan</h3>
          <div className="tier-ground rounded-lg p-3 type-body font-medium"
               style={{ background: 'rgba(31, 41, 55, 0.05)', color: 'var(--text-secondary)' }}>
            {app.listing?.title} · {app.listing?.businessName}
          </div>
        </div>

        {app.coverLetter && (
          <div>
            <h3 className="type-overline mb-2">Ön yazı</h3>
            <div className="rounded-lg p-4 type-body leading-relaxed"
                 style={{ background: 'rgba(31, 41, 55, 0.05)', color: 'var(--text-secondary)' }}>
              {app.coverLetter}
            </div>
          </div>
        )}

        {sortedSlots.length > 0 && (
          <div>
            <h3 className="type-overline mb-2">Vardiyalar</h3>
            <ul className="space-y-1.5" data-testid="application-slots">
              {sortedSlots.map((slot, i) => (
                <li key={slot.id ?? i} className="flex items-center justify-between gap-2 type-body"
                    style={{ color: 'var(--ah-ink-2)' }}>
                  <span className="tabular-nums">{formatSlotShort(slot)}</span>
                  {isSlotNoShow(slot) && <NoShowBadge label="Gelmedi" />}
                </li>
              ))}
            </ul>
          </div>
        )}

        {app.availabilities?.length > 0 && (
          <div>
            <h3 className="type-overline mb-2">Müsaitlik Saatleri</h3>
            <div className="flex flex-wrap gap-2">
              {app.availabilities.map((av, i) => (
                <span key={i} className="px-3 py-1.5 type-caption font-medium rounded-lg"
                      style={{
                        background: 'rgba(31, 41, 55, 0.08)',
                        border: '1px solid rgba(31, 41, 55, 0.22)',
                        color: 'var(--accent-action)',
                      }}>
                  {DAY_LABEL[av.dayOfWeek] || av.dayOfWeek} · {String(av.startTime || '').slice(0, 5)}–{String(av.endTime || '').slice(0, 5)}
                </span>
              ))}
            </div>
          </div>
        )}

        {app.note && (
          <div>
            <h3 className="type-overline mb-2">Notunuz</h3>
            <div className="rounded-lg p-3 type-body" data-testid="application-note"
                 style={{
                   background: 'var(--ah-band)',
                   border: '1px solid var(--ah-line)',
                   color: 'var(--ah-ink-2)',
                 }}>
              {app.note}
            </div>
          </div>
        )}

        {/* Belge sohbetten: mesajla iste, aday hazır belgesini tek tıkla gönderir */}
        <div>
          <button onClick={handleStartConversation}
            className="type-overline w-full px-4 py-2 rounded-lg transition-all"
            style={{ background: 'rgba(31, 41, 55, 0.08)', color: 'var(--accent-action)', border: '1px solid rgba(31, 41, 55, 0.22)' }}>
            Sohbete git
          </button>
          <p className="type-caption mt-1.5">
            Gerekli belgeleri sohbette iste. Aday dosyasını doğrudan bu sohbete ekleyebilir; paylaşılan dosyalar sohbette görünür.
          </p>
        </div>

        {/* FAZ C.1 — Yedek durumu paneli */}
        {app.status === 'STANDBY' && (
          <div className="border-t border-hairline pt-4 space-y-3">
            <h3 className="type-overline">Yedek Aday</h3>
            <div className="rounded-xl p-3" style={{ background: 'var(--ah-info-soft)', border: '1px solid var(--ah-info)' }}>
              <div className="text-[13px] font-semibold" style={{ color: 'var(--ah-info)' }}>
                {app.standbyRank ? `${app.standbyRank}. yedek` : 'Yedek listesinde'}
              </div>
              <div className="text-[12px] mt-1" style={{ color: '#3f4b4a' }}>
                {app.standbyOfferActive
                  ? `Acil teklif gönderildi — aday ${app.standbyDeadline
                      ? new Date(app.standbyDeadline).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                      : ''} saatine kadar cevap verecek.`
                  : 'Asıl aday no-show işaretlenirse bu adaya otomatik acil teklif gider.'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleDecide('ACCEPTED')} disabled={actionLoading}
                className="btn-primary !px-2">
                Direkt kabul
              </button>
              <button onClick={handleRemoveStandby} disabled={actionLoading}
                className="btn-secondary !px-2">
                Yedeklikten çıkar
              </button>
            </div>
          </div>
        )}

        {/* KARAR */}
        {['PENDING', 'REVIEWING', 'HELD'].includes(app.status) && (
          <div className="border-t border-hairline pt-4 space-y-3">
            <h3 className="type-overline">Karar</h3>
            {app.status === 'HELD' ? (
              <p className="type-caption font-medium" style={{ color: 'var(--ah-warn)' }}>
                Beklemede — aday {app.holdDeadline ? `${new Date(app.holdDeadline).toLocaleString('tr-TR')} tarihine kadar` : 'belirlenen süre içinde'} yanıt vermeli
              </p>
            ) : (
              <p className="type-caption">
                Belgeleri ve mesajlaşmayı inceledikten sonra karar verin. Bu işlem geri alınmaz.
              </p>
            )}
            {/* Karar düğmeleri: Kabul birincil, Beklet ikincil, Reddet tehlikeli */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleDecide('ACCEPTED')} disabled={actionLoading}
                className="btn-primary !px-2">
                Kabul et
              </button>
              {app.status !== 'HELD' && (
                <button onClick={handleHold} disabled={actionLoading}
                  className="btn-secondary !px-2">
                  24 sa beklet
                </button>
              )}
              <button onClick={() => handleDecide('REJECTED')} disabled={actionLoading}
                className={`btn-danger !px-2 ${app.status === 'HELD' ? 'col-span-2' : ''}`}>
                Reddet
              </button>
            </div>
            {/* FAZ C.1 — Yedeğe alma: kararı ertelemeden güvence oluştur */}
            <button onClick={handleStandby} disabled={actionLoading}
              className="btn-secondary w-full">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Yedeğe al
            </button>
            <p className="type-caption">
              Yedekteki aday, asıl aday gelmezse otomatik çağrılır — vardiyan boş kalmaz.
            </p>
          </div>
        )}

        {/* İletişim — filled amber CTA (panel-tekli accent) */}
        <div className="border-t border-hairline pt-4 space-y-3">
          <h3 className="type-overline">İletişim</h3>
          {app.conversationId ? (
            <button
              onClick={() => onOpenMessages?.(app.conversationId)}
              className="w-full py-3 rounded-2xl type-overline flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--ah-brand-gradient)',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
              }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                   strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round"
                      d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
              </svg>
              Mesajlaşmaya Git
            </button>
          ) : app.candidate?.id ? (
            <button
              onClick={handleStartConversation}
              className="w-full py-3 rounded-2xl type-overline flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--ah-brand-gradient)',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(18, 32, 31, 0.08)',
              }}>
              Mesaj Gönder
            </button>
          ) : null}
        </div>

        {/* FAZ C.3 — Kabul edilen aday: SGK ise giris bildirgesi hatirlatmasi */}
        {app.status === 'ACCEPTED' && (
          <div className="border-t border-hairline pt-4">
            <SgkNotice />
          </div>
        )}

        {/* Gelmedi işaretleme — vardiya bazlı */}
        {app.status === 'ACCEPTED' && sortedSlots.length > 0 && (
          <div className="border-t border-hairline pt-4 space-y-2" data-testid="no-show-section">
            <h3 className="type-overline">İşe gelme durumu</h3>
            <p className="type-caption">
              Aday kabul edilen bir vardiyaya gelmediyse o vardiyayı işaretleyin. Her işaret
              adaya 1 ceza puanı düşürür; ceza hakkı biten aday 30 gün askıya alınır.
            </p>
            {noShowCandidates.length === 0 ? (
              <p className="type-caption" style={{ color: 'var(--ah-ink-3)' }}>
                Gelmedi işareti vardiya başladıktan 30 dakika sonra verilebilir.
              </p>
            ) : pickingNoShow && noShowCandidates.length > 1 ? (
              <div className="space-y-2" role="group" aria-label="Gelmedi işaretlenecek vardiya">
                <p className="type-caption font-medium" style={{ color: 'var(--ah-ink-2)' }}>
                  Hangi vardiyaya gelmedi?
                </p>
                {noShowCandidates.map(slot => (
                  <button key={slot.id} type="button" onClick={() => handleNoShow(slot)}
                    disabled={actionLoading}
                    className="btn-secondary w-full !justify-start tabular-nums">
                    {formatSlotShort(slot)}
                  </button>
                ))}
                <button type="button" onClick={() => setPickingNoShow(false)}
                  className="type-caption font-semibold" style={{ color: 'var(--ah-ink-3)' }}>
                  Vazgeç
                </button>
              </div>
            ) : (
              <button type="button" onClick={startNoShow} disabled={actionLoading}
                className="btn-secondary w-full">
                Gelmedi olarak işaretle
              </button>
            )}
          </div>
        )}

        {/* Bilgi bandı: en az bir vardiya gelmedi olarak işaretli */}
        {(app.noShow || noShowIds.size > 0) && (
          <div className="pt-4 border-t border-hairline">
            <div className="rounded-lg px-4 py-3 flex items-start gap-2" data-testid="no-show-banner"
                 style={{
                   background: 'var(--ah-warn-soft)',
                   border: '1px solid var(--ah-warn)',
                 }}>
              <div>
                <div className="type-body font-semibold" style={{ color: 'var(--ah-ink-2)' }}>
                  {noShowIds.size > 1 ? `${noShowIds.size} vardiya gelmedi olarak işaretlendi` : 'Gelmedi olarak işaretlendi'}
                </div>
                <div className="type-caption mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
                  İşaretlenen her vardiya için adaya 1 ceza puanı düştü.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Adayı engelle — ikincil/tehlikeli eylem, birincil eylemlerden ayrı */}
        {app.candidate?.id && (
          <div className="no-print border-t border-hairline pt-4 flex flex-col items-start gap-1.5">
            <button type="button" onClick={handleBlockCandidate} disabled={blockLoading}
              className="btn-danger md:!min-h-[34px] !px-3 !text-[13px]">
              {blockLoading ? 'Engelleniyor...' : 'Adayı engelle'}
            </button>
            <p className="type-caption">
              Engellenen aday ilanlarına başvuramaz ve sana mesaj gönderemez.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
