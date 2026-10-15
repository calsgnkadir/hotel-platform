/**
 * Yapılacaklar — işletme Genel bakış ekranının tepesindeki TEK eylem kartı.
 *
 * Satırlar (yalnız gerçekten iş varsa görünür; her satır ilgili filtreye ya da
 * başvuruya derin bağlantıdır):
 *  1) Karar bekleyen başvurular   → ?tab=applications&status=PENDING (tek ise &id=)
 *  2) Onayı 24 saatten az kalanlar → ?tab=applications&status=HELD    (tek ise &id=)
 *  3) Bugünün vardiyaları          → ?tab=applications&status=ACCEPTED
 *  4) Yoklama (başlamış ya da 2 saat içinde başlayacak vardiya, ilan başına)
 *                                  → ?tab=mylistings&attendance=<ilanId>
 *
 * Gece vardiyası: dün 22:00'de başlayıp sürmekte olan vardiya "bugün" sayılır
 * (lib/shiftTime: isShiftOngoing). Tarih karşılaştırmaları yereldir.
 */
import { Link } from 'react-router-dom'
import {
  localDateISO, isShiftOngoing, isShiftPast, shiftStartDate, rosterSlots, isFullyNoShow, formatShiftRange,
} from '../../../lib/shiftTime'

const HOUR = 60 * 60 * 1000
const ATTENDANCE_LEAD_HOURS = 2

export function businessLink(params) {
  const q = new URLSearchParams(params)
  return `/business?${q.toString()}`
}

/** Saf hesap — test edilebilir. */
export function buildTodos(applications = [], now = new Date()) {
  const items = []
  const today = localDateISO(now)

  // 1) Karar bekleyen
  const pending = applications.filter(a => a.status === 'PENDING')
  if (pending.length > 0) {
    const oldest = pending.reduce((acc, a) =>
      (!acc || new Date(a.createdAt) < new Date(acc.createdAt)) ? a : acc, null)
    const hours = Math.max(0, Math.floor((now - new Date(oldest.createdAt)) / HOUR))
    items.push({
      key: 'pending',
      tone: 'attention',
      label: `${pending.length} başvuru karar bekliyor`,
      hint: hours >= 24 ? `En eskisi ${Math.floor(hours / 24)} gün önce geldi`
        : hours >= 1 ? `En eskisi ${hours} saat önce geldi` : 'En eskisi az önce geldi',
      to: businessLink(pending.length === 1
        ? { tab: 'applications', status: 'PENDING', id: String(pending[0].id) }
        : { tab: 'applications', status: 'PENDING' }),
      cta: pending.length === 1 ? 'Başvuruyu aç' : 'Karar ver',
    })
  }

  // 2) Aday onayında, süresi 24 saatten az kalan
  const urgentHeld = applications.filter(a => {
    if (a.status !== 'HELD' || !a.holdDeadline) return false
    const left = new Date(a.holdDeadline) - now
    return left >= 0 && left <= 24 * HOUR
  })
  if (urgentHeld.length > 0) {
    items.push({
      key: 'held',
      tone: 'attention',
      label: `${urgentHeld.length} aday onayında, 24 saatten az kaldı`,
      hint: 'Aday yanıtlamazsa teklif kendiliğinden düşer',
      to: businessLink(urgentHeld.length === 1
        ? { tab: 'applications', status: 'HELD', id: String(urgentHeld[0].id) }
        : { tab: 'applications', status: 'HELD' }),
      cta: 'Gözden geçir',
    })
  }

  // 3) Bugünün vardiyaları (gelmedi işaretli vardiyalar kadrodan düşer)
  const todaySlots = []   // { app, slot }
  for (const a of applications) {
    if (a.status !== 'ACCEPTED' || isFullyNoShow(a)) continue
    for (const s of rosterSlots(a)) {
      if (s?.date === today || isShiftOngoing(s, now)) todaySlots.push({ app: a, slot: s })
    }
  }
  if (todaySlots.length > 0) {
    const people = new Set(todaySlots.map(x => x.app.candidate?.id ?? x.app.id)).size
    const listings = new Set(todaySlots.map(x => x.app.listing?.id)).size
    items.push({
      key: 'today-shifts',
      tone: 'neutral',
      label: `Bugün ${people} kişi çalışıyor`,
      hint: `${listings} ilan, ${todaySlots.length} vardiya`,
      to: businessLink({ tab: 'applications', status: 'ACCEPTED' }),
      cta: 'Kadroyu gör',
    })
  }

  // 4) Yoklama — ilan başına, başlamış ya da 2 saat içinde başlayacak vardiya
  const byListing = new Map()
  for (const { app, slot } of todaySlots) {
    const lid = app.listing?.id
    if (lid == null) continue
    const start = shiftStartDate(slot)
    // Bitmemiş ve (başlamış ya da 2 saat içinde başlayacak)
    if (!start || isShiftPast(slot, now) || start - now > ATTENDANCE_LEAD_HOURS * HOUR) continue
    if (!byListing.has(lid)) byListing.set(lid, { listing: app.listing, slot, count: 0 })
    const entry = byListing.get(lid)
    entry.count++
    if (shiftStartDate(slot) < shiftStartDate(entry.slot)) entry.slot = slot
  }
  for (const [lid, { listing, slot, count }] of byListing) {
    items.push({
      key: `attendance-${lid}`,
      tone: 'neutral',
      label: `Yoklama: ${listing?.title || 'İlan'}`,
      hint: `${formatShiftRange(slot.startTime, slot.endTime, { short: true })} · ${count} kişi`,
      to: businessLink({ tab: 'mylistings', attendance: String(lid) }),
      cta: 'Yoklamayı aç',
    })
  }

  return items
}

