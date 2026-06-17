import { DEFAULT_HOURS, WEEKDAYS } from '../lib/constants'

/**
 * İşletme açık/kapalı + saat aralığı editörü.
 * 7 günün her biri için açık/kapalı + start/end saat.
 * "Pazartesi tüm günlere uygula" hızlı kopyalama.
 */
export default function WorkingHoursEditor({ value, onChange }) {
  const hours = value || DEFAULT_HOURS

  function updateDay(dayKey, patch) {
    onChange({
      ...hours,
      [dayKey]: { ...hours[dayKey], ...patch },
    })
  }

  function copyToAll() {
    const monday = hours.MONDAY
    const next = WEEKDAYS.reduce((acc, d) => {
      acc[d.key] = { ...monday }
      return acc
    }, {})
    onChange(next)
  }

  return (
    <div>
      <div className="space-y-1">
        {WEEKDAYS.map(d => {
          const h = hours[d.key]
          return (
            <div key={d.key}
              className="flex flex-wrap items-center gap-3 py-2 px-3 rounded-lg hover:bg-cream-50 transition-colors">
              <div className="w-24 text-sm font-medium text-ink-700">{d.label}</div>

              <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
                <input type="checkbox"
                  checked={!h.closed}
                  onChange={e => updateDay(d.key, { closed: !e.target.checked })}
                  className="w-4 h-4 accent-brand-700" />
                <span className={h.closed ? 'text-ink-400' : 'text-ink-700'}>
                  {h.closed ? 'Kapalı' : 'Açık'}
                </span>
              </label>

              {!h.closed && (
                <div className="flex items-center gap-2 ml-auto">
                  <input type="time" value={h.open}
                    onChange={e => updateDay(d.key, { open: e.target.value })}
                    className="input !py-1 text-sm w-24" />
                  <span className="text-ink-400 text-sm">—</span>
                  <input type="time" value={h.close}
                    onChange={e => updateDay(d.key, { close: e.target.value })}
                    className="input !py-1 text-sm w-24" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex justify-end mt-2">
        <button type="button" onClick={copyToAll}
          className="text-xs text-brand-700 dark:text-brand-700 hover:underline font-medium inline-flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth={1.8} className="w-3.5 h-3.5">
            <path strokeLinecap="round" strokeLinejoin="round"
                  d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
          </svg>
          Pazartesi saatlerini tüm günlere uygula
        </button>
      </div>
    </div>
  )
}
