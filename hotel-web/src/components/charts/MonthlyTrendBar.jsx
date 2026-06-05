import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']

/**
 * Aylık başvuru sayısı bar chart.
 * Props:
 *   data: [{ month: "2026-06", count: 3 }, ...]  (TrendPointDto[])
 *   title?: string
 *   height?: number
 */
export default function MonthlyTrendBar({ data, title = 'Son 6 Ay Başvurular', height = 220 }) {
  const chartData = (data || []).map(p => {
    const [year, mm] = (p.month || '').split('-')
    const monthIdx = parseInt(mm, 10) - 1
    return {
      label: monthIdx >= 0 && monthIdx < 12 ? MONTH_LABELS[monthIdx] : p.month,
      year,
      count: p.count,
    }
  })

  const total = chartData.reduce((s, d) => s + d.count, 0)

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-slate-500">Toplam {total}</span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
            cursor={{ fill: '#f8fafc' }}
            labelFormatter={(label, payload) => `${label} ${payload?.[0]?.payload?.year || ''}`}
            formatter={(v) => [`${v} başvuru`, '']} />
          <Bar dataKey="count" fill="#047857" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
