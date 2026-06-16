import { Area, AreaChart, ResponsiveContainer } from 'recharts'

/**
 * FAZ 5.6 — Stat kart sparkline (Recharts AreaChart, axissiz/gridsiz)
 *
 * Kullanim:
 *   <Sparkline data={weeklyTrend(items)} color="#a855f7" />
 */
export function weeklyTrend(items, filterFn, weeks = 8) {
  const buckets = new Array(weeks).fill(0)
  const now = Date.now()
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  items.forEach(it => {
    if (filterFn && !filterFn(it)) return
    const ts = it.createdAt ? new Date(it.createdAt).getTime() : null
    if (!ts) return
    const weeksAgo = Math.floor((now - ts) / WEEK_MS)
    if (weeksAgo >= 0 && weeksAgo < weeks) {
      buckets[weeks - 1 - weeksAgo] += 1
    }
  })
  return buckets.map((c, i) => ({ w: i, c }))
}

export default function Sparkline({ data, color = '#a855f7', width = 68, height = 26 }) {
  const allZero = !data || data.every(d => d.c === 0)
  if (allZero) {
    return (
      <div style={{ width, height }} className="flex items-center justify-end">
        <span className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(229,231,235,0.30)' }}>
          ─
        </span>
      </div>
    )
  }
  const gradId = `spark-${color.replace('#', '')}`
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor={color} stopOpacity={0.55} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="c" stroke={color} strokeWidth={1.5}
                fill={`url(#${gradId})`} isAnimationActive
                animationDuration={650} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
