import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import * as hotelApi from '../../api/hotel'
import { POSITION_LABELS } from '../../utils/labels'

/**
 * FAZ 13 — Kazanç ledger modal'i.
 *
 * Backend'den vardiya bazli brut kazanc satirlari + ozet. Her satir bir
 * tamamlanmis vardiya: tarih rayi + isletme/ilan + saat + brut. Saat
 * kaynagi (gercek mesai kaydi / planlanan) badge ile ayirt edilir.
 *
 * Not: platform para islemez — tutarlar TAHMINI brut, bordro degil.
 */
const SALARY_TYPE_LABEL = {
  HOURLY: 'Saatlik', DAILY: 'Günlük', MONTHLY: 'Aylık', NEGOTIABLE: 'Görüşülür',
}

function fmtTL(n) {
  if (n == null) return '—'
  return Math.round(Number(n)).toLocaleString('tr-TR') + ' ₺'
}

export default function EarningsLedgerModal({ onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['my-earnings'],
    queryFn: hotelApi.getMyEarnings,
    staleTime: 60_000,
  })

  const entries = data?.entries || []

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-h-[90vh] overflow-hidden flex flex-col"
           role="dialog" aria-modal="true" aria-labelledby="earnings-ledger-title"
           onClick={e => e.stopPropagation()}
           style={{ maxWidth: '640px' }}>

        {/* Header — ozet */}
        <div className="p-5 border-b border-hairline flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="earnings-ledger-title" className="type-heading" style={{ fontSize: '18px' }}>
                Kazanç Defteri
              </h2>
              <p className="type-caption mt-0.5">Tamamlanmış vardiyaların — tahmini brüt</p>
            </div>
            <button onClick={onClose} title="Kapat"
              className="tier-raised tier-raised-hover w-8 h-8 flex items-center justify-center flex-shrink-0"
              style={{ borderRadius: '999px', color: 'var(--text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Ozet strip — 3 metric */}
          {!isLoading && data && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              <SummaryCell label="Bu ay" value={fmtTL(data.thisMonthGross)} accent />
              <SummaryCell label="Bu yıl" value={fmtTL(data.thisYearGross)} />
              <SummaryCell label="Tüm zaman" value={fmtTL(data.totalGross)} sub={`${data.shiftCount} vardiya · ${data.totalHours} sa`} />
            </div>
          )}
        </div>

        {/* Ledger satirlari — timeline */}
        <div className="p-5 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="type-body text-center py-10" style={{ color: 'var(--text-muted)' }}>Yükleniyor…</div>
          ) : entries.length === 0 ? (
            <div className="type-body text-center py-10" style={{ color: 'var(--text-muted)' }}>
              Henüz tamamlanmış vardiyan yok. Kabul edilen işler tamamlanınca burada listelenir.
            </div>
          ) : (
            <div className="relative">
              {/* Dikey ray */}
              <div aria-hidden className="absolute left-[26px] top-2 bottom-2 w-px hidden sm:block"
                   style={{ background: 'linear-gradient(180deg, transparent, rgba(205, 183, 143, 0.20) 8%, rgba(205, 183, 143, 0.20) 92%, transparent)' }} />
              <div className="space-y-2">
                {entries.map((e, i) => (
                  <LedgerRow key={`${e.applicationId}-${e.date}-${i}`} entry={e} delay={i * 0.03} />
                ))}
              </div>
            </div>
          )}

          {/* Bilgi notu */}
          {!isLoading && (data?.unpricedShiftCount > 0) && (
            <p className="type-caption mt-4 px-1" style={{ color: 'var(--text-faint)' }}>
              {data.unpricedShiftCount} vardiya ücret tipi belirsiz (görüşülür) olduğu için tutara dahil edilmedi.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function SummaryCell({ label, value, sub, accent }) {
  return (
    <div className={accent ? 'tier-featured p-3' : 'tier-raised p-3'}>
      <div className="type-overline">{label}</div>
      <div className="tabular-nums mt-1" style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', color: accent ? 'var(--accent-action)' : 'var(--text-headline)' }}>
        {value}
      </div>
      {sub && <div className="type-caption mt-0.5" style={{ fontSize: '10px' }}>{sub}</div>}
    </div>
  )
}

function LedgerRow({ entry, delay }) {
  const d = new Date(entry.date)
  const day = d.getDate()
  const month = d.toLocaleDateString('tr-TR', { month: 'short' }).replace('.', '')
  const clocked = entry.hoursSource === 'CLOCKED'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 24 }}
      className="relative flex gap-3 sm:gap-4">
      {/* Ray sutunu: tarih + dugum */}
      <div className="hidden sm:flex w-14 flex-shrink-0 flex-col items-center pt-2.5 relative z-[1]">
        <div className="tabular-nums leading-none" style={{ color: 'var(--text-headline)', fontSize: '18px', fontWeight: 600, letterSpacing: '-0.03em' }}>{day}</div>
        <div className="type-caption" style={{ fontSize: '10px', textTransform: 'lowercase' }}>{month}</div>
        <span aria-hidden className="mt-1.5 w-2 h-2 rounded-full"
              style={{ background: clocked ? '#7a9f7a' : '#cdb78f', boxShadow: `0 0 0 3px rgba(19,17,15,1), 0 0 8px ${clocked ? '#7a9f7a' : '#cdb78f'}88` }} />
      </div>

      {/* Kart */}
      <div className="tier-raised tier-raised-hover flex-1 min-w-0 p-3.5 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="type-body font-semibold truncate" style={{ color: 'var(--text-headline)' }}>
            {entry.listingTitle || 'İlan'}
          </div>
          <div className="type-caption truncate mt-0.5">
            {entry.businessName || '—'}
            {entry.position && <> · {POSITION_LABELS[entry.position] || entry.position}</>}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Saat + kaynak badge */}
            <span className="type-overline inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                  style={{
                    background: clocked ? 'rgba(122,159,122,0.12)' : 'rgba(205,183,143,0.08)',
                    border: `1px solid ${clocked ? 'rgba(122,159,122,0.30)' : 'rgba(205,183,143,0.20)'}`,
                    color: clocked ? '#a8c8a8' : 'var(--accent-action)',
                  }}
                  title={clocked ? 'Gerçek mesai kaydından' : 'Planlanan vardiya süresinden'}>
              {entry.hours} sa · {clocked ? 'mesai' : 'planlı'}
            </span>
            {entry.tipsIncluded && (
              <span className="type-overline inline-flex items-center px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(200,146,58,0.10)', border: '1px solid rgba(200,146,58,0.28)', color: '#e0b766' }}>
                + bahşiş
              </span>
            )}
          </div>
        </div>

        {/* Brut tutar */}
        <div className="flex-shrink-0 text-right">
          <div className="tabular-nums" style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.02em', color: entry.gross != null ? 'var(--text-headline)' : 'var(--text-faint)' }}>
            {fmtTL(entry.gross)}
          </div>
          <div className="type-overline mt-0.5" style={{ fontSize: '9px' }}>
            {SALARY_TYPE_LABEL[entry.salaryType] || entry.salaryType}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
