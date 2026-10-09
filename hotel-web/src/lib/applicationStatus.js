/**
 * Başvuru durum sözlüğü — TEK KAYNAK (Durum dili paketi).
 *
 * API enum değerleri (ApplicationStatus) değişmez; burada yalnız kullanıcıya
 * görünen etiket, rozet tonu ve alt metin tanımlanır. Aday ve işletme aynı
 * durumu farklı bakış açısından görür (HELD: aday için "Yanıtın bekleniyor",
 * işletme için "Aday onayında").
 *
 * Ton kuralı (en fazla 4 ton, DESIGN_TOKENS.md §4c):
 *   attention = YALNIZ "senin bir şey yapman gerekiyor"
 *   positive  = olumlu sonuç
 *   negative  = yalnız "İşe gelmedi" ve "Acil"
 *   neutral   = geri kalan her şey (bilgi)
 * Etiketler 1-2 kelime, cümle düzeni.
 */

export const TONE_CLASS = {
  neutral: 'badge-neutral',
  attention: 'badge-attention',
  positive: 'badge-positive',
  negative: 'badge-negative',
}

export const APPLICATION_STATUS = {
  PENDING: {
    candidate: { label: 'Gönderildi', tone: 'neutral', hint: 'İşletme henüz yanıtlamadı' },
    business:  { label: 'Yeni', tone: 'attention', hint: 'Yanıtını bekliyor' },
  },
  REVIEWING: {
    candidate: { label: 'İnceleniyor', tone: 'neutral' },
    business:  { label: 'İnceleniyor', tone: 'neutral' },
  },
  HELD: {
    candidate: { label: 'Yanıtın bekleniyor', tone: 'attention' },
    business:  { label: 'Aday onayında', tone: 'neutral', hint: 'Yanıt gelmezse düşer' },
  },
  STANDBY: {
    candidate: { label: 'Yedeksin', tone: 'neutral', hint: 'Asıl aday gelmezse haber vereceğiz' },
    business:  { label: 'Yedek', tone: 'neutral' },
  },
  ACCEPTED: {
    candidate: { label: 'Kabul edildi', tone: 'positive' },
    business:  { label: 'Kabul edildi', tone: 'positive' },
  },
  REJECTED: {
    candidate: { label: 'Seçilmedi', tone: 'neutral' },
    business:  { label: 'Reddedildi', tone: 'neutral' },
  },
  WITHDRAWN: {
    candidate: { label: 'İptal ettin', tone: 'neutral' },
    business:  { label: 'Aday çekildi', tone: 'neutral' },
  },
  EXPIRED: {
    candidate: { label: 'Süresi doldu', tone: 'neutral' },
    business:  { label: 'Süresi doldu', tone: 'neutral' },
  },
}

/** STANDBY + standbyOfferActive: asıl aday gelmedi, yedeğe teklif gitti. */
export const STANDBY_OFFER = {
  candidate: { label: 'Sıra sende', tone: 'attention' },
  business:  { label: 'Teklif gönderildi', tone: 'neutral' },
}

/** İşe gelmedi — yalnız işletme görür; satırda ikinci rozet olabilen tek durum. */
export const NO_SHOW = { label: 'İşe gelmedi', tone: 'negative' }

const FALLBACK_TONE = 'neutral'

/**
 * Bir başvurunun görünen durumu.
 * @param {string} status API enum
 * @param {'candidate'|'business'} view bakış açısı
 * @param {{ standbyOfferActive?: boolean }} [extra]
 * @returns {{ label: string, tone: string, hint?: string, className: string }}
 */
export function getStatusMeta(status, view = 'candidate', extra = {}) {
  let meta
  if (status === 'STANDBY' && extra.standbyOfferActive) meta = STANDBY_OFFER[view]
  else meta = APPLICATION_STATUS[status]?.[view]
  // Bilinmeyen enum: ham değeri değil nötr genel bir etiket göster
  if (!meta) meta = { label: 'Durum güncelleniyor', tone: FALLBACK_TONE }
  return { ...meta, className: `badge ${TONE_CLASS[meta.tone] || TONE_CLASS[FALLBACK_TONE]}` }
}

/* ── Aday filtre grupları (Başvurularım) ──
   Gruplar AYRIKTIR: her başvuru (Tümü hariç) tam bir gruba düşer, bu yüzden grup
   sayılarının toplamı listedeki başvuru sayısına eşittir. Aktif yedek teklifi
   "Süren"e değil "Yanıtın bekleniyor"a sayılır (aday eylemi gerekiyor). */
const isStandbyOffer = (a) => a.status === 'STANDBY' && !!a.standbyOfferActive

export const CAND_FILTER_GROUPS = [
  { key: 'ALL',     label: 'Tümü',               match: () => true },
  { key: 'ACTION',  label: 'Yanıtın bekleniyor', match: (a) => a.status === 'HELD' || isStandbyOffer(a), hideWhenEmpty: true },
  { key: 'ONGOING', label: 'Süren',              match: (a) => a.status === 'PENDING' || a.status === 'REVIEWING' || (a.status === 'STANDBY' && !isStandbyOffer(a)) },
  { key: 'ACCEPTED', label: 'Kabul edildi',      match: (a) => a.status === 'ACCEPTED' },
  { key: 'CLOSED',  label: 'Kapanan',            match: (a) => a.status === 'REJECTED' || a.status === 'WITHDRAWN' || a.status === 'EXPIRED' },
]

/**
 * Eski enum tabanlı filtre değeri (ör. ?status=HELD derin linki) → yeni grup anahtarı.
 * Grup anahtarı gelirse aynen döner; tanınmayan değer 'ALL'.
 */
export function candGroupForStatus(value) {
  if (!value) return 'ALL'
  if (CAND_FILTER_GROUPS.some(g => g.key === value)) return value
  switch (value) {
    case 'HELD': return 'ACTION'
    case 'PENDING': case 'REVIEWING': case 'STANDBY': return 'ONGOING'
    case 'ACCEPTED': return 'ACCEPTED'
    case 'REJECTED': case 'WITHDRAWN': case 'EXPIRED': return 'CLOSED'
    default: return 'ALL'
  }
}

/** Grup başına sayı: { ALL: n, ACTION: n, ... } */
export function countCandGroups(applications) {
  const out = {}
  for (const g of CAND_FILTER_GROUPS) out[g.key] = applications.filter(g.match).length
  return out
}

/* ── İşletme filtre etiketleri (Gelen Başvurular, enum bazlı çipler) ── */
export const BUSINESS_FILTER_LABELS = {
  ALL: 'Tümü',
  ...Object.fromEntries(Object.entries(APPLICATION_STATUS).map(([k, v]) => [k, v.business.label])),
}
