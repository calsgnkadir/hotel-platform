// FAZ 5.2 — Ortak label sozlukleri (CandidateDashboard'dan ayrildi).

export const POSITION_LABELS = {
  WAITER: 'Garson',
  DISHWASHER: 'Bulaşıkçı',
  HOUSEKEEPING: 'Kat Hizmetleri',
  RECEPTION: 'Resepsiyon',
  KITCHEN_STAFF: 'Mutfak Personeli',
  BELLBOY: 'Bellboy',
  SECURITY: 'Güvenlik',
}

export const GENDER_LABELS = {
  MALE: 'Erkek',
  FEMALE: 'Kadın',
  OTHER: 'Diğer',
}

export const EDUCATION_LABELS = {
  HIGH_SCHOOL: 'Lise',
  UNIVERSITY_GRADUATE: 'Üniversite',
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

export const AVAILABILITY_LABELS = {
  PERMANENT: 'Daimi',
  SEASONAL: 'Sezonluk',
  DAILY: 'Günlük',
  PART_TIME: 'Yarı Zamanlı',
}

export const DOC_TYPE_LABELS = {
  CV: 'CV',
  TRANSCRIPT: 'Transkript',
  STUDENT_CERTIFICATE: 'Öğrenci Belgesi',
  CRIMINAL_RECORD: 'Adli Sicil',
  HEALTH_CERTIFICATE: 'Sağlık Raporu',
  IDENTITY_DOCUMENT: 'Kimlik Fotokopisi',
}

export const SENSITIVE_DOC_TYPES_CAND = ['CRIMINAL_RECORD', 'HEALTH_CERTIFICATE', 'IDENTITY_DOCUMENT']

/* FAZ 2/#33 — Sertifika Cuzdani v2 kategori yapilandirmasi */
export const DOC_CATEGORIES = [
  {
    key: 'general',
    label: 'Genel',
    color: '#7e22ce',
    types: [
      { type: 'CV',                  label: 'CV / Özgeçmiş',     ext: 'PDF/DOCX', required: true  },
      { type: 'TRANSCRIPT',          label: 'Transkript',        ext: 'PDF',      required: false },
      { type: 'STUDENT_CERTIFICATE', label: 'Öğrenci Belgesi',   ext: 'PDF',      required: false },
    ],
  },
  {
    key: 'health',
    label: 'Sağlık',
    color: '#dc2626',
    types: [
      { type: 'HEALTH_CERTIFICATE',  label: 'Sağlık Raporu',     ext: 'PDF/JPG', required: false },
    ],
  },
  {
    key: 'identity',
    label: 'Kimlik',
    color: '#0891b2',
    types: [
      { type: 'IDENTITY_DOCUMENT',   label: 'Kimlik Fotokopisi', ext: 'PDF/JPG', required: false },
      { type: 'CRIMINAL_RECORD',     label: 'Adli Sicil Kaydı',  ext: 'PDF',     required: false },
    ],
  },
]