const DOT = {
  attention: 'var(--ah-warn)',
  neutral: 'var(--ah-ink-4)',
}

export default function TodayWidget({ applications, now }) {
  const items = buildTodos(applications, now || new Date())
  const dateLabel = (now || new Date()).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <section className="card !p-0 overflow-hidden" aria-labelledby="todo-title" data-testid="todo-card">
      <div className="px-4 sm:px-5 py-3.5 flex items-baseline justify-between gap-3 flex-wrap"
           style={{ borderBottom: '1px solid var(--ah-line)' }}>
        <h2 id="todo-title" className="type-section">Yapılacaklar</h2>
        <span className="type-meta">{dateLabel}</span>
      </div>

      {items.length === 0 ? (
        <div className="px-4 sm:px-5 py-4 flex items-start gap-3">
          <span className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ background: 'var(--ah-ok)' }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="type-card">Bekleyen iş yok</p>
            <p className="type-meta mt-0.5">
              Karar bekleyen başvuru ya da bugün vardiya yok. Yeni ilan açabilir veya ilanlarını gözden geçirebilirsin.
            </p>
            <Link to={businessLink({ tab: 'mylistings' })} className="btn-secondary mt-3">
              İlanlarıma git
            </Link>
          </div>
        </div>
      ) : (
        <ul>
          {items.map((it, i) => (
            <li key={it.key} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--ah-line)' }}>
              <Link to={it.to}
                    className="px-4 sm:px-5 py-3 flex items-center gap-3 min-h-[56px] hover:bg-[var(--ah-band)] transition-colors"
                    data-testid={`todo-${it.key}`}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: DOT[it.tone] }} aria-hidden="true" />
                <span className="flex-1 min-w-0">
                  <span className="type-subhead block truncate" style={{ color: 'var(--ah-ink)' }}>{it.label}</span>
                  <span className="type-meta block truncate">{it.hint}</span>
                </span>
                <span className="type-meta font-semibold flex-shrink-0 hidden sm:inline" style={{ color: 'var(--ah-ink-2)' }}>
                  {it.cta}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                     style={{ color: 'var(--ah-ink-4)' }} className="flex-shrink-0">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
