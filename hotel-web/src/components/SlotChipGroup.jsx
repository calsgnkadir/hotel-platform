/**
 * FAZ 11.W1.2 — Slot chip grup (max N gorunur + overflow "+X").
 *
 * Kullanim:
 *   <SlotChipGroup slots={requestedSlots} max={3} />
 *   <SlotChipGroup items={['Beşiktaş', '14:00-22:00', '720 TL']} max={4} />
 *
 * Iki mod:
 *   1) slots={ShiftSlotDto[]}  -> tarih + saat formatlar (candidate/business ApplicationsTab)
 *   2) items={string[]}        -> serbest chip listesi (meta strip icin)
 *
 * Conflict rim (destructive brick):
 *   slots icinde `conflict: true` iseraki eleman brick rimle isaretlenir.
 */
export default function SlotChipGroup({ slots, items, max = 4, size = 'sm' }) {
  const data = slots
    ? slots.map(s => ({
        label: formatSlot(s),
        conflict: !!s.conflict,
      }))
    : (items || []).map(x =>
        typeof x === 'string' ? { label: x } : { label: x.label, conflict: !!x.conflict }
      )

  if (data.length === 0) return null

  const visible = data.slice(0, max)
  const overflow = data.length - visible.length

  const paddingCls = size === 'xs' ? 'px-1.5 py-0.5' : 'px-2 py-0.5'
  const textSize = size === 'xs' ? '10px' : '11px'

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visible.map((chip, i) => (
        <span
          key={i}
          className={`inline-flex items-center rounded-full ${paddingCls} tabular-nums transition-colors`}
          style={{
            fontSize: textSize,
            fontWeight: 500,
            background: chip.conflict
              ? 'rgba(180, 106, 85, 0.10)'
              : 'rgba(205, 183, 143, 0.06)',
            border: `1px solid ${
              chip.conflict ? 'rgba(180, 106, 85, 0.35)' : 'rgba(205, 183, 143, 0.16)'
            }`,
            color: chip.conflict ? '#d39481' : 'var(--text-secondary)',
          }}
          title={chip.conflict ? 'Müsaitlikle çakışıyor' : undefined}
        >
          {chip.label}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={`inline-flex items-center rounded-full ${paddingCls} tabular-nums`}
          style={{
            fontSize: textSize,
            fontWeight: 600,
            background: 'rgba(205, 183, 143, 0.10)',
            border: '1px solid rgba(205, 183, 143, 0.22)',
            color: 'var(--accent-action)',
          }}
          title={`+${overflow} daha`}
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}

function formatSlot(s) {
  if (!s) return ''
  if (s.label) return s.label
  const d = s.date ? new Date(s.date) : null
  const dateStr = d
    ? d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    : ''
  const start = (s.startTime || '').slice(0, 5)
  const end = (s.endTime || '').slice(0, 5)
  if (dateStr && start && end) return `${dateStr} · ${start}–${end}`
  if (dateStr) return dateStr
  return `${start}–${end}`
}
