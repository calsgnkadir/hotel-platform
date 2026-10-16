/**
 * Admin paneli etiket ve ton sözlüğü.
 *
 * API enum değerleri değişmez; burada yalnız arayüzde görünen Türkçe etiket ve
 * rozet tonu tanımlanır. Ton kuralı başvuru durumlarıyla aynıdır (en fazla 4 ton,
 * bkz. lib/applicationStatus.js → TONE_CLASS):
 *   attention = admin'in bir şey yapması gerekiyor
 *   positive  = olumlu / tamamlandı
 *   negative  = engel / başarısız
 *   neutral   = bilgi
 * Bilinmeyen değer ham enum olarak GÖSTERİLMEZ; nötr "Diğer" etiketine düşer.
 */
import { TONE_CLASS } from '../../lib/applicationStatus'

export const ROLE_LABELS = {
  CANDIDATE: 'Aday',
  BUSINESS_OWNER: 'İşletme',
  ADMIN: 'Yönetici',
}

export const LISTING_STATUS = {
  ACTIVE: { label: 'Yayında', tone: 'positive' },
  PAUSED: { label: 'Askıda', tone: 'attention' },
  CLOSED: { label: 'Kapalı', tone: 'neutral' },
}

export const REPORT_STATUS = {
  PENDING:   { label: 'Bekliyor', tone: 'attention' },
  RESOLVED:  { label: 'Çözüldü', tone: 'positive' },
  DISMISSED: { label: 'Reddedildi', tone: 'neutral' },
}

export const SUPPORT_STATUS = {
  OPEN:        { label: 'Yeni', tone: 'attention' },
  IN_PROGRESS: { label: 'İnceleniyor', tone: 'neutral' },
  RESOLVED:    { label: 'Çözüldü', tone: 'positive' },
  DISMISSED:   { label: 'Reddedildi', tone: 'neutral' },
}

export const OUTBOX_STATUS = {
  DELIVERED: { label: 'İletildi', tone: 'positive' },
  PENDING:   { label: 'Sırada', tone: 'neutral' },
  DEAD:      { label: 'Başarısız', tone: 'negative' },
}

export const OUTBOX_EVENT_LABELS = {
  AUDIT_LOG: 'İşlem kaydı',
  EMAIL: 'E-posta',
}

export const SUPPORT_SUBJECT_LABELS = {
  GENERAL: 'Genel',
  ACCOUNT: 'Hesap',
  KVKK: 'KVKK',
  BUSINESS_VERIFY: 'İşletme doğrulama',
  TECHNICAL: 'Teknik',
  PARTNERSHIP: 'İş birliği',
}

const FALLBACK = { label: 'Diğer', tone: 'neutral' }

/** { label, cls } — rozet için hazır sınıf adıyla. */
export function statusMeta(dict, value) {
  const m = dict[value] || FALLBACK
  return { label: m.label, cls: `badge ${TONE_CLASS[m.tone] || TONE_CLASS.neutral}` }
}

/** Sözlükte yoksa ham değer yerine "Diğer". */
export function labelOf(dict, value, fallback = 'Diğer') {
  return dict[value] || fallback
}
