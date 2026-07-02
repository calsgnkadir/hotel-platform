/* ── Status Badge — başvuru durumu ── */
export function StatusBadge({ status }) {
  const map = {
    PENDING:   { cls: 'badge-pending',   label: 'Bekliyor' },
    REVIEWING: { cls: 'badge-reviewing', label: 'İnceleniyor' },
    ACCEPTED:  { cls: 'badge-accepted',  label: 'Kabul Edildi' },
    REJECTED:  { cls: 'badge-rejected',  label: 'Reddedildi' },
    EXPIRED:   { cls: 'badge-expired',   label: 'Süresi Doldu' },
    WITHDRAWN: { cls: 'badge-expired',   label: 'Aday İptal Etti' },
  }
  const s = map[status] || { cls: 'badge-pending', label: status }
  return <span className={`badge ${s.cls}`}>{s.label}</span>
}

/* ── No-show Badge — işe gelmedi (brick signal, uniform badge scale) ── */
export function NoShowBadge() {
  return <span className="badge badge-rejected">İşe Gelmedi</span>
}
