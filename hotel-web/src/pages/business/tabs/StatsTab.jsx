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
 *
 * FAZ 19 — Drill-down: grafikten filtreli basvuru listesine gecis.
 * onDrillDown(status) -> ?tab=applications&status=...
 *
 * KURAL: sadece grafikteki sayi ile listedeki sayi BIREBIR ayni olacaksa
 * tiklanabilir yapiliyor. Aksi halde kullanici "12" gorup listede 3 kayit
 * bulur ve veriye guveni biter. Bu yuzden funnel'in "Incelendi" (backend'de
 * reviewed = total - pending, yani REJECTED/WITHDRAWN/EXPIRED de dahil) ve
 * "Tamamlandi" (backend'de completed = accepted placeholder) asamalari
 * tiklanamaz — bunlarin tek bir status karsiligi yok.
 */
export default function StatsTab({ onDrillDown }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['business-stats'],
    queryFn: hotelApi.getBusinessStats,
    staleTime: 60_000,
  })

  if (isLoading) return <SkeletonList count={4} />
  if (error) return <div style={{ color: '#b46a55' }}>İstatistikler yüklenemedi.</div>
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
        <Kpi label="Geçen Ay"      value={lastMonthApplications}                          color="#6b7574" />
        <Kpi label="Kabul Oranı"   value={`%${Math.round(acceptanceRate * 100)}`}        color="#7a9f7a" />
        <Kpi label="Aktif İlan"    value={activeListings}                                 color="#0f766e" />
      </div>

      {/* Funnel + HireTime row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <FunnelCard funnel={funnel} total={totalApplications} onDrillDown={onDrillDown} />
        <HireTimeCard data={hireTime} />
      </div>

      {/* Mevcut chart'lar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <StatusDonut data={byStatus} onSegmentClick={onDrillDown} />
        <PositionBar data={byPosition} />
      </div>

      <DailyTrendLine data={dailyTrend} />
    </div>
  )
}

function Kpi({ label, value, delta, color = '#0f766e' }) {
  const deltaPos = typeof delta === 'number' && delta >= 0
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className="stat-card group cursor-default"
    >
      {/* Blob accent — quiet */}
      <div aria-hidden className="absolute -top-12 -right-12 w-36 h-36 rounded-full pointer-events-none transition-opacity duration-500 opacity-30 group-hover:opacity-55"
           style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 65%)`, filter: 'blur(20px)' }} />

      {/* Delta pill — top-right anchor */}
      {typeof delta === 'number' && (
        <span className="absolute top-4 right-4 text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: deltaPos ? 'rgba(122, 159, 122, 0.12)' : 'rgba(180, 106, 85, 0.12)',
                color:      deltaPos ? '#a8c8a8' : '#d39481',
                border: `1px solid ${deltaPos ? 'rgba(122, 159, 122, 0.30)' : 'rgba(180, 106, 85, 0.30)'}`,
              }}>
          {deltaPos ? '+' : ''}{delta}%
        </span>
      )}

      {/* Number → hairline → label */}
      <div className="relative">
        <div className="stat-card-number" style={{ filter: `drop-shadow(0 0 12px ${color}44)` }}>
          {value}
        </div>
        <div className="stat-card-divider" />
        <div className="stat-card-label">{label}</div>
      </div>
    </motion.div>
  )
}

function FunnelCard({ funnel, total, onDrillDown }) {
  if (!funnel) return null
  // drill: bu asamanin listedeki TAM karsiligi olan filtre (yoksa tiklanamaz)
  const stages = [
    { label: 'Alındı',  count: funnel.received,  color: '#0f766e', drill: 'ALL' },
    { label: 'İncelendi', count: funnel.reviewed, color: '#3b82f6', drill: null },
    { label: 'Kabul',   count: funnel.accepted,  color: '#5e8460', drill: 'ACCEPTED' },
    { label: 'Tamamlandı', count: funnel.completed, color: '#047857', drill: null },
  ]
  const max = funnel.received || 1
  const overallConversion = funnel.received > 0
    ? Math.round((funnel.completed / funnel.received) * 100)
    : 0

  return (
    <div className="tier-raised p-5">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 className="type-overline" style={{ color: 'var(--accent-action)', fontSize: 12 }}>
          İşe Alım Hunisi
        </h3>
        <span className="type-caption" style={{ color: 'var(--text-secondary)' }}>
          Dönüşüm <strong style={{ color: '#a8c8a8' }}>%{overallConversion}</strong>
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {stages.map((s, i) => {
          const pct = Math.round((s.count / max) * 100)
          const stageConv = i === 0 ? null :
            (stages[i - 1].count > 0 ? Math.round((s.count / stages[i - 1].count) * 100) : 0)
          const clickable = !!onDrillDown && !!s.drill && s.count > 0

          const row = (
            <>
              <div className="flex justify-between mb-1 type-caption">
                <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                <span style={{ color: 'var(--text-headline)', fontWeight: 600 }}>
                  {s.count}
                  {stageConv !== null && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6, fontWeight: 400 }}>· %{stageConv}</span>
                  )}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: 'rgba(15, 118, 110, 0.08)', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}cc)`,
                  boxShadow: `0 0 12px ${s.color}66`,
                  transition: 'width 600ms ease-out',
                }} />
              </div>
            </>
          )

          if (!clickable) return <div key={s.label}>{row}</div>

          return (
            <button key={s.label} type="button"
                    onClick={() => onDrillDown(s.drill)}
                    title={`${s.label} başvurularını listele`}
                    className="funnel-stage-btn">
              {row}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function HireTimeCard({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="tier-raised p-5">
        <h3 className="type-overline" style={{ color: 'var(--accent-action)', fontSize: 12 }}>
          İşe Alım Süresi
        </h3>
        <div className="type-body text-center" style={{ padding: 32, color: 'var(--text-muted)' }}>
          Henüz kabul edilmiş başvuru yok.
        </div>
      </div>
    )
  }
  const total = data.reduce((s, b) => s + b.count, 0)

  return (
    <div className="tier-raised p-5">
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 1 }}>
        <h3 className="type-overline" style={{ color: 'var(--accent-action)', fontSize: 12 }}>
          İşe Alım Süresi
        </h3>
        <span className="type-caption" style={{ color: 'var(--text-secondary)' }}>
          Başvuru → Kabul · {total} aday
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7574' }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7574' }} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: 'rgba(15, 118, 110, 0.08)' }}
            contentStyle={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(15, 118, 110, 0.28)',
              borderRadius: 8,
              fontSize: 12,
              color: '#0f766e',
              boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            }}
            labelStyle={{ color: '#0f766e' }}
            itemStyle={{ color: '#3f4b4a' }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={['#5e8460', '#0ea5e9', '#f59e0b', '#b46a55'][i] || '#94a3b8'} />
            ))}
            <LabelList dataKey="count" position="top" style={{ fontSize: 11, fill: '#0f766e', fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
