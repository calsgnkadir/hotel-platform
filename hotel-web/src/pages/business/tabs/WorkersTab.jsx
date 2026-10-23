import * as hotelApi from '../../../api/hotel'
import toast from 'react-hot-toast'
import { extractErrorMessage } from '../../../api/client'
import { shiftHours, rosterSlots } from '../../../lib/shiftTime'
import { formatHours, formatHoursNumber } from '../../../lib/format'
import EmptyState from '../../../components/EmptyState'
import AvatarCluster from '../../../components/AvatarCluster'  // FAZ 5.14
import cldImg, { ImgSize } from '../../../lib/cldImg'
import Sparkline, { weeklyTrend } from '../../../components/Sparkline'  // FAZ D1

/* ── Workers Tab (#78) — Bizde çalışan adaylar ── */
export default function WorkersTab({ applications, onOpenMessages }) {
  // Aday başına grupla: { candidateId -> { candidate, totalHours, jobCount, lastDate, applications[] } }
  // Gelmedi işaretli vardiyalar kadrodan düşer; tüm vardiyaları gelmedi olan
  // başvuru "bizde çalıştı" sayılmaz (yoklama ve başvuru detayı bu kuraldan muaf).
  const completed = applications
    .filter(a => a.status === 'ACCEPTED' && a.workCompleted)
    .map(a => ({ app: a, slots: rosterSlots(a) }))
    .filter(({ app, slots }) => !((app.requestedSlots || []).length > 0 && slots.length === 0))

  const grouped = {}
  for (const { app, slots } of completed) {
    const cid = app.candidate?.id
    if (!cid) continue
    if (!grouped[cid]) {
      grouped[cid] = {
        candidate: app.candidate,
        totalHours: 0,
        jobCount: 0,
        lastDate: null,
        apps: [],
      }
    }
    const g = grouped[cid]
    g.jobCount++
    g.apps.push(app)
    for (const s of slots) {
      g.totalHours += shiftHours(s.startTime, s.endTime)
      if (s.date && (!g.lastDate || s.date > g.lastDate)) g.lastDate = s.date
    }
  }

  const workers = Object.values(grouped).sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))

  if (workers.length === 0) {
    return (
      <div className="card">
        <EmptyState
          type="workers"
          title="Bizde çalışan yok"
          description="3 adımda ekibinin geçmişi burada birikir:"
          steps={[
            { label: 'Adayı kabul et',         hint: 'Başvurular sekmesinde adayı kabul et' },
            { label: 'Vardiya günü geçsin',    hint: 'Sistem aday için saat + tarih otomatik hesaplar' },
            { label: 'Burada görünür',         hint: 'Toplam saat, kaç vardiya, son çalışma tarihi' },
          ]}
        />
      </div>
    )
  }

  const totalHours = workers.reduce((s, w) => s + w.totalHours, 0)
  const totalJobs = workers.reduce((s, w) => s + w.jobCount, 0)

  // FAZ 5.14 — avatar cluster için worker -> AvatarCluster item formatına çevir
  const clusterItems = workers.map(w => ({
    id: w.candidate?.id,
    name: w.candidate?.fullName,
    avatarUrl: w.candidate?.avatarUrl,
  }))

  return (
    <div className="space-y-4">
      {/* Özet şeridi — ekip, toplam saat, tamamlanan iş tek kartta (eskiden toplam
          saat iki ayrı kartta tekrar ediyordu ve kartlar boş/yüksek duruyordu). */}
      <section aria-label="Ekip özeti"
               className="card !p-0 grid grid-cols-2 sm:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
        <div className="col-span-2 sm:col-span-1 flex items-center gap-3 px-4 py-3.5 sm:px-5 border-b sm:border-b-0 sm:border-r"
             style={{ borderColor: 'var(--ah-line)' }}>
          <AvatarCluster items={clusterItems} size={36} max={5} showOnlineDot />
          <div className="min-w-0">
            <div className="type-card">{workers.length} kişilik ekip</div>
            <div className="type-caption mt-0.5">Yeşil nokta: şu an çevrimiçi</div>
          </div>
        </div>
        <SummaryStat label="Toplam iş saati" value={formatHoursNumber(totalHours, { maxFraction: 0 })} unit="saat"
                     className="border-r" trend={weeklyTrend(applications, null)} />
        <SummaryStat label="Tamamlanan iş" value={totalJobs.toLocaleString('tr-TR')}
                     trend={weeklyTrend(applications, a => a.status === 'ACCEPTED')} />
      </section>

      {/* Aday listesi — kompakt satır kartlar; geniş ekranda 2-3 sütun */}
      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5" aria-label="Bizde çalışanlar">
        {workers.map(w => (
          <li key={w.candidate.id}
              className="card !p-3.5 flex items-center gap-3 min-w-0 hover:border-[var(--ah-line-2)]">
            {/* Avatar da profile gider; klavye/ekran okuyucu icin tek hedef isim baglantisi */}
            <a href={`/p/candidate/${w.candidate.id}`} target="_blank" rel="noopener noreferrer"
               tabIndex={-1} aria-hidden="true" className="flex-shrink-0 rounded-full">
            {w.candidate?.avatarUrl ? (
              <img src={cldImg(w.candidate.avatarUrl, { w: ImgSize.avatarSm })} alt=""
                loading="lazy" decoding="async"
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                style={{ border: '1px solid var(--ah-line)' }} />
            ) : (
              <div aria-hidden="true"
                   className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                   style={{ background: 'var(--ah-brand-soft)', border: '1px solid var(--ah-line)', color: 'var(--ah-brand)' }}>
                {(w.candidate?.fullName?.charAt(0) || '?').toLocaleUpperCase('tr-TR')}
              </div>
            )}
            </a>
            <div className="min-w-0 flex-1">
              {/* Kanban kartindaki desenle ayni: aday adi herkese acik profile (yeni sekme) */}
              <a href={`/p/candidate/${w.candidate.id}`} target="_blank" rel="noopener noreferrer"
                 title="Aday profilini gör"
                 aria-label={`${w.candidate?.fullName || 'Aday'} profilini yeni sekmede aç`}
                 className="block type-body !font-semibold truncate rounded-sm hover:underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ah-brand)]"
                 style={{ color: 'var(--ah-ink)' }}>
                {w.candidate?.fullName || 'Aday'}
              </a>
              {w.candidate?.email && (
                <div className="type-caption truncate">{w.candidate.email}</div>
              )}
              {/* Ayıraç sonraki öğeyle birlikte kayar: dar ekranda satır sonunda "·" kalmaz */}
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 type-meta type-num">
                <span className="font-semibold whitespace-nowrap" style={{ color: 'var(--ah-ink-2)' }}>{formatHours(w.totalHours)}</span>
                <span className="whitespace-nowrap"><span aria-hidden="true">· </span>{w.jobCount} iş</span>
                {w.lastDate && (
                  <span className="whitespace-nowrap">
                    <span aria-hidden="true">· </span>Son: {new Date(w.lastDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const conv = await hotelApi.startConversation({ otherPartyId: w.candidate.id })
                  onOpenMessages?.(conv?.id)
                } catch (err) { toast.error(extractErrorMessage(err)) }
              }}
              aria-label={`${w.candidate?.fullName || 'Aday'} ile mesajlaş`}
              className="btn-secondary !px-3 md:!min-h-[36px] flex-shrink-0">
              Mesaj
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Özet şeridindeki tek metrik: etiket üstte, sayı + birim, sağda 8 haftalık eğilim. */
function SummaryStat({ label, value, unit, trend, className = '' }) {
  return (
    <div className={`px-4 py-3.5 sm:px-5 flex items-end justify-between gap-2 min-w-0 ${className}`}
         style={{ borderColor: 'var(--ah-line)' }}>
      <div className="min-w-0">
        <div className="type-meta truncate">{label}</div>
        <div className="type-page type-num mt-0.5" style={{ color: 'var(--ah-ink)' }}>
          {value}{unit && <span className="type-meta font-semibold ml-1">{unit}</span>}
        </div>
      </div>
      <span className="hidden min-[420px]:block flex-shrink-0">
        <Sparkline data={trend} color="var(--ah-ink-4)" width={56} height={24} />
      </span>
    </div>
  )
}
