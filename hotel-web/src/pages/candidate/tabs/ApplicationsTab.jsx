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

/* Durum konfigurasyonu — her status icin renk + label + accent gradient */
const STATUS_CONFIG = {
  PENDING:   { label: 'Bekliyor',     color: '#fbbf24', accent: 'rgba(251, 191, 36, 0.45)',  text: '#fde68a' },
  REVIEWING: { label: 'İnceleniyor',  color: '#22d3ee', accent: 'rgba(34, 211, 238, 0.45)',  text: '#a5f3fc' },
  HELD:      { label: 'Hold · 24sa',  color: '#f97316', accent: 'rgba(249, 115, 22, 0.45)',  text: '#fed7aa' },
  ACCEPTED:  { label: 'Kabul',        color: '#22c55e', accent: 'rgba(34, 197, 94, 0.45)',   text: '#86efac' },
  REJECTED:  { label: 'Red',          color: '#ef4444', accent: 'rgba(239, 68, 68, 0.45)',   text: '#fca5a5' },
  WITHDRAWN: { label: 'İptal',        color: '#94a3b8', accent: 'rgba(148, 163, 184, 0.45)', text: '#cbd5e1' },
  EXPIRED:   { label: 'Süresi Doldu', color: '#94a3b8', accent: 'rgba(148, 163, 184, 0.45)', text: '#cbd5e1' },
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
    if (!confirm('Bu başvuruyu iptal etmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.')) return
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
    const msg = accept
      ? 'Bu isi ONAYLAMAK istediginize emin misiniz?\n\nBaglayici bir kabul olusturacaktir.'
      : 'Bu HOLDU REDDETMEK istediginize emin misiniz?\n\nIsletme baska bir aday secebilir.'
    if (!confirm(msg)) return
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
    <motion.div className="space-y-3 font-geist"
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
              <span className="font-geist text-[12.5px] uppercase"
                    style={{ fontWeight: isActive ? 600 : 500, letterSpacing: '0.05em' }}>
                {f.label}
              </span>
              <span className={`text-[11px] tabular-nums font-geist font-semibold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-black/25' : ''}`}
                    style={!isActive ? { background: 'rgba(212, 168, 83, 0.18)', color: '#fde9a5' } : {}}>
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
      ) : filtered.map((app, idx) => {
        const sc = STATUS_CONFIG[app.status] || STATUS_CONFIG.PENDING
        const date = new Date(app.createdAt)
        const day = date.getDate()
        const month = date.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '')
        const initial = (app.listing?.businessName || '?').charAt(0).toUpperCase()
        // Asimetrik corner — kart başına farklı
        const corners = [
          'rounded-tl-[24px] rounded-tr-[10px] rounded-br-[24px] rounded-bl-[10px]',
          'rounded-tl-[10px] rounded-tr-[24px] rounded-br-[10px] rounded-bl-[24px]',
        ][idx % 2]

        return (
          <motion.div key={app.id} variants={CARD}
            whileHover={{ y: -2 }}
            transition={{ type: 'spring', stiffness: 200, damping: 22 }}
            className={`relative overflow-hidden group ${corners}`}
            style={{
              background: 'linear-gradient(135deg, rgba(21, 36, 61, 0.75) 0%, rgba(15, 23, 38, 0.92) 100%)',
              border: `1px solid ${sc.accent.replace('0.45', '0.18')}`,
              boxShadow: '0 8px 28px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}>
            {/* Sol kenar status accent rail */}
            <span aria-hidden className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
                  style={{ background: `linear-gradient(180deg, ${sc.color}, ${sc.color}80)`,
                           boxShadow: `0 0 14px ${sc.accent}` }} />
            {/* Köşede yüzen status renk blob */}
            <span aria-hidden className="absolute -top-16 -right-16 w-44 h-44 rounded-full pointer-events-none transition-opacity duration-500 opacity-30 group-hover:opacity-50"
                  style={{ background: `radial-gradient(circle, ${sc.accent} 0%, transparent 70%)`, filter: 'blur(24px)' }} />

            <div className="relative p-5 flex items-start gap-4">
              {/* SOL: Date Capsule */}
              <div className="flex-shrink-0 text-center px-3 py-2.5 rounded-2xl"
                   style={{
                     background: 'rgba(212, 168, 83, 0.08)',
                     border: '1px solid rgba(212, 168, 83, 0.18)',
                     minWidth: 60,
                   }}>
                <div className="text-2xl font-semibold tabular-nums leading-none"
                     style={{
                       background: 'linear-gradient(135deg, #f7c43c, #d4a853)',
                       WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                       letterSpacing: '-0.03em',
                     }}>{day}</div>
                <div className="text-[10px] uppercase tracking-[0.18em] font-semibold mt-1"
                     style={{ color: 'rgba(253, 233, 165, 0.75)' }}>{month}</div>
              </div>

              {/* ORTA: avatar + işletme + ilan */}
              <div className="flex-1 min-w-0 flex items-start gap-3">
                <div className="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-[15px] flex-shrink-0"
                     style={{
                       background: 'linear-gradient(135deg, rgba(35, 74, 130, 0.85), rgba(30, 58, 95, 0.95))',
                       border: '1px solid rgba(212, 168, 83, 0.30)',
                       color: '#fde9a5',
                     }}>
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold truncate"
                       style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>
                    {app.listing?.title || '—'}
                  </div>
                  <div className="text-[12px] mt-0.5 flex items-center gap-1.5"
                       style={{ color: 'rgba(139, 169, 210, 0.85)' }}>
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
                          style={{ color: 'rgba(139, 169, 210, 0.55)' }}>
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
                       background: 'rgba(251, 191, 36, 0.08)',
                       border: '1px solid rgba(251, 191, 36, 0.20)',
                       color: '#fde68a',
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
              <div className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Belge Talepleri</div>
              <div className="space-y-2">
                {app.documentRequests.map(dr => {
                  const label = DOC_TYPE_LABELS[dr.documentType] || dr.documentType
                  const isPending = dr.status === 'PENDING'
                  const hasUploaded = uploadedTypes.has(dr.documentType)
                  return (
                    <div key={dr.id}
                      className={`rounded-lg px-3 py-2.5 ${isPending ? 'bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800' : 'bg-cream-50'}`}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm text-ink-700 font-medium">{label}</span>
                        {!isPending && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            dr.status === 'GRANTED' ? 'bg-brand-50 text-brand-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {dr.status === 'GRANTED' ? 'İzin Verdin' : 'Reddettin'}
                          </span>
                        )}
                      </div>
                      {isPending && (
                        <>
                          {!hasUploaded && (
                            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-2">
                              Bu belgeyi henüz yüklemedin. <b>Belgelerim</b> sekmesinden yükledikten sonra izin verebilirsin.
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleRespond(dr.id, true)}
                              disabled={respondingId === dr.id || !hasUploaded}
                              title={!hasUploaded ? 'Önce bu belgeyi yükle' : ''}
                              className="flex-1 py-1.5 rounded-md bg-brand-700 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                              İzin Ver
                            </button>
                            <button onClick={() => handleRespond(dr.id, false)}
                              disabled={respondingId === dr.id}
                              className="flex-1 py-1.5 rounded-md bg-cream-200 hover:bg-cream-300 text-ink-700 text-xs font-semibold transition-colors disabled:opacity-50">
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
  const styles = {
    primary: {
      background: 'linear-gradient(135deg, #1e3a5f, #234a82)',
      color: '#ffffff',
      boxShadow: '0 4px 14px rgba(35, 74, 130, 0.40), inset 0 1px 0 rgba(255,255,255,0.10)',
      border: '1px solid rgba(91, 133, 191, 0.40)',
    },
    success: {
      background: 'linear-gradient(135deg, #16a34a, #15803d)',
      color: '#ffffff',
      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
      border: '1px solid rgba(34, 197, 94, 0.40)',
    },
    danger: {
      background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
      color: '#ffffff',
      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.35)',
      border: '1px solid rgba(239, 68, 68, 0.40)',
    },
    gold: {
      background: 'linear-gradient(135deg, #d4a853, #b8902d)',
      color: '#0c1726',
      boxShadow: '0 4px 14px rgba(212, 168, 83, 0.40), inset 0 1px 0 rgba(255,255,255,0.25)',
      border: '1px solid rgba(212, 168, 83, 0.55)',
    },
    'ghost-danger': {
      background: 'rgba(239, 68, 68, 0.10)',
      color: '#fca5a5',
      border: '1px solid rgba(239, 68, 68, 0.25)',
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
      className={`relative overflow-hidden text-[11.5px] font-semibold rounded-lg ${padding} inline-flex items-center gap-1.5 disabled:opacity-50`}
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
