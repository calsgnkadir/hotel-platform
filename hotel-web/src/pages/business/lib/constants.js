/**
 * #9 (FAZ 0) — BusinessDashboard refactor: ortak sabitler.
 * Eskiden BusinessDashboard.jsx içinde inline'dı (1795 satır).
 * Burada tek noktadan import edilir.
 */

// Dalga A — POSITION_LABELS dedupe: tek kaynak utils/labels.js
export { POSITION_LABELS } from '../../../utils/labels'

export const JOB_TYPE_LABELS = {
  PERMANENT: 'Daimi', SEASONAL: 'Sezonluk', DAILY: 'Günlük', PART_TIME: 'Yarı Zamanlı',
}

export const SHIFT_LABELS = {
  MORNING: 'Sabah (08:00–16:00)',
  EVENING: 'Akşam (16:00–24:00)',
  NIGHT:   'Gece (22:00–08:00)',
}

export const SHIFT_SHORT = {
  MORNING: 'Sabah',
  EVENING: 'Akşam',
  NIGHT:   'Gece',
}

export const STATUS_LABELS = { ACTIVE: 'Aktif', PAUSED: 'Durduruldu', CLOSED: 'Kapatıldı' }

export const SENSITIVE_DOC_TYPES_BIZ = [
  { type: 'CRIMINAL_RECORD',    label: 'Adli Sicil' },
  { type: 'HEALTH_CERTIFICATE', label: 'Sağlık Raporu' },
  { type: 'IDENTITY_DOCUMENT',  label: 'Kimlik Fotokopisi' },
]

export const DOC_REQ_STATUS_LABELS = {
  PENDING: { cls: 'bg-amber-50 text-amber-700',   label: 'Bekliyor' },
  GRANTED: { cls: 'bg-brand-50 text-brand-700',   label: 'İzin Verildi' },
  DENIED:  { cls: 'bg-red-50 text-red-700',        label: 'Reddedildi' },
}

export const BUSINESS_TYPE_LABELS = {
  HOTEL: 'Otel',
  RESTAURANT: 'Restoran',
  CAFE: 'Kafe',
}

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
