// İşletme rozetleri — etiket/ton tek kaynaktan: lib/applicationStatus.js
import BaseStatusBadge from '../../../components/candidate/StatusBadge'
import { NO_SHOW, TONE_CLASS } from '../../../lib/applicationStatus'

/* ── Status Badge — başvuru durumu (işletme bakış açısı) ── */
export function StatusBadge({ status, standbyOfferActive = false }) {
  return <BaseStatusBadge status={status} view="business" standbyOfferActive={standbyOfferActive} />
}

/* ── No-show Badge — işe gelmedi (satırda ikinci rozet olabilen tek durum) ── */
export function NoShowBadge() {
  return <span className={`badge ${TONE_CLASS[NO_SHOW.tone]}`} data-tone={NO_SHOW.tone}>{NO_SHOW.label}</span>
}
