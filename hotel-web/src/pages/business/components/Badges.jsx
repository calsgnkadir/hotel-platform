// İşletme rozetleri — etiket/ton tek kaynaktan: lib/applicationStatus.js
import BaseStatusBadge from '../../../components/candidate/StatusBadge'
import { NO_SHOW, TONE_CLASS } from '../../../lib/applicationStatus'
import { noShowSummaryLabel } from '../../../lib/shiftTime'

/* ── Status Badge — başvuru durumu (işletme bakış açısı) ── */
export function StatusBadge({ status, standbyOfferActive = false }) {
  return <BaseStatusBadge status={status} view="business" standbyOfferActive={standbyOfferActive} />
}

/* ── No-show Badge — işe gelmedi (satırda ikinci rozet olabilen tek durum).
   Vardiya satırında kısa etiket için label="Gelmedi" verilir. ── */
export function NoShowBadge({ label = NO_SHOW.label }) {
  return <span className={`badge ${TONE_CLASS[NO_SHOW.tone]}`} data-tone={NO_SHOW.tone}>{label}</span>
}

/* ── Başvuru düzeyi gelmedi özeti — tüm vardiyalar işaretliyse "İşe gelmedi",
   bir kısmıysa "N vardiya gelmedi"; işaret yoksa hiçbir şey çizmez. ── */
export function NoShowSummaryBadge({ app }) {
  const label = noShowSummaryLabel(app, NO_SHOW.label)
  return label ? <NoShowBadge label={label} /> : null
}
