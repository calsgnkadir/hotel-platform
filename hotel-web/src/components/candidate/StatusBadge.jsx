// Başvuru durum rozeti — etiket/ton tek kaynaktan: lib/applicationStatus.js
import { getStatusMeta, CAND_FILTER_GROUPS } from '../../lib/applicationStatus'

/**
 * @param {string}  status              API enum (PENDING, HELD, ...)
 * @param {'candidate'|'business'} view bakış açısı (varsayılan aday)
 * @param {boolean} standbyOfferActive  STANDBY + aktif yedek teklifi
 */
export default function StatusBadge({ status, view = 'candidate', standbyOfferActive = false }) {
  const meta = getStatusMeta(status, view, { standbyOfferActive })
  return <span className={meta.className} data-tone={meta.tone}>{meta.label}</span>
}

// Geriye uyum: aday filtre grupları artık sözlükte (enum değil grup anahtarı).
export const CAND_STATUS_FILTERS = CAND_FILTER_GROUPS
