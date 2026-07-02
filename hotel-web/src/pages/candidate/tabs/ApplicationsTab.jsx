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

/* FAZ 5.UX3 — muted status config (sage/brick/ochre/info-grey) */
const STATUS_CONFIG = {
  PENDING:   { label: 'Bekliyor',     color: '#c8923a', accent: 'rgba(200, 146, 58, 0.42)',  text: '#e0b766' },   // ochre
  REVIEWING: { label: 'İnceleniyor',  color: '#6b8aa3', accent: 'rgba(107, 138, 163, 0.40)', text: '#a0b1c2' },   // info muted
  HELD:      { label: 'Hold · 24sa',  color: '#a17b3f', accent: 'rgba(161, 123, 63, 0.42)',  text: '#cda06e' },   // deep ochre
  ACCEPTED:  { label: 'Kabul',        color: '#7a9f7a', accent: 'rgba(122, 159, 122, 0.42)', text: '#a8c8a8' },   // sage
  REJECTED:  { label: 'Red',          color: '#b46a55', accent: 'rgba(180, 106, 85, 0.42)',  text: '#d39481' },   // brick
  WITHDRAWN: { label: 'İptal',        color: '#928678', accent: 'rgba(146, 134, 120, 0.32)', text: '#c9bdaa' },   // muted ivory
  EXPIRED:   { label: 'Süresi Doldu', color: '#6b6358', accent: 'rgba(107, 99, 88, 0.32)',   text: '#928678' },   // faint
}

