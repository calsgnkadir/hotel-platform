import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const POSITION_LABELS = {
  WAITER: 'Garson',
  DISHWASHER: 'Bulaşıkçı',
  HOUSEKEEPING: 'Kat Hizm.',
  RECEPTION: 'Resepsiyon',
  KITCHEN_STAFF: 'Mutfak',
  BELLBOY: 'Bellboy',
  SECURITY: 'Güvenlik',
}

// Dalga G3 — dark altin tema icin yuksek kontrast palet (eski koyu yesil/mavi okunmuyor)
const COLORS = ['#cdb78f', '#d4a853', '#5b85bf', '#928678', '#6b8aa3', '#a78bfa', '#c8923a']

/**
 * Pozisyona göre başvuru bar chart.
 * Props:
 *   data: [{ key: "WAITER", count: 18 }, ...]  (BucketDto[])
 *   title?: string
 *   height?: number
 */
export default function PositionBar({ data, title = 'Pozisyon Dağılımı', height = 240 }) {
  const chartData = (data || [])
    .filter(b => b.count > 0)
    .map(b => ({
      label: POSITION_LABELS[b.key] || b.key,
      count: b.count,
    }))

  if (chartData.length === 0) {
    return (
      <div className="card p-5 h-full">
        <h3 className="text-sm font-bold text-cream-50 uppercase tracking-wider mb-2">{title}</h3>
        <div className="flex items-center justify-center text-sm text-ink-400" style={{ height }}>
          Henüz veri yok
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-cream-50 uppercase tracking-wider mb-3">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} layout="vertical"
          margin={{ top: 5, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(205, 183, 143, 0.08)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: '#928678' }}
            tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label"
            tick={{ fontSize: 11, fill: '#cdb78f', fontWeight: 600 }} tickLine={false} axisLine={false} width={90} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, background: 'rgba(13, 11, 9, 0.95)',
                            border: '1px solid rgba(205, 183, 143, 0.22)', color: '#cdb78f' }}
            cursor={{ fill: 'rgba(205, 183, 143, 0.06)' }}
            formatter={(v) => [`${v} başvuru`, '']} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
