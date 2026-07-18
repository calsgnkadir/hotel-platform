// FAZ 5.2 — CandidateDashboard'dan ayrildi (god class refactor)
// Redesign: glass cards + status accent rail + Geist + motion micro-interactions
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import * as hotelApi from '../../../api/hotel'
import { extractErrorMessage } from '../../../api/client'
import { keys } from '../../../lib/queryClient'
import EmptyState from '../../../components/EmptyState'
import ReviewModal from '../../../components/ReviewModal'
import { CAND_STATUS_FILTERS } from '../../../components/candidate/StatusBadge'
import { useConfirm } from '../../../lib/useConfirm'
import SlotChipGroup from '../../../components/SlotChipGroup'
import { formatSalary } from '../../../lib/salary'

/* REDESIGN v3 — açık zemin için durum renkleri (soft bg + koyu okunur metin) */
const STATUS_CONFIG = {
  PENDING:   { label: 'Bekliyor',     color: '#b7791f', soft: '#fbf1e0', text: '#8a5e17' },   // amber
  REVIEWING: { label: 'İnceleniyor',  color: '#1f57c3', soft: '#eaf1fd', text: '#1a49a6' },   // info blue
  HELD:      { label: 'Hold · 24sa',  color: '#9a6a1f', soft: '#f6ecd9', text: '#7c5518' },   // deep amber
  ACCEPTED:  { label: 'Kabul',        color: '#0a7c42', soft: '#e9f5ee', text: '#086335' },  // green
  REJECTED:  { label: 'Red',          color: '#c0392b', soft: '#fbeae7', text: '#992d22' },   // red
  WITHDRAWN: { label: 'İptal',        color: '#6b7574', soft: '#eef1f2', text: '#545c5b' },   // gri
  EXPIRED:   { label: 'Süresi Doldu', color: '#98a1a0', soft: '#eef1f2', text: '#6b7574' },   // faint
}

const DOC_TYPE_LABELS = {
  CV: 'CV',
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  CRIMINAL_RECORD: 'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT: 'Kimlik Fotokopisi',
}