const DOC_TYPE_LABELS = {
  CV: 'CV',
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  CRIMINAL_RECORD: 'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT: 'Kimlik Fotokopisi',
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
    <motion.div className="space-y-3"
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
              <span className={`text-[11px] tabular-nums font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-black/25' : ''}`}
                    style={!isActive ? { background: 'rgba(205, 183, 143, 0.10)', color: '#cdb78f' } : {}}>
                {count}
              </span>
            </button>
          )
        })}
      </motion.div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            type="applications"
            title="Bu filtrede başvuru yok"
            description="Farklı bir durum seçerek diğer başvurularını görebilirsin."
            ctaLabel="Tümünü Göster"
            onCta={() => setStatusFilter('')}
            compact
          />
        </div>
      ) : filtered.map((app) => {
        const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING
        const date = new Date(app.createdAt)
        const day = date.getDate()
        const month = date.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '')
        const initial = (app.listing?.businessName || '?').charAt(0).toUpperCase()

        return (
          <motion.div key={app.id} variants={CARD}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className="tier-raised tier-raised-hover relative overflow-hidden group">
            {/* Sol accent rail — always visible, uniform 3px */}
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]"
                  style={{ background: sc.color }} />
            {/* Köşede yüzen status renk blob — quieter */}
            <span aria-hidden className="absolute -top-16 -right-16 w-44 h-44 rounded-full pointer-events-none transition-opacity duration-500 opacity-25 group-hover:opacity-45"
                  style={{ background: `radial-gradient(circle, ${sc.accent} 0%, transparent 70%)`, filter: 'blur(28px)' }} />

            <div className="relative p-5 flex items-start gap-4">
              {/* SOL: Date Capsule — champagne hairline, no gold gradient text */}
              <div className="flex-shrink-0 text-center px-3 py-2.5 rounded-2xl"
                   style={{
                     background: 'rgba(205, 183, 143, 0.06)',
                     border: '1px solid rgba(205, 183, 143, 0.16)',
                     minWidth: 60,
                   }}>
                <div className="tabular-nums leading-none"
                     style={{
                       color: 'var(--text-headline)',
                       fontSize: '24px',
                       fontWeight: 600,
                       letterSpacing: '-0.04em',
                       filter: 'drop-shadow(0 0 12px rgba(205, 183, 143, 0.22))',
                     }}>{day}</div>
                <div className="type-overline mt-1.5">{month}</div>
              </div>

              {/* ORTA: avatar + işletme + ilan */}
              <div className="flex-1 min-w-0 flex items-start gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-[15px] flex-shrink-0"
                     style={{
                       background: 'rgba(205, 183, 143, 0.08)',
                       border: '1px solid rgba(205, 183, 143, 0.22)',
                       color: '#cdb78f',
                     }}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="type-heading truncate" style={{ fontSize: '15px' }}>
                    {app.listing?.title || '—'}
                  </div>
                  <div className="type-caption mt-0.5 flex items-center gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" strokeWidth={1.6} className="w-3 h-3 flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round"
                            d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
                    </svg>
                    <span className="truncate">{app.listing?.businessName || '—'}</span>
                  </div>
                </div>
              </div>

              {/* SAĞ: status badge + butonlar */}
              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <StatusPill cfg={sc} />

                {app.status === 'HELD' && (
                  <div className="flex flex-col items-end gap-1.5">
                    {app.holdDeadline && (
                      <span className="text-[10px] font-semibold tabular-nums"
                            style={{ color: sc.text }}>
                        {new Date(app.holdDeadline).toLocaleString('tr-TR', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </span>
                    )}
                    <div className="flex gap-1.5">
                      <SpringBtn onClick={() => handleHoldRespond(app.id, true)}
                                 disabled={holdRespondingId === app.id}
                                 variant="success">Onayla</SpringBtn>
                      <SpringBtn onClick={() => handleHoldRespond(app.id, false)}
                                 disabled={holdRespondingId === app.id}
                                 variant="danger">Reddet</SpringBtn>
                    </div>
                  </div>
                )}

                {(app.status === 'PENDING' || app.status === 'REVIEWING' || app.status === 'ACCEPTED') && (
                  <SpringBtn onClick={() => onOpenMessages?.(app.conversationId)} variant="primary"
                             icon={
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                                   stroke="currentColor" strokeWidth={2.2} className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                      d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                              </svg>
                             }>Mesajlaşma</SpringBtn>
                )}

                {(app.status === 'PENDING' || app.status === 'REVIEWING') && (
                  <SpringBtn onClick={() => handleWithdraw(app.id)}
                             disabled={withdrawingId === app.id} variant="ghost-danger" small>
                    {withdrawingId === app.id ? 'İptal ediliyor...' : 'İptal et'}
                  </SpringBtn>
                )}

                {app.status === 'ACCEPTED' && (
                  app.workCompleted ? (
                    <SpringBtn onClick={() => setReviewTarget({
                                  id: app.id,
                                  title: app.listing?.businessName || 'İşletme',
                                })}
                               variant="gold" small>Puanla</SpringBtn>
                  ) : (
                    <span className="text-[10px] italic"
                          title="Vardiya günü geçince puanlayabilirsiniz"
                          style={{ color: '#928678' }}>
                      Çalışma sonrası puanlanır
                    </span>
                  )
                )}
              </div>
            </div>

            {app.note && (
              <div className="relative px-5 pb-4">
                <div className="rounded-xl p-3 text-[13px] flex items-start gap-2"
                     style={{
                       background: 'rgba(200, 146, 58, 0.08)',
                       border: '1px solid rgba(200, 146, 58, 0.22)',
                       color: '#e0b766',
                     }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth={1.7} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round"
                          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                  </svg>
                  <span><b className="font-semibold">İşletme Notu:</b> {app.note}</span>
                </div>
              </div>
            )}

          {app.documentRequests?.length > 0 && (
            <div className="px-4 pb-4">
              <div className="type-overline mb-2">Belge Talepleri</div>
              <div className="space-y-2">
                {app.documentRequests.map(dr => {
                  const label = DOC_TYPE_LABELS[dr.documentType] || dr.documentType
                  const isPending = dr.status === 'PENDING'
                  const hasUploaded = uploadedTypes.has(dr.documentType)
                  return (
                    <div key={dr.id}
                      className="rounded-lg px-3 py-2.5"
                      style={{
                        background: isPending ? 'rgba(200, 146, 58, 0.08)' : 'rgba(205, 183, 143, 0.05)',
                        border: `1px solid ${isPending ? 'rgba(200, 146, 58, 0.22)' : 'rgba(205, 183, 143, 0.10)'}`,
                      }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="type-body font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                        {!isPending && (
                          <span className={`badge ${dr.status === 'GRANTED' ? 'badge-accepted' : 'badge-rejected'}`}>
                            {dr.status === 'GRANTED' ? 'İzin Verdin' : 'Reddettin'}
                          </span>
                        )}
                      </div>
                      {isPending && (
                        <>
                          {!hasUploaded && (
                            <div className="type-caption rounded-md px-2 py-1.5 mt-2"
                                 style={{
                                   background: 'rgba(200, 146, 58, 0.08)',
                                   border: '1px solid rgba(200, 146, 58, 0.22)',
                                   color: '#e0b766',
                                 }}>
                              Bu belgeyi henüz yüklemedin. <b>Belgelerim</b> sekmesinden yükledikten sonra izin verebilirsin.
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleRespond(dr.id, true)}
                              disabled={respondingId === dr.id || !hasUploaded}
                              title={!hasUploaded ? 'Önce bu belgeyi yükle' : ''}
                              className="flex-1 py-1.5 rounded-md type-overline transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{
                                background: 'linear-gradient(135deg, #7a9f7a 0%, #5e8460 100%)',
                                color: '#f5efe2',
                                border: '1px solid rgba(122, 159, 122, 0.45)',
                              }}>
                              İzin Ver
                            </button>
                            <button onClick={() => handleRespond(dr.id, false)}
                              disabled={respondingId === dr.id}
                              className="flex-1 py-1.5 rounded-md type-overline transition-all disabled:opacity-50"
                              style={{
                                background: 'rgba(180, 106, 85, 0.08)',
                                color: '#d39481',
                                border: '1px solid rgba(180, 106, 85, 0.22)',
                              }}>
                              Reddet
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </motion.div>
        )
      })}

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
            background: `linear-gradient(135deg, ${cfg.accent.replace('0.45', '0.18')}, ${cfg.accent.replace('0.45', '0.08')})`,
            border: `1px solid ${cfg.accent}`,
            color: cfg.text,
            boxShadow: `0 0 14px ${cfg.accent.replace('0.45', '0.22')}`,
          }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{
        background: cfg.color,
        boxShadow: `0 0 6px ${cfg.color}`,
      }} />
      {cfg.label}
    </span>
  )
}

function SpringBtn({ children, onClick, disabled, variant = 'primary', icon, small }) {
  /* FAZ 5.UX3 — muted button variants. 'gold' kept bright (CTA exception). */
  const styles = {
    primary: {
      background: 'rgba(205, 183, 143, 0.10)',
      color: '#ede4d3',
      boxShadow: 'inset 0 1px 0 rgba(245,239,226,0.04)',
      border: '1px solid rgba(205, 183, 143, 0.28)',
    },
    success: {
      background: 'linear-gradient(135deg, #7a9f7a 0%, #5e8460 100%)',
      color: '#f5efe2',
      boxShadow: '0 6px 16px rgba(122, 159, 122, 0.28)',
      border: '1px solid rgba(122, 159, 122, 0.40)',
    },
    danger: {
      background: 'linear-gradient(135deg, #b46a55 0%, #8f4e3d 100%)',
      color: '#f5efe2',
      boxShadow: '0 6px 16px rgba(180, 106, 85, 0.28)',
      border: '1px solid rgba(180, 106, 85, 0.40)',
    },
    gold: {
      background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)',
      color: '#1a1208',
      boxShadow: '0 6px 18px rgba(205, 183, 143, 0.30), inset 0 1px 0 rgba(255,255,255,0.24)',
      border: '1px solid rgba(205, 183, 143, 0.45)',
    },
    'ghost-danger': {
      background: 'rgba(180, 106, 85, 0.08)',
      color: '#d39481',
      border: '1px solid rgba(180, 106, 85, 0.22)',
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
      className={`relative overflow-hidden text-[11.5px] font-semibold rounded-2xl ${padding} inline-flex items-center gap-1.5 disabled:opacity-50`}
      style={styles[variant]}>
      {/* Sheen sweep — primary/gold/success butonlarda */}
      {(variant === 'primary' || variant === 'gold' || variant === 'success') && (
        <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.30), transparent)',
                transform: 'skewX(-20deg)',
                animation: 'app-shimmer 3.4s ease-in-out infinite',
              }} />
      )}
      {icon && <span className="relative">{icon}</span>}
      <span className="relative">{children}</span>
      <style>{`@keyframes app-shimmer { 0%,100% { transform: translateX(0) skewX(-20deg) } 50% { transform: translateX(420%) skewX(-20deg) } }`}</style>
    </motion.button>
  )
}
