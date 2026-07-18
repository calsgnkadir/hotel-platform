import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import { SENSITIVE_DOC_TYPES_BIZ, DOC_REQ_STATUS_LABELS } from '../lib/constants'
import { StatusBadge } from './Badges'
import cldImg, { ImgSize } from '../../../lib/cldImg'
import ReliabilityBadge from '../../../components/ReliabilityBadge'
import { celebrate } from '../../../lib/confetti'
import { useConfirm } from '../../../lib/useConfirm'

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
  const [accessibleDocs, setAccessibleDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [requestingType, setRequestingType] = useState('')

  // Erisilabilir belgeleri yukle
  useEffect(() => {
    if (!app) { setAccessibleDocs([]); return }
    setDocsLoading(true)
    hotelApi.getApplicationDocuments(app.id)
      .then(setAccessibleDocs)
      .catch(() => setAccessibleDocs([]))
      .finally(() => setDocsLoading(false))
  }, [app?.id, app?.documentRequests?.length])

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

  async function handleViewDoc(doc) {
    try {
      await hotelApi.viewDocument(doc.id)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    }
  }

  async function handleToggleFavorite() {
    if (!app?.candidate?.id) return
    setFavLoading(true)
    try {
      if (isFavorited) {
        await hotelApi.removeFavorite(app.candidate.id)
        setIsFavorited(false)
        toast.success('Favoriden kaldirildi')
      } else {
        await hotelApi.addFavorite(app.candidate.id, null)
        setIsFavorited(true)
        toast.success('Favorilere eklendi — "Favori Adaylar" sekmesinden eris')
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
      title: 'Adayı 24 saat HOLD\'a al',
      description: 'Aday 24 saat içinde Onayla/Reddet seçmezse başvuru otomatik düşecek. Bu, adayın gerçek niyetini test eden bir adımdır.',
      confirmLabel: 'Evet, HOLD\'a al',
    })
    if (!ok) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.holdApplication(app.id)
      toast.success('Aday HOLD\'a alındı — 24 saat bekleniyor')
      onChanged?.(updated)
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleNoShow() {
    const ok = await confirm({
      title: 'NO-SHOW olarak işaretle',
      description: 'Bu işlem geri alınamaz. Adayın strike hakkı 1 düşecek, sıfıra inerse 30 gün otomatik banlanacak.',
      confirmLabel: 'Evet, işaretle',
      destructive: true,
    })
    if (!ok) return
    setActionLoading(true)
    try {
      const result = await hotelApi.markNoShow(app.id)
      if (result.autoBanned) {
        const banDate = new Date(result.bannedUntil).toLocaleDateString('tr-TR')
        toast.success(`No-show işaretlendi. Aday otomatik olarak ${banDate} tarihine kadar banlandı.`, { duration: 5000 })
      } else {
        toast.success(`No-show işaretlendi. Adayın kalan strike hakkı: ${result.candidateStrikesRemaining}`)
      }
      onChanged?.(result.application)
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleRequestDoc() {
    if (!requestingType) return
    setActionLoading(true)
    try {
      const updated = await hotelApi.requestDocument(app.id, requestingType)
      toast.success('Belge talebi gönderildi')
      setRequestingType('')
      onChanged?.(updated)
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setActionLoading(false) }
  }

  async function handleStartConversation() {
    try {
      await hotelApi.startConversation({
        otherPartyId: app.candidate.id,
        applicationId: app.id,
      })
      onClose?.()
      onOpenMessages?.()
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
                style={{ border: '1px solid rgba(15, 118, 110, 0.22)' }} />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0"
                   style={{
                     background: 'linear-gradient(135deg, #b89e6e 0%, #8a7349 100%)',
                     color: '#ffffff',
                   }}>
                {app.candidate?.fullName?.charAt(0) || '?'}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="application-detail-title" className="type-heading truncate" style={{ fontSize: '16px' }}>
                  {app.candidate?.fullName}
                </h2>
                <ReliabilityBadge score={app.candidate?.reliabilityScore} size="md" showLabel />
              </div>
              <p className="type-caption truncate">{app.candidate?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => window.print()}
              title="Yazdir"
              className="no-print tier-raised tier-raised-hover w-8 h-8 flex items-center justify-center"
              style={{ borderRadius: '999px', color: 'var(--text-muted)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
            </button>
            <button onClick={handleToggleFavorite} disabled={favLoading}
              title={isFavorited ? 'Favoriden kaldir' : 'Favorilere ekle'}
              className={`no-print w-8 h-8 rounded-full flex items-center justify-center transition-all hover:-translate-y-0.5 disabled:opacity-50 ${
                isFavorited ? 'shadow-md' : 'tier-raised tier-raised-hover'
              }`}
              style={isFavorited
                ? { background: 'linear-gradient(135deg, #0f766e 0%, #0b5d57 100%)', color: '#ffffff' }
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
               style={{ background: 'rgba(15, 118, 110, 0.05)', color: 'var(--text-secondary)' }}>
            {app.listing?.title} · {app.listing?.businessName}
          </div>
        </div>

        {app.coverLetter && (
          <div>
            <h3 className="type-overline mb-2">Ön Yazı</h3>
            <div className="rounded-lg p-4 type-body leading-relaxed"
                 style={{ background: 'rgba(15, 118, 110, 0.05)', color: 'var(--text-secondary)' }}>
              {app.coverLetter}
            </div>
          </div>
        )}

        {app.availabilities?.length > 0 && (
          <div>
            <h3 className="type-overline mb-2">Müsaitlik Saatleri</h3>
            <div className="flex flex-wrap gap-2">
              {app.availabilities.map((av, i) => (
                <span key={i} className="px-3 py-1.5 type-caption font-medium rounded-lg"
                      style={{
                        background: 'rgba(15, 118, 110, 0.08)',
                        border: '1px solid rgba(15, 118, 110, 0.22)',
                        color: 'var(--accent-action)',
                      }}>
                  {av.dayOfWeek} · {av.startTime}–{av.endTime}
                </span>
              ))}
            </div>
          </div>
        )}

        {app.note && (
          <div>
            <h3 className="type-overline mb-2">Notunuz</h3>
            <div className="rounded-2xl p-3 type-body"
                 style={{
                   background: 'rgba(200, 146, 58, 0.10)',
                   border: '1px solid rgba(200, 146, 58, 0.28)',
                   color: '#e0b766',
                 }}>
              {app.note}
            </div>
          </div>
        )}

        {/* Görüntülenebilir Belgeler */}
        <div>
          <h3 className="type-overline mb-2">Görüntülenebilir Belgeler</h3>
          {docsLoading ? (
            <p className="type-caption">Yükleniyor...</p>
          ) : accessibleDocs.length === 0 ? (
            <p className="type-caption mb-3">
              Bu aday henüz belge yüklememiş veya hassas belgeler için izin yok.
            </p>
          ) : (
            <div className="space-y-1.5 mb-3">
              {accessibleDocs.map(doc => {
                const typeLabel = (
                  SENSITIVE_DOC_TYPES_BIZ.find(t => t.type === doc.type)?.label
                ) || doc.type
                return (
                  <div key={doc.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 gap-2"
                    style={{ background: 'rgba(15, 118, 110, 0.05)' }}>
                    <div className="min-w-0 flex-1">
                      <div className="type-body font-medium truncate" style={{ color: 'var(--text-secondary)' }}>{typeLabel}</div>
                      <div className="type-caption truncate">{doc.originalFileName}</div>
                    </div>
                    <button onClick={() => handleViewDoc(doc)}
                      className="type-overline px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
                      style={{
                        background: 'rgba(15, 118, 110, 0.10)',
                        border: '1px solid rgba(15, 118, 110, 0.28)',
                        color: 'var(--accent-action)',
                      }}>
                      Görüntüle
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Belge Talepleri */}
        <div>
          <h3 className="type-overline mb-2">Belge Talepleri</h3>

          {app.documentRequests?.length > 0 ? (
            <div className="space-y-1.5 mb-3">
              {app.documentRequests.map(dr => {
                const meta = SENSITIVE_DOC_TYPES_BIZ.find(t => t.type === dr.documentType)
                const statusMeta = DOC_REQ_STATUS_LABELS[dr.status] || { cls: 'badge-expired', label: dr.status }
                return (
                  <div key={dr.id} className="flex items-center justify-between rounded-lg px-3 py-2"
                       style={{ background: 'rgba(15, 118, 110, 0.05)' }}>
                    <span className="type-body" style={{ color: 'var(--text-secondary)' }}>{meta?.label || dr.documentType}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusMeta.cls}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="type-caption mb-3">Henüz belge talep edilmemiş</p>
          )}

          {['PENDING', 'REVIEWING'].includes(app.status) && (() => {
            const requestedTypes = new Set(app.documentRequests?.map(dr => dr.documentType) || [])
            const availableTypes = SENSITIVE_DOC_TYPES_BIZ.filter(t => !requestedTypes.has(t.type))
            if (availableTypes.length === 0) {
              return <p className="type-caption">Tüm hassas belge tipleri zaten talep edilmiş.</p>
            }
            return (
              <div className="flex gap-2">
                <select value={requestingType} onChange={e => setRequestingType(e.target.value)}
                  className="input text-sm flex-1">
                  <option value="">Belge tipi seç...</option>
                  {availableTypes.map(t => <option key={t.type} value={t.type}>{t.label}</option>)}
                </select>
                <button onClick={handleRequestDoc} disabled={!requestingType || actionLoading}
                  className="type-overline px-4 py-2 rounded-lg disabled:opacity-50 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #b89e6e 0%, #8a7349 100%)',
                    color: '#ffffff',
                  }}>
                  Talep Et
                </button>
              </div>
            )
          })()}
        </div>

        {/* KARAR */}
        {['PENDING', 'REVIEWING', 'HELD'].includes(app.status) && (
          <div className="border-t border-hairline pt-4 space-y-3">
            <h3 className="type-overline">Karar</h3>
            {app.status === 'HELD' ? (
              <p className="type-caption font-medium" style={{ color: '#e0b766' }}>
                HOLD aktif — aday {app.holdDeadline ? new Date(app.holdDeadline).toLocaleString('tr-TR') : 'belirsiz'} 'a kadar cevap vermeli
              </p>
            ) : (
              <p className="type-caption">
                Belgeleri ve mesajlasmayi inceledikten sonra karar verin. Bu islem geri alinmaz.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => handleDecide('ACCEPTED')} disabled={actionLoading}
                className="py-2.5 rounded-2xl type-overline text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #7a9f7a 0%, #5e8460 100%)',
                  boxShadow: '0 8px 22px rgba(122, 159, 122, 0.30)',
                }}>
                Kabul
              </button>
              {app.status !== 'HELD' && (
                <button onClick={handleHold} disabled={actionLoading}
                  className="py-2.5 rounded-2xl type-overline text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, #c8923a 0%, #a3762d 100%)',
                    boxShadow: '0 8px 22px rgba(200, 146, 58, 0.28)',
                  }}>
                  HOLD 24sa
                </button>
              )}
              <button onClick={() => handleDecide('REJECTED')} disabled={actionLoading}
                className={`py-2.5 rounded-2xl type-overline text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 ${app.status === 'HELD' ? 'col-span-2' : ''}`}
                style={{
                  background: 'linear-gradient(135deg, #b46a55 0%, #8f4e3d 100%)',
                  boxShadow: '0 8px 22px rgba(180, 106, 85, 0.30)',
                }}>
                Reddet
              </button>
            </div>
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
                background: 'linear-gradient(135deg, #0f766e 0%, #0b5d57 100%)',
                color: '#ffffff',
                boxShadow: '0 12px 28px rgba(15, 118, 110, 0.25), inset 0 1px 0 rgba(255,255,255,0.22)',
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
                background: 'linear-gradient(135deg, #0f766e 0%, #0b5d57 100%)',
                color: '#ffffff',
                boxShadow: '0 12px 28px rgba(15, 118, 110, 0.25), inset 0 1px 0 rgba(255,255,255,0.22)',
              }}>
              Mesaj Gönder
            </button>
          ) : null}
        </div>

        {/* No-show işaretleme */}
        {app.status === 'ACCEPTED' && !app.noShow && (
          <div className="border-t border-hairline pt-4 space-y-2">
            <h3 className="type-overline">İşe Gelme Durumu</h3>
            <p className="type-caption">
              Aday kabul edilen iş için işe gelmediyse aşağıdaki butonla işaretleyin.
              Aday 3 kez işe gelmediğinde otomatik olarak 30 gün banlanır.
            </p>
            <button onClick={handleNoShow}
              disabled={actionLoading}
              className="w-full py-3 rounded-2xl type-overline transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{
                background: 'rgba(180, 106, 85, 0.10)',
                color: '#d39481',
                border: '1px solid rgba(180, 106, 85, 0.30)',
              }}>
              Aday İşe Gelmedi (No-Show) Olarak İşaretle
            </button>
          </div>
        )}

        {/* No-show banner */}
        {app.noShow && (
          <div className="pt-4 border-t border-hairline">
            <div className="rounded-2xl px-4 py-3 flex items-start gap-2"
                 style={{
                   background: 'rgba(180, 106, 85, 0.10)',
                   border: '1px solid rgba(180, 106, 85, 0.28)',
                 }}>
              <div>
                <div className="type-body font-semibold" style={{ color: '#e3a896' }}>No-show olarak işaretlendi</div>
                <div className="type-caption mt-0.5" style={{ color: '#d39481' }}>
                  Bu aday kabul edilen iş için işe gelmediğini bildirdiniz. Strike hakkı düşürüldü.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