/* Kariyer.net tarzi satir listesi (FAZ 22) — logo rengi + gorece tarih */
const LOGO_COLORS = ['#1f3a5f', '#7a1f3d', '#1f5f4a', '#5a3a1f', '#2f4858', '#3a4a2f', '#5f3a2f']
function appLogoColor(name) {
  let h = 0; const t = name || '?'
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0
  return LOGO_COLORS[h % LOGO_COLORS.length]
}
function appRelative(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d <= 0) return 'bugün'
  if (d === 1) return 'dün'
  if (d < 7) return d + ' gün önce'
  if (d < 30) return Math.floor(d / 7) + ' hafta önce'
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function ApplicationsTab({ applications: rawApplications, onRefresh, onOpenMessages, onTabChange }) {
  const confirm = useConfirm()
  // Suresi gecen + tamamlanmis isler "Basvurularim"da gorunmez (Gecmis Islerim'e gider)
  const applications = (rawApplications || []).filter(a => {
    if (a.status === 'EXPIRED') return false
    if (a.workCompleted) return false
    return true
  })

  const [respondingId, setRespondingId] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  // FAZ 11.W1.1 — Rich card: anywhere-click expands detail inline.
  // Wave 2'de split-panel gelince bu state kaldirilir.
  const [expandedId, setExpandedId] = useState(null)

  const { data: myDocs = [] } = useQuery({
    queryKey: keys.documents.my(),
    queryFn: () => hotelApi.getMyDocuments(),
    staleTime: 60 * 1000,
    retry: 0,
  })

  const uploadedTypes = new Set(myDocs.map(d => d.type))

  async function handleRespond(reqId, grant) {
    setRespondingId(reqId)
    try {
      await hotelApi.respondDocumentRequest(reqId, grant)
      toast.success(grant ? 'Belgeye izin verildi' : 'Talep reddedildi')
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setRespondingId(null) }
  }

  const [reviewTarget, setReviewTarget] = useState(null)

  const [withdrawingId, setWithdrawingId] = useState(null)
  async function handleWithdraw(appId) {
    const ok = await confirm({
      title: 'Başvuruyu iptal et',
      description: 'Bu işlem geri alınamaz. Emin misin?',
      confirmLabel: 'Evet, iptal et',
      destructive: true,
    })
    if (!ok) return
    setWithdrawingId(appId)
    try {
      await hotelApi.withdrawApplication(appId)
      toast.success('Başvurunuz iptal edildi')
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setWithdrawingId(null) }
  }

  const [holdRespondingId, setHoldRespondingId] = useState(null)
  async function handleHoldRespond(appId, accept) {
    const ok = await confirm(accept
      ? {
          title: 'İşi onayla',
          description: 'Bağlayıcı bir kabul oluşturacaktır. Emin misin?',
          confirmLabel: 'Evet, onayla',
        }
      : {
          title: 'HOLD\'u reddet',
          description: 'İşletme başka bir aday seçebilir. Emin misin?',
          confirmLabel: 'Evet, reddet',
          destructive: true,
        })
    if (!ok) return
    setHoldRespondingId(appId)
    try {
      await hotelApi.respondToHold(appId, accept)
      toast.success(accept ? 'Onaylandi! Isletmeyle iletisime devam et.' : 'HOLD reddedildi.')
      onRefresh?.()
    } catch (err) { toast.error(extractErrorMessage(err)) }
    finally { setHoldRespondingId(null) }
  }

  if (applications.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="applications"
          title="Henüz başvurun yok"
          description="3 adımda ilk vardiyana çık:"
          steps={[
            { label: 'İlanları Keşfet',  hint: 'Pozisyon / vardiya / ilçeye göre filtrele' },
            { label: 'Başvur',           hint: 'Hangi vardiyalara müsaitsen seç, ön yazı yaz' },
            { label: 'Mesajlaşmaya başla', hint: 'İşletme sana yazınca burada takip et' },
          ]}
          ctaLabel="İlanları Keşfet"
          onCta={() => onTabChange?.('listings')}
        />
      </div>
    )
  }

  const filtered = statusFilter
    ? applications.filter(a => a.status === statusFilter)
    : applications

  return (
    <motion.div className="ah-surface space-y-3"
      initial="hidden" animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>

      {/* Status filtre chips */}
      <motion.div variants={CHIP_GROUP} className="flex gap-2 flex-wrap">
        {CAND_STATUS_FILTERS.map(f => {
          const count = f.value ? applications.filter(a => a.status === f.value).length : applications.length
          const isActive = statusFilter === f.value
          return (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={`chip ${isActive ? 'is-active' : ''}`}>
              <span className="text-[13.5px]"
                    style={{ fontWeight: isActive ? 600 : 500, letterSpacing: '-0.005em', textTransform: 'none' }}>
                {f.label}
              </span>
              <span className={`text-[11px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/25' : ''}`}
                    style={!isActive ? { background: 'var(--ah-brand-soft)', color: 'var(--ah-brand)' } : {}}>
                {count}
              </span>
            </button>
          )
        })}
      </motion.div>

      {filtered.length === 0 ? (
        <div className="card p-6">
          <EmptyState
            type="applications"
            title="Bu filtrede başvuru yok"
            description="Farklı bir durum seçerek diğer başvurularını görebilirsin."
            ctaLabel="Tümünü Göster"
            onCta={() => setStatusFilter('')}
            compact
          />
        </div>
      ) : (
      /* FAZ 22 — Kariyer.net tarzi: tek beyaz kart, cizgiyle ayrilmis satirlar. */
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {filtered.map((app, idx) => {
          const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING
          const isExpanded = expandedId === app.id
          const requestedSlots = app.requestedSlots || []
          const salaryStr = formatSalary(app.listing?.salaryMin, app.listing?.salaryMax, app.listing?.salaryType, app.listing?.tipsIncluded)
          const slot0 = requestedSlots[0]
          const initial = (app.listing?.businessName || '?').trim().charAt(0).toUpperCase()
          const hasPendingDoc = (app.documentRequests || []).some(dr => dr.status === 'PENDING')
          const hasAttention = !!app.note || hasPendingDoc
          const metaBits = [
            requestedSlots.length > 0 && `${requestedSlots.length} vardiya`,
            slot0 && `${new Date(slot0.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} ${(slot0.startTime || '').slice(0, 5)}`,
            salaryStr,
          ].filter(Boolean)

          return (
            <div key={app.id} style={idx > 0 ? { borderTop: '1px solid var(--ah-line)' } : undefined}>
              {/* SATIR */}
              <div className="flex gap-3.5 p-4 cursor-pointer transition-colors"
                   onClick={() => setExpandedId(isExpanded ? null : app.id)}
                   onMouseEnter={(e) => { e.currentTarget.style.background = '#f7f9f9' }}
                   onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
                <span className="w-12 h-12 rounded-lg flex-shrink-0 grid place-items-center font-extrabold text-[17px] text-white"
                      style={{ background: appLogoColor(app.listing?.businessName) }}>{initial}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>{app.listing?.title || 'İlan'}</div>
                  <div className="text-[13px] truncate" style={{ color: 'var(--ah-ink-2)' }}>{app.listing?.businessName || ''}</div>
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 mt-1.5 text-[12px]" style={{ color: 'var(--ah-ink-3)' }}>
                    {app.listing?.businessDistrict && (
                      <span className="inline-flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {app.listing.businessDistrict}
                      </span>
                    )}
                    {metaBits.map((m, i) => <span key={i}>{m}</span>)}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <StatusPill cfg={sc} />

                  {app.status === 'HELD' && (
                    <div className="flex flex-col items-end gap-1.5">
                      {app.holdDeadline && (
                        <span className="text-[10px] font-semibold tabular-nums" style={{ color: sc.text }}>
                          {new Date(app.holdDeadline).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      <div className="flex gap-1.5">
                        <SpringBtn onClick={() => handleHoldRespond(app.id, true)} disabled={holdRespondingId === app.id} variant="success">Onayla</SpringBtn>
                        <SpringBtn onClick={() => handleHoldRespond(app.id, false)} disabled={holdRespondingId === app.id} variant="danger">Reddet</SpringBtn>
                      </div>
                    </div>
                  )}

                  {(app.status === 'PENDING' || app.status === 'REVIEWING' || app.status === 'ACCEPTED') && (
                    <SpringBtn onClick={() => onOpenMessages?.(app.conversationId)} variant="primary"
                               icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>}>Mesajlaşma</SpringBtn>
                  )}

                  {(app.status === 'PENDING' || app.status === 'REVIEWING') && (
                    <SpringBtn onClick={() => handleWithdraw(app.id)} disabled={withdrawingId === app.id} variant="ghost-danger" small>
                      {withdrawingId === app.id ? 'İptal ediliyor...' : 'İptal et'}
                    </SpringBtn>
                  )}

                  {app.status === 'ACCEPTED' && (
                    app.workCompleted ? (
                      <SpringBtn onClick={() => setReviewTarget({ id: app.id, title: app.listing?.businessName || 'İşletme' })} variant="gold" small>Puanla</SpringBtn>
                    ) : (
                      <span className="text-[10px] italic" title="Vardiya günü geçince puanlayabilirsiniz" style={{ color: 'var(--ah-ink-4)' }}>Çalışma sonrası puanlanır</span>
                    )
                  )}

                  <span className="text-[11.5px]" style={{ color: 'var(--ah-ink-4)' }}>{appRelative(app.createdAt)}</span>
                </div>
              </div>

              {hasAttention && !isExpanded && (
                <div className="px-4 pb-3 -mt-1 flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  {app.note && (
                    <span className="inline-flex items-center gap-1.5 type-caption px-2 py-1 rounded-full"
                          style={{ background: 'var(--ah-warn-soft)', border: '1px solid var(--ah-warn)', color: '#8a5e17' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                      İşletme notu
                    </span>
                  )}
                  {hasPendingDoc && (
                    <span className="inline-flex items-center gap-1.5 type-caption px-2 py-1 rounded-full"
                          style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-brand)', color: 'var(--ah-brand)' }}>
                      {(app.documentRequests || []).filter(dr => dr.status === 'PENDING').length} belge talebi
                    </span>
                  )}
                  <button type="button" onClick={() => setExpandedId(app.id)} className="type-caption ml-auto" style={{ fontWeight: 600, color: 'var(--ah-brand)' }}>Detay ▽</button>
                </div>
              )}

              {isExpanded && (
                <div className="px-4 pb-1 flex justify-end" onClick={(e) => e.stopPropagation()}>
                  <button type="button" onClick={() => setExpandedId(null)} className="type-overline" style={{ color: 'var(--ah-ink-3)' }}>Kapat ▲</button>
                </div>
              )}

              {isExpanded && app.note && (
                <div className="px-4 pb-4" onClick={(e) => e.stopPropagation()}>
                  <div className="rounded-xl p-3 flex items-start gap-2" style={{ background: 'var(--ah-warn-soft)', border: '1px solid var(--ah-warn)', color: '#8a5e17' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>
                    <span className="type-body"><b className="font-semibold">İşletme Notu:</b> {app.note}</span>
                  </div>
                </div>
              )}

              {isExpanded && app.documentRequests?.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="type-overline mb-2">Belge Talepleri</div>
                  <div className="space-y-2">
                    {app.documentRequests.map(dr => {
                      const label = DOC_TYPE_LABELS[dr.documentType] || dr.documentType
                      const isPending = dr.status === 'PENDING'
                      const hasUploaded = uploadedTypes.has(dr.documentType)
                      return (
                        <div key={dr.id} className="rounded-lg px-3 py-2.5"
                          style={{ background: isPending ? 'var(--ah-warn-soft)' : '#f4f6f6', border: `1px solid ${isPending ? 'var(--ah-warn)' : 'var(--ah-line)'}` }}>
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="type-body font-medium" style={{ color: 'var(--ah-ink-2)' }}>{label}</span>
                            {!isPending && (
                              <span className={`badge ${dr.status === 'GRANTED' ? 'badge-accepted' : 'badge-rejected'}`}>{dr.status === 'GRANTED' ? 'İzin Verdin' : 'Reddettin'}</span>
                            )}
                          </div>
                          {isPending && (
                            <>
                              {!hasUploaded && (
                                <div className="type-caption rounded-md px-2 py-1.5 mt-2" style={{ background: 'var(--ah-warn-soft)', border: '1px solid var(--ah-warn)', color: '#8a5e17' }}>
                                  Bu belgeyi henüz yüklemedin. <b>Belgelerim</b> sekmesinden yükledikten sonra izin verebilirsin.
                                </div>
                              )}
                              <div className="flex gap-2 mt-2">
                                <button onClick={() => handleRespond(dr.id, true)} disabled={respondingId === dr.id || !hasUploaded}
                                  title={!hasUploaded ? 'Önce bu belgeyi yükle' : ''}
                                  className="flex-1 py-1.5 rounded-md type-overline transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                  style={{ background: '#0a7c42', color: '#fff', border: '1px solid #0a7c42' }}>İzin Ver</button>
                                <button onClick={() => handleRespond(dr.id, false)} disabled={respondingId === dr.id}
                                  className="flex-1 py-1.5 rounded-md type-overline transition-all disabled:opacity-50"
                                  style={{ background: '#fff', color: '#992d22', border: '1px solid var(--ah-line-2)' }}>Reddet</button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

{reviewTarget && (
        <ReviewModal
          applicationId={reviewTarget.id}
          title={reviewTarget.title}
          onClose={() => setReviewTarget(null)}
          onSuccess={onRefresh}
        />
      )}
    </motion.div>
  )
}

/* ───── Sub-pieces ───── */

const CHIP_GROUP = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
}
const CARD = {
  hidden:  { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 180, damping: 22 } },
}

function StatusPill({ cfg }) {
  return (
    <span className="relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
          style={{
            background: cfg.soft,
            border: `1px solid ${cfg.color}`,
            color: cfg.text,
          }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.color }} />
      {cfg.label}
    </span>
  )
}

function SpringBtn({ children, onClick, disabled, variant = 'primary', icon, small }) {
  /* FAZ 5.UX3 — muted button variants. 'gold' kept bright (CTA exception). */
  /* REDESIGN v3 — açık/teal. primary = dolu teal (ana aksiyon),
     gold = teal outline, semantic (success/danger) korunur, ghost-danger koyulaştı. */
  const styles = {
    primary: {
      background: 'var(--ah-brand)',
      color: '#fff',
      border: '1px solid var(--ah-brand)',
    },
    success: {
      background: '#0a7c42',
      color: '#fff',
      border: '1px solid #0a7c42',
    },
    danger: {
      background: '#c0392b',
      color: '#fff',
      border: '1px solid #c0392b',
    },
    gold: {
      background: 'var(--ah-card)',
      color: 'var(--ah-brand)',
      border: '1px solid var(--ah-brand)',
    },
    'ghost-danger': {
      background: 'var(--ah-card)',
      color: '#992d22',
      border: '1px solid var(--ah-line-2)',
    },
  }
  const padding = small ? 'px-2.5 py-1' : 'px-3 py-1.5'
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ y: -1, scale: 1.03 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      className={`relative text-[11.5px] font-semibold rounded-lg ${padding} inline-flex items-center gap-1.5 disabled:opacity-50`}
      style={styles[variant]}>
      {icon && <span className="relative">{icon}</span>}
      <span className="relative">{children}</span>
    </motion.button>
  )
}
