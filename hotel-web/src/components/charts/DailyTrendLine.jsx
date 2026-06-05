import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'

/**
 * Son N gün başvuru trendi — area chart (line altında gradient).
 * Props:
 *   data: [{ date: "2026-06-05", count: 3 }, ...]  (TrendPointDto[])
 *   title?: string
 *   height?: number (default 220)
 */
export default function DailyTrendLine({ data, title = 'Son 30 Gün Başvuru Trendi', height = 220 }) {
  const chartData = (data || []).map(p => ({
    label: formatShortDate(p.date),
    fullDate: p.date,
    count: p.count,
  }))

  const total = chartData.reduce((s, d) => s + d.count, 0)
  const peak = chartData.reduce((m, d) => Math.max(m, d.count), 0)

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
        <span className="text-xs text-slate-500">
          Toplam {total} · Tepe {peak}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="violetGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false} axisLine={{ stroke: '#e2e8f0' }}
            interval="preserveStartEnd" minTickGap={20} />
          <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid #e2e8f0' }}
            labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDate || label}
            formatter={(v) => [`${v} başvuru`, '']} />
          <Area type="monotone" dataKey="count" stroke="#7c3aed" strokeWidth={2}
            fill="url(#violetGrad)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function formatShortDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${parseInt(d)}/${parseInt(m)}`
}
