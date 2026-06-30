import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
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
        <Kpi label="Bu Ay Başvuru" value={thisMonthApplications} delta={monthDelta} color="#60a5fa" />
        <Kpi label="Geçen Ay"      value={lastMonthApplications}                          color="#8ba9d2" />
        <Kpi label="Kabul Oranı"   value={`%${Math.round(acceptanceRate * 100)}`}        color="#22c55e" />
        <Kpi label="Aktif İlan"    value={activeListings}                                 color="#d4a853" />
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

function Kpi({ label, value, delta, color = '#d4a853' }) {
  const deltaPos = typeof delta === 'number' && delta >= 0
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="relative overflow-hidden rounded-2xl group"
      style={{
        padding: 16,
        background: 'linear-gradient(155deg, rgba(21, 36, 61, 0.88) 0%, rgba(15, 23, 38, 0.96) 100%)',
        border: `1px solid ${color}22`,
        boxShadow: '0 8px 24px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}>
      <div aria-hidden className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none transition-opacity duration-500 opacity-35 group-hover:opacity-70"
           style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 65%)`, filter: 'blur(20px)' }} />
      <div className="relative">
        <div style={{
          fontSize: 11,
          color: 'rgba(253, 233, 165, 0.78)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
        }}>
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <div style={{
            fontSize: 32,
            fontWeight: 600,
            background: `linear-gradient(135deg, #ffffff 30%, ${color} 100%)`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em',
            filter: `drop-shadow(0 0 14px ${color}55)`,
            lineHeight: 1,
          }}>
            {value}
          </div>
          {typeof delta === 'number' && (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 999,
              background: deltaPos ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)',
              color:      deltaPos ? '#86efac' : '#fca5a5',
              border: `1px solid ${deltaPos ? 'rgba(34, 197, 94, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
            }}>
              {deltaPos ? '+' : ''}{delta}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
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
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fde9a5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          İşe Alım Hunisi
        </h3>
        <span style={{ fontSize: 11, color: 'rgba(139, 169, 210, 0.75)' }}>
          Dönüşüm <strong style={{ color: '#86efac' }}>%{overallConversion}</strong>
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
                <span style={{ color: 'rgba(229, 231, 235, 0.75)' }}>{s.label}</span>
                <span style={{ color: '#ffffff', fontWeight: 600 }}>
                  {s.count}
                  {stageConv !== null && (
                    <span style={{ color: 'rgba(139, 169, 210, 0.65)', marginLeft: 6, fontWeight: 400 }}>· %{stageConv}</span>
                  )}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(212, 168, 83, 0.10)', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)`,
                  boxShadow: `0 0 12px ${s.color}66`,
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
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fde9a5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          İşe Alım Süresi
        </h3>
        <div style={{ padding: 32, textAlign: 'center', color: 'rgba(139, 169, 210, 0.65)', fontSize: 12 }}>
          Henüz kabul edilmiş başvuru yok.
        </div>
      </div>
    )
  }
  const total = data.reduce((s, b) => s + b.count, 0)

  return (
    <div className="card p-5">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 1 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fde9a5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          İşe Alım Süresi
        </h3>
        <span style={{ fontSize: 11, color: 'rgba(139, 169, 210, 0.75)' }}>
          Başvuru → Kabul · {total} aday
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgba(229, 231, 235, 0.65)' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgba(229, 231, 235, 0.65)' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(212, 168, 83, 0.10)' }}
            contentStyle={{
              background: 'rgba(15, 23, 38, 0.95)',
              border: '1px solid rgba(212, 168, 83, 0.35)',
              borderRadius: 8,
              fontSize: 12,
              color: '#fde9a5',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}
            labelStyle={{ color: '#fde9a5' }}
            itemStyle={{ color: '#dde7f3' }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={['#10b981', '#0ea5e9', '#f59e0b', '#ef4444'][i] || '#94a3b8'} />
            ))}
            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#fde9a5', fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
