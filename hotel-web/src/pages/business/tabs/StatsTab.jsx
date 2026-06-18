import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import * as hotelApi from '../../../api/hotel'
import StatusDonut from '../../../components/charts/StatusDonut'
import PositionBar from '../../../components/charts/PositionBar'
import DailyTrendLine from '../../../components/charts/DailyTrendLine'
import { SkeletonList } from '../../../components/Skeleton'

/**
 * FAZ C.3 — Analitik sekmesi.
 * Recruitment funnel + hire-time histogram + var olan donut/bar/line chart'lar.
 * Backend tek endpoint /api/business/stats — tum payload tek query.
 */
export default function StatsTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['business-stats'],
    queryFn: hotelApi.getBusinessStats,
    staleTime: 60_000,
  })

  if (isLoading) return <SkeletonList count={4} />
  if (error) return <div style={{ color: '#ef4444' }}>İstatistikler yüklenemedi.</div>
  if (!data) return null

  const {
    thisMonthApplications, lastMonthApplications,
    acceptanceRate, activeListings, totalApplications,
    funnel, hireTime,
    byStatus, byPosition, dailyTrend,
  } = data

  const monthDelta = lastMonthApplications > 0
    ? Math.round(((thisMonthApplications - lastMonthApplications) / lastMonthApplications) * 100)
    : (thisMonthApplications > 0 ? 100 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Kpi label="Bu Ay Başvuru" value={thisMonthApplications} delta={monthDelta} />
        <Kpi label="Geçen Ay" value={lastMonthApplications} />
        <Kpi label="Kabul Oranı" value={`%${Math.round(acceptanceRate * 100)}`} />
        <Kpi label="Aktif İlan" value={activeListings} />
      </div>

      {/* Funnel + HireTime row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <FunnelCard funnel={funnel} total={totalApplications} />
        <HireTimeCard data={hireTime} />
      </div>

      {/* Mevcut chart'lar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <StatusDonut data={byStatus} />
        <PositionBar data={byPosition} />
      </div>

      <DailyTrendLine data={dailyTrend} />
    </div>
  )
}

function Kpi({ label, value, delta }) {
  const deltaPos = typeof delta === 'number' && delta >= 0
  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(212, 168, 83, 0.18)',
    }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: '#f3f4f6', letterSpacing: '-0.02em' }}>
          {value}
        </div>
        {typeof delta === 'number' && (
          <span style={{
            fontSize: 12,
            color: deltaPos ? '#22c55e' : '#ef4444',
            fontWeight: 600,
          }}>
            {deltaPos ? '+' : ''}{delta}%
          </span>
        )}
      </div>
    </div>
  )
}

function FunnelCard({ funnel, total }) {
  if (!funnel) return null
  const stages = [
    { label: 'Alındı',  count: funnel.received,  color: '#d4a853' },
    { label: 'İncelendi', count: funnel.reviewed, color: '#3b82f6' },
    { label: 'Kabul',   count: funnel.accepted,  color: '#10b981' },
    { label: 'Tamamlandı', count: funnel.completed, color: '#047857' },
  ]
  const max = funnel.received || 1
  const overallConversion = funnel.received > 0
    ? Math.round((funnel.completed / funnel.received) * 100)
    : 0

  return (
    <div className="card p-5">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          İşe Alım Hunisi
        </h3>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Dönüşüm <strong style={{ color: '#047857' }}>%{overallConversion}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stages.map((s, i) => {
          const pct = Math.round((s.count / max) * 100)
          const stageConv = i === 0 ? null :
            (stages[i - 1].count > 0 ? Math.round((s.count / stages[i - 1].count) * 100) : 0)
          return (
            <div key={s.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span style={{ color: '#475569' }}>{s.label}</span>
                <span style={{ color: '#1f2937', fontWeight: 600 }}>
                  {s.count}
                  {stageConv !== null && (
                    <span style={{ color: '#94a3b8', marginLeft: 6, fontWeight: 400 }}>· %{stageConv}</span>
                  )}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(148, 163, 184, 0.15)', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: s.color,
                  transition: 'width 600ms ease-out',
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HireTimeCard({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="card p-5">
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          İşe Alım Süresi
        </h3>
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
          Henüz kabul edilmiş başvuru yok.
        </div>
      </div>
    )
  }
  const total = data.reduce((s, b) => s + b.count, 0)

  return (
    <div className="card p-5">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 1 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#1f2937', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          İşe Alım Süresi
        </h3>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Başvuru → Kabul · {total} aday
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(212, 168, 83, 0.08)' }}
            contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={['#10b981', '#0ea5e9', '#f59e0b', '#ef4444'][i] || '#94a3b8'} />
            ))}
            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#1f2937', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
