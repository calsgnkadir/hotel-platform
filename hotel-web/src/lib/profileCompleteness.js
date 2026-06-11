/**
 * FAZ 1/#34 — Profile Completeness
 *
 * Profilin doluluk yüzdesi + eksik alanlar listesi.
 * Frontend-only (backend değişikliği yok).
 *
 * Kullanım:
 *   const { percentage, missing } = calculateCandidateCompleteness(profile)
 *   <ProfileCompletenessCard data={{ percentage, missing }} />
 */

// ── ADAY ────────────────────────────────────────────────────────────
// Her field bir "puan" katkısı yapar. Toplam puanı 100'e oranlar.
const CANDIDATE_FIELDS = [
  { key: 'avatarUrl',          label: 'Profil fotoğrafı',     weight: 10 },
  { key: 'phone',              label: 'Telefon',              weight: 10 },
  { key: 'district',           label: 'İlçe',                 weight: 8  },
  { key: 'neighborhood',       label: 'Mahalle',              weight: 5  },
  { key: 'birthDate',          label: 'Doğum tarihi',         weight: 8  },
  { key: 'gender',             label: 'Cinsiyet',             weight: 4  },
  { key: 'education',          label: 'Eğitim durumu',        weight: 8  },
  { key: 'about',              label: 'Hakkımda',             weight: 8  },
  // Array/list alanları — boş array eksik sayılır
  { key: 'languages',          label: 'Diller (en az 1)',     weight: 6, isArray: true },
  { key: 'preferredPositions', label: 'Tercih pozisyonlar',   weight: 8, isArray: true },
  { key: 'preferredDistricts', label: 'Tercih ilçeler',       weight: 8, isArray: true },
  { key: 'availabilityTypes',  label: 'Çalışma türü tercihi', weight: 5, isArray: true },
  { key: 'experienceYears',    label: 'Deneyim yılı',         weight: 6, isNumber: true },
  // Yüklü en az 1 belge (CV vb.) — özel kontrol
  { key: '__hasDocument',      label: 'En az 1 belge (CV)',   weight: 6 },
]

// ── İŞLETME ─────────────────────────────────────────────────────────
const BUSINESS_FIELDS = [
  { key: 'logoUrl',            label: 'İşletme logosu',       weight: 10 },
  { key: 'phone',              label: 'Telefon',              weight: 8  },
  { key: 'district',           label: 'İlçe',                 weight: 6  },
  { key: 'neighborhood',       label: 'Mahalle',              weight: 4  },
  { key: 'address',            label: 'Açık adres',           weight: 6  },
  { key: 'latitude',           label: 'Harita konumu',        weight: 10, isNumber: true },
  { key: 'description',        label: 'Açıklama',             weight: 8  },
  { key: 'category',           label: 'Kategori',             weight: 4  },
  { key: 'workingHours',       label: 'Çalışma saatleri',     weight: 8  },
  { key: 'website',            label: 'Web sitesi',           weight: 6  },
  { key: 'instagram',          label: 'Instagram',            weight: 4  },
  // Galeri — en az 1 fotoğraf
  { key: '__hasPhoto',         label: 'En az 1 galeri fotosu', weight: 10 },
  // İlan sayısı — en az 1 aktif ilan (engagement göstergesi)
  { key: '__hasListing',       label: 'En az 1 aktif ilan',   weight: 16 },
]

function isFilled(value, isArray, isNumber) {
  if (isArray) return Array.isArray(value) && value.length > 0
  if (isNumber) return value !== null && value !== undefined && value !== ''
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return Boolean(value)
}

function calculate(profile, fields, extras = {}) {
  let earned = 0
  const max = fields.reduce((s, f) => s + f.weight, 0)
  const missing = []

  for (const f of fields) {
    let filled = false
    if (f.key.startsWith('__')) {
      filled = Boolean(extras[f.key])
    } else {
      filled = isFilled(profile?.[f.key], f.isArray, f.isNumber)
    }
    if (filled) {
      earned += f.weight
    } else {
      missing.push({ key: f.key, label: f.label, weight: f.weight })
    }
  }

  const percentage = Math.round((earned / max) * 100)
  return { percentage, missing, max, earned }
}

export function calculateCandidateCompleteness(profile, { hasDocument = false } = {}) {
  return calculate(profile, CANDIDATE_FIELDS, { __hasDocument: hasDocument })
}

export function calculateBusinessCompleteness(profile, { hasPhoto = false, hasListing = false } = {}) {
  return calculate(profile, BUSINESS_FIELDS, { __hasPhoto: hasPhoto, __hasListing: hasListing })
}
