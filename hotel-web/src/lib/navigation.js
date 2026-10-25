/**
 * Panel navigasyonu — TEK KAYNAK.
 *
 * DashboardLayout (üst nav + mobil alt çubuk + başlık), SettingsMenu, CommandPalette,
 * KeyboardShortcuts ve panoların geçerli sekme listeleri buradan okur. Sekme adı
 * yalnız burada yazılır; her yerde aynı görünür.
 *
 * Alanlar:
 *   id        panel sekme kimliği (?tab=<id>; backend bildirim linkleri de bunu kullanır:
 *             "applications", "messages", "listings" (eski ad), "billing")
 *   label     arayüz adı (cümle düzeni)
 *   icon      DashboardLayout ikon adı
 *   placement 'top'    üst nav (masaüstü) + mobil alt sekme çubuğu
 *             'menu'   ayarlar menüsü (dişli)
 *             'header' başlıktaki ayrı ikon (Mesajlar)
 *   mobileBar false ise 'top' öğe mobil alt çubukta yer almaz; ayarlar menüsünde
 *             yalnız mobilde görünür (çok sekmeli admin paneli için)
 *   shortcut  "g + <harf>" klavye kısayolu
 *   keywords  komut paleti arama sözcükleri
 */

export const ROLE = {
  CANDIDATE: 'CANDIDATE',
  BUSINESS: 'BUSINESS_OWNER',
  ADMIN: 'ADMIN',
}

const CANDIDATE_NAV = [
  { id: 'listings',     label: 'İlanlar',          icon: 'briefcase', placement: 'top',    shortcut: 'l', keywords: 'iş ilan keşfet ara' },
  { id: 'applications', label: 'Başvurularım',     icon: 'send',      placement: 'top',    shortcut: 'a', keywords: 'başvuru durum' },
  { id: 'saved',        label: 'Kaydettiklerim',   icon: 'bookmark',  placement: 'top',    shortcut: 's', keywords: 'kaydedilen favori ilan' },
  { id: 'messages',     label: 'Mesajlar',         icon: 'messages',  placement: 'header', shortcut: 'm', keywords: 'sohbet mesaj' },
  { id: 'profile',      label: 'Profilim',         icon: 'user',      placement: 'menu',   shortcut: 'p', keywords: 'profil ayar özgeçmiş' },
  { id: 'history',      label: 'Geçmiş işlerim',   icon: 'clock',     placement: 'menu',   shortcut: 'h', keywords: 'geçmiş tamamlanan iş' },
  { id: 'relations',    label: 'Takip ettiklerim', icon: 'building',  placement: 'menu',                  keywords: 'takip işletme engellenen' },
]

const BUSINESS_NAV = [
  { id: 'overview',     label: 'Genel bakış',      icon: 'overview',  placement: 'top',    shortcut: 'o', keywords: 'ana sayfa özet yapılacaklar' },
  { id: 'mylistings',   label: 'İlanlarım',        icon: 'briefcase', placement: 'top',    shortcut: 'l', keywords: 'ilan yoklama vardiya' },
  { id: 'applications', label: 'Başvurular',       icon: 'inbox',     placement: 'top',    shortcut: 'a', keywords: 'başvuru aday karar' },
  { id: 'team',         label: 'Ekibim',           icon: 'users',     placement: 'top',    shortcut: 'e', keywords: 'çalışan favori engellenen aday' },
  { id: 'billing',      label: 'Abonelik',         icon: 'card',      placement: 'top',    shortcut: 'b', keywords: 'abonelik ödeme paket fatura' },
  { id: 'messages',     label: 'Mesajlar',         icon: 'messages',  placement: 'header', shortcut: 'm', keywords: 'sohbet mesaj' },
  { id: 'profile',      label: 'İşletme profili',  icon: 'building',  placement: 'menu',   shortcut: 'p', keywords: 'profil işletme ayar logo' },
]

