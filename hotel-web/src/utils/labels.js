// Ortak etiket sözlükleri — tek kaynak. Backend enum değerleriyle birebir eşleşir
// (hotelapp/.../enums). Yeni enum değeri eklenirse burada da eklenmeli.

export const POSITION_LABELS = {
  WAITER: 'Garson',
  DISHWASHER: 'Bulaşıkçı',
  HOUSEKEEPING: 'Kat hizmetleri',
  RECEPTION: 'Resepsiyon',
  KITCHEN_STAFF: 'Mutfak personeli',
  BELLBOY: 'Bellboy',
  SECURITY: 'Güvenlik',
}

// Çalışma türü (JobType). Aday tercihindeki "müsaitlik türü" de aynı enum'dur.
export const JOB_TYPE_LABELS = {
  PERMANENT: 'Daimi',
  SEASONAL: 'Sezonluk',
  DAILY: 'Günlük',
  PART_TIME: 'Yarı zamanlı',
}

/** Geriye dönük ad: aday profilindeki müsaitlik türleri JobType ile aynıdır. */
export const AVAILABILITY_LABELS = JOB_TYPE_LABELS

// Shift enum'u (ilan düzeyindeki eski alan + kayıtlı arama). Yeni ilanlarda bu
// alan boş gelir; ilan listesi vardiya saatini slotun başlangıcından türetir
// (bkz. lib/shiftBand.js — orada farklı saat aralıkları kullanılır).
export const SHIFT_LABELS = {
  MORNING: 'Sabah',
  EVENING: 'Akşam',
  NIGHT: 'Gece',
}

export const BUSINESS_TYPE_LABELS = {
  HOTEL: 'Otel',
  RESTAURANT: 'Restoran',
  CAFE: 'Kafe',
}

export const GENDER_LABELS = {
  MALE: 'Erkek',
  FEMALE: 'Kadın',
  OTHER: 'Diğer',
}

// Backend EducationLevel enum'unun 5 değeri.
export const EDUCATION_LABELS = {
  HIGH_SCHOOL: 'Lise',
  UNIVERSITY_STUDENT: 'Üniversite öğrencisi',
  UNIVERSITY_GRADUATE: 'Üniversite mezunu',
  MASTERS: 'Yüksek lisans',
  PHD: 'Doktora',
}

export const LANGUAGE_LABELS = {
  TURKISH: 'Türkçe',
  ENGLISH: 'İngilizce',
  GERMAN: 'Almanca',
  RUSSIAN: 'Rusça',
  ARABIC: 'Arapça',
  FRENCH: 'Fransızca',
  SPANISH: 'İspanyolca',
  ITALIAN: 'İtalyanca',
}

/** Sözlükte yoksa ham değeri (ya da yedek metni) döner. */
export function labelOf(dict, value, fallback = '') {
  if (value == null || value === '') return fallback
  return dict[value] || value
}
