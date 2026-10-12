import { WEEKDAYS } from './constants'

/**
 * Backend'deki TEXT alanından working hours struct elde et.
 * Eski format (serbest text) → null döner, çağıran DEFAULT_HOURS kullanır.
 */
export function parseWorkingHours(text) {
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null) return null
    const result = {}
    for (const d of WEEKDAYS) {
      const entry = parsed[d.key]
      result[d.key] = entry && typeof entry === 'object'
        ? {
            open:   entry.open   || '09:00',
            close:  entry.close  || '18:00',
            closed: !!entry.closed,
          }
        : { open: '09:00', close: '18:00', closed: true }
    }
    return result
  } catch {
    return null
  }
}

