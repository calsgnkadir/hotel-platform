/**
 * FAZ 5.12 — "Bugun" widget (BIZ OverviewTab tepeligi)
 *
 * Actionable bugun ozetleri:
 *  - PENDING basvurular kac, en eskisi kac saat
 *  - HOLD'da deadline yaklasan adaylar (<24sa)
 *  - Hicbiri yoksa "her sey yolunda" durumu
 */

function hoursSince(ts) {
  if (!ts) return 0
  return Math.floor((Date.now() - new Date(ts).getTime()) / (60 * 60 * 1000))
}

function hoursUntil(ts) {
  if (!ts) return Infinity
  return Math.floor((new Date(ts).getTime() - Date.now()) / (60 * 60 * 1000))
}

export default function TodayWidget({ applications, onTabChange }) {
  // Pending ve HOLD setleri
  const pending = applications.filter(a => a.status === 'PENDING')
  const reviewing = applications.filter(a => a.status === 'REVIEWING')
  const held = applications.filter(a => a.status === 'HELD')

  // En eski PENDING
  const oldestPending = pending.length
    ? pending.reduce((acc, a) => {
        const t = new Date(a.createdAt).getTime()
        return !acc || t < new Date(acc.createdAt).getTime() ? a : acc
      }, null)
    : null
  const oldestHoursAgo = oldestPending ? hoursSince(oldestPending.createdAt) : 0

  // Deadline yaklasan HOLD
  const urgentHeld = held.filter(a => {
    const h = hoursUntil(a.holdDeadline)
    return h >= 0 && h <= 24
  })

  // Actionable item listesi
  const items = []

  if (pending.length > 0) {
    items.push({
      key: 'pending',
      color: 'var(--ah-warn)',
      soft: 'var(--ah-warn-soft)',
      label: `${pending.length} başvuru karar bekliyor`,
      hint: oldestHoursAgo > 24
        ? `En eskisi ${Math.floor(oldestHoursAgo / 24)} gün önce — Kanban'a geç`
        : `En eskisi ${oldestHoursAgo} saat önce`,
      cta: 'Kanban\'a git',
      onCta: () => onTabChange?.('applications'),
    })
  }

  if (reviewing.length > 0) {
    items.push({
      key: 'reviewing',
      color: 'var(--ah-info)',
      soft: 'var(--ah-info-soft)',
      label: `${reviewing.length} aday incelemede`,
      hint: 'Belgeleri ve mesajları kontrol et, karar ver',
      cta: 'İncele',
      onCta: () => onTabChange?.('applications'),
    })
  }

  if (urgentHeld.length > 0) {
    items.push({
      key: 'urgent-held',
      color: 'var(--ah-danger)',
      soft: 'var(--ah-danger-soft)',
      label: `${urgentHeld.length} aday beklemede — 24 saatten az kaldı`,
      hint: 'Aday yanıtlamazsa otomatik düşecek',
      cta: 'Detay',
      onCta: () => onTabChange?.('applications'),
    })
  }

  const allClear = items.length === 0

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: 'var(--ah-card)',
        border: '1px solid var(--ah-line)',
        boxShadow: 'var(--elev-1)',
      }}
    >
      <div>
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-y-2">
          <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
            <h2 className="type-section" style={{ color: 'var(--ah-ink)' }}>
              Bugün
            </h2>
            <span className="type-meta" style={{ color: 'var(--ah-ink-3)' }}>
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          {!allClear && (
            <span
              className="type-badge px-2.5 py-1 rounded-full"
              style={{
                background: 'var(--ah-warn-soft)',
                color: 'var(--ah-warn)',
              }}
            >
              {items.length} iş var
            </span>
          )}
        </div>

        {allClear ? (
          <div className="py-3 flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: 'var(--ah-ok)' }}
            />
            <div>
              <div className="type-card" style={{ color: 'var(--ah-ink)' }}>
                Her şey yolunda
              </div>
              <div className="type-meta mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
                Bugün acil karar bekleyen başvuru yok. Yeni ilan açabilir veya mevcutları gözden geçirebilirsin.
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onTabChange?.('mylistings')}
                  className="btn-primary !w-auto"
                >
                  Yeni ilan
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange?.('workers')}
                  className="btn-secondary"
                >
                  Ekibim
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {items.map(it => (
              <li
                key={it.key}
                className="flex items-start justify-between gap-3 rounded-xl px-3.5 py-3 group transition-all"
                style={{
                  background: 'var(--ah-card)',
                  border: '1px solid var(--ah-line)',
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: it.color }}
                  />
                  <div className="min-w-0">
                    <div className="type-body font-semibold" style={{ color: 'var(--ah-ink)' }}>
                      {it.label}
                    </div>
                    <div className="type-meta mt-0.5" style={{ color: 'var(--ah-ink-3)' }}>
                      {it.hint}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={it.onCta}
                  className="btn-secondary flex-shrink-0"
                >
                  {it.cta}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
