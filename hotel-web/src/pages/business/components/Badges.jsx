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

/* ── No-show Badge — işe gelmedi ── */
export function NoShowBadge() {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
      İşe Gelmedi
    </span>
  )
}
