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
      color: '#c8923a',
      label: `${pending.length} başvuru karar bekliyor`,
      hint: oldestHoursAgo > 24
        ? `En eskisi ${Math.floor(oldestHoursAgo / 24)} gün önce — Kanban'a geç`
        : `En eskisi ${oldestHoursAgo} saat önce`,
      cta: 'Kanban\'a Git',
      onCta: () => onTabChange?.('applications'),
    })
  }

  if (reviewing.length > 0) {
    items.push({
      key: 'reviewing',
      color: '#cdb78f',
      label: `${reviewing.length} aday incelemede`,
      hint: 'Belgeleri ve mesajları kontrol et, karar ver',
      cta: 'İncele',
      onCta: () => onTabChange?.('applications'),
    })
  }

  if (urgentHeld.length > 0) {
    items.push({
      key: 'urgent-held',
      color: '#b46a55',
      label: `${urgentHeld.length} HOLD'da aday — 24 saatten az`,
      hint: 'Aday yanıtlamazsa otomatik düşecek',
      cta: 'Detay',
      onCta: () => onTabChange?.('applications'),
    })
  }

  const allClear = items.length === 0

  return (
    <div
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(135deg, rgba(13, 11, 9, 0.85) 0%, rgba(13, 11, 9, 0.85) 100%)',
        border: '1px solid rgba(205, 183, 143, 0.14)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.30)',
      }}
    >
      {/* Dekoratif radial glow */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          top: '-40px',
          right: '-40px',
          width: '180px',
          height: '180px',
          background:
            'radial-gradient(circle, rgba(205, 183, 143, 0.10) 0%, transparent 70%)',
        }}
      />

      <div className="relative">
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-y-2">
          <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
            <h2
              className="font-bebas text-2xl sm:text-3xl tracking-wider uppercase text-white"
              style={{ textShadow: '0 0 18px rgba(205, 183, 143, 0.30)' }}
            >
              Bugün
            </h2>
            <span
              className="text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: '#cdb78f' }}
            >
              {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          {!allClear && (
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse"
              style={{
                background: 'rgba(180, 106, 85, 0.14)',
                color: '#d39481',
                border: '1px solid rgba(180, 106, 85, 0.28)',
              }}
            >
              {items.length} İŞ VAR
            </span>
          )}
        </div>

        {allClear ? (
          <div className="py-3 flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: '#7a9f7a' }}
            />
            <div>
              <div className="font-bebas text-lg tracking-wider uppercase" style={{ color: '#a8c8a8' }}>
                Her şey yolunda
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: '#928678' }}>
                Bugün acil karar bekleyen başvuru yok. Yeni ilan açabilir veya mevcutları gözden geçirebilirsin.
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onTabChange?.('mylistings')}
                  className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #1b1815, #b8902d)',
                    color: '#ffffff',
                    boxShadow: '0 0 14px rgba(205, 183, 143, 0.30)',
                  }}
                >
                  Yeni İlan
                </button>
                <button
                  onClick={() => onTabChange?.('workers')}
                  className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full"
                  style={{
                    background: 'rgba(27, 24, 21, 0.75)',
                    color: '#cdb78f',
                    border: '1px solid rgba(205, 183, 143, 0.14)',
                  }}
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
                  background: 'rgba(19, 17, 15, 0.75)',
                  border: `1px solid ${it.color}22`,
                }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: it.color, boxShadow: `0 0 8px ${it.color}` }}
                  />
                  <div className="min-w-0">
                    <div
                      className="font-bebas text-sm tracking-wider uppercase"
                      style={{ color: it.color }}
                    >
                      {it.label}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: '#928678' }}>
                      {it.hint}
                    </div>
                  </div>
                </div>
                <button
                  onClick={it.onCta}
                  className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
                  style={{
                    background: `${it.color}18`,
                    color: it.color,
                    border: `1px solid ${it.color}40`,
                  }}
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
