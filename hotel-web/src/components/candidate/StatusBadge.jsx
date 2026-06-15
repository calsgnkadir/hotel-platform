// FAZ 5.2 — CandidateDashboard'dan ayrildi
export default function StatusBadge({ status }) {
  // Chat-v2: PENDING artik "mesajlasma acik" — karar mesajdan veriliyor
  const map = {
    PENDING:   { cls: 'badge-accepted',  icon: '', label: 'Mesajlaşma açık' },
    REVIEWING: { cls: 'badge-reviewing', icon: '', label: 'İnceleniyor' },
    HELD:      { cls: 'badge-reviewing', icon: '', label: 'HOLD — Cevap Bekleniyor' },
    ACCEPTED:  { cls: 'badge-accepted',  icon: '', label: 'Kabul' },
    REJECTED:  { cls: 'badge-rejected',  icon: '', label: 'Red' },
    EXPIRED:   { cls: 'badge-expired',   icon: '', label: 'Süresi Doldu' },
    WITHDRAWN: { cls: 'badge-expired',   icon: '', label: 'İptal Edildi' },
  }
  const s = map[status] || { cls: 'badge-pending', icon: '?', label: status }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

// Aday basvuru status filtre secenekleri
export const CAND_STATUS_FILTERS = [
  { value: '',          label: 'Tümü' },
  { value: 'PENDING',   label: 'Bekleyen' },
  { value: 'REVIEWING', label: 'İnceleniyor' },
  { value: 'HELD',      label: 'HOLD' },
  { value: 'ACCEPTED',  label: 'Kabul' },
  { value: 'REJECTED',  label: 'Red' },
  { value: 'WITHDRAWN', label: 'İptal' },
]
