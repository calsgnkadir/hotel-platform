import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const STATUS_LABELS = {
  PENDING:   'Bekleyen',
  REVIEWING: 'İnceleniyor',
  ACCEPTED:  'Kabul',
  REJECTED:  'Red',
  EXPIRED:   'Süresi Doldu',
  WITHDRAWN: 'İptal',
}

const STATUS_COLORS = {
  PENDING:   '#f59e0b',  // amber
  REVIEWING: '#3b82f6',  // blue
  ACCEPTED:  '#10b981',  // emerald
  REJECTED:  '#ef4444',  // red
  EXPIRED:   '#94a3b8',  // slate
  WITHDRAWN: '#6b7280',  // gray
}

/**
 * Başvuru durumu donut chart.
 * Props:
 *   data: [{ key: "ACCEPTED", count: 12 }, ...]  (BucketDto[])
 *   title?: string
 *   height?: number (default 240)
 */
export default function StatusDonut({ data, title = 'Başvuru Durumu', height = 240 }) {
  const chartData = (data || [])
    .filter(b => b.count > 0)
    .map(b => ({
      name: STATUS_LABELS[b.key] || b.key,
      key: b.key,
      value: b.count,
    }))

  const total = chartData.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div className="card p-5 h-full">
        <h3 className="text-sm font-bold text-ink-800 uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex items-center justify-center text-sm text-ink-400" style={{ height }}>
          Henüz veri yok
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-ink-800 uppercase tracking-wider mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name"
            innerRadius="55%" outerRadius="85%" paddingAngle={2}>
            {chartData.map(d => (
              <Cell key={d.key} fill={STATUS_COLORS[d.key] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
            formatter={(v) => `${v} başvuru`} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center text-xs text-ink-500 mt-1">
        Toplam <span className="font-bold text-ink-700">{total}</span> başvuru
      </div>
    </div>
  )
}