const ADMIN_NAV = [
  { id: 'overview',   label: 'Genel bakış', icon: 'overview',  placement: 'top', shortcut: 'o' },
  { id: 'users',      label: 'Kullanıcılar', icon: 'users',    placement: 'top', shortcut: 'u' },
  { id: 'listings',   label: 'İlanlar',     icon: 'briefcase', placement: 'top', shortcut: 'l' },
  { id: 'reports',    label: 'Şikâyetler', icon: 'alert',     placement: 'top', shortcut: 'r' },
  { id: 'businesses', label: 'İşletmeler',  icon: 'building',  placement: 'top', mobileBar: false },
  { id: 'support',    label: 'Destek',      icon: 'lifebuoy',  placement: 'top', mobileBar: false },
  { id: 'audit',      label: 'İşlem geçmişi', icon: 'activity', placement: 'top', mobileBar: false },
  { id: 'outbox',     label: 'Giden kuyruk', icon: 'inbox',    placement: 'top', mobileBar: false },
]

const NAV_BY_ROLE = {
  [ROLE.CANDIDATE]: CANDIDATE_NAV,
  [ROLE.BUSINESS]: BUSINESS_NAV,
  [ROLE.ADMIN]: ADMIN_NAV,
}

const DEFAULT_TAB = {
  [ROLE.CANDIDATE]: 'listings',
  [ROLE.BUSINESS]: 'overview',
  [ROLE.ADMIN]: 'overview',
}

const PANEL_PATH = {
  [ROLE.CANDIDATE]: '/candidate',
  [ROLE.BUSINESS]: '/business',
  [ROLE.ADMIN]: '/admin',
}

/**
 * Eski sekme adları → yeni sekme + ek parametreler. Bildirim/push linkleri ve
 * eski yer imleri kırılmasın diye korunur.
 *   listings  (backend bildirimleri) → İlanlarım
 *   workers / favorites (eski sekmeler) → Ekibim'in ilgili görünümü
 */
const TAB_ALIASES = {
  [ROLE.BUSINESS]: {
    listings:  { tab: 'mylistings' },
    workers:   { tab: 'team', params: { view: 'workers' } },
    favorites: { tab: 'team', params: { view: 'favorites' } },
  },
  [ROLE.CANDIDATE]: {},
  [ROLE.ADMIN]: {},
}

export function navFor(role) {
  return NAV_BY_ROLE[role] || []
}

export function topNavFor(role) {
  return navFor(role).filter(i => i.placement === 'top')
}

/** Mobil alt sekme çubuğu öğeleri. */
export function mobileBarFor(role) {
  return topNavFor(role).filter(i => i.mobileBar !== false)
}

/** Ayarlar menüsü öğeleri. `mobileOnly` = üst nav'da olup mobil çubuğa sığmayanlar. */
export function menuNavFor(role) {
  const items = navFor(role)
  return [
    ...items.filter(i => i.placement === 'menu'),
    ...items.filter(i => i.placement === 'top' && i.mobileBar === false).map(i => ({ ...i, mobileOnly: true })),
  ]
}

export function validTabsFor(role) {
  return navFor(role).map(i => i.id)
}

export function defaultTabFor(role) {
  return DEFAULT_TAB[role] || navFor(role)[0]?.id || null
}

export function panelPathFor(role) {
  return PANEL_PATH[role] || '/'
}

export function tabLabel(role, id) {
  return navFor(role).find(i => i.id === id)?.label || null
}

/**
 * Sekme kimliğini çözer: geçerliyse { tab, params }, eski adsa yeni karşılığı,
 * bilinmiyorsa null (panel boş ekrana düşmesin).
 */
export function resolveTab(role, raw) {
  if (!raw || typeof raw !== 'string') return null
  const alias = TAB_ALIASES[role]?.[raw]
  if (alias) return { tab: alias.tab, params: alias.params || null, aliased: true }
  return validTabsFor(role).includes(raw) ? { tab: raw, params: null, aliased: false } : null
}

/** "g + harf" kısayolunun hedef sekmesi. */
export function tabForShortcut(role, key) {
  const k = String(key || '').toLowerCase()
  return navFor(role).find(i => i.shortcut === k)?.id || null
}
