/**
 * #9 (FAZ 0) — BusinessDashboard refactor: ortak sabitler.
 * Eskiden BusinessDashboard.jsx içinde inline'dı (1795 satır).
 * Burada tek noktadan import edilir.
 */

// Etiket sözlükleri tek kaynak: utils/labels.js (burada yalnız yeniden dışa aktarılır)
export {
  POSITION_LABELS, JOB_TYPE_LABELS, BUSINESS_TYPE_LABELS, SHIFT_LABELS as SHIFT_SHORT,
} from '../../../utils/labels'

// İlan formu için saat aralıklı uzun adlar (backend Shift enum tanımı)
export const SHIFT_LABELS = {
  MORNING: 'Sabah (08:00–16:00)',
  EVENING: 'Akşam (16:00–24:00)',
  NIGHT:   'Gece (22:00–08:00)',
}

export const STATUS_LABELS = { ACTIVE: 'Aktif', PAUSED: 'Durduruldu', CLOSED: 'Kapatıldı' }

export const WEEKDAYS = [
  { key: 'MONDAY',    label: 'Pazartesi' },
  { key: 'TUESDAY',   label: 'Salı' },
  { key: 'WEDNESDAY', label: 'Çarşamba' },
  { key: 'THURSDAY',  label: 'Perşembe' },
  { key: 'FRIDAY',    label: 'Cuma' },
  { key: 'SATURDAY',  label: 'Cumartesi' },
  { key: 'SUNDAY',    label: 'Pazar' },
]

export const DEFAULT_HOURS = WEEKDAYS.reduce((acc, d) => {
  acc[d.key] = { open: '09:00', close: '18:00', closed: false }
  return acc
}, {})
