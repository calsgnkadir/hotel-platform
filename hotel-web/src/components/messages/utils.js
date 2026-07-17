/**
 * FAZ 17 — Messages hub ortak yardimcilari.
 *
 * MessagesPage.jsx 1968 satirlik monolitten cikarildi (gap analysis:
 * "doing motion on the monolith first would mean redoing it").
 * Saf fonksiyonlar — React'e bagimli degil, test edilebilir.
 */

/** Mesaj zamanını dilbilime yakın formatla. */
export function formatRelative(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diffMin = (Date.now() - d.getTime()) / 60000
  if (diffMin < 1)  return 'şimdi'
  if (diffMin < 60) return `${Math.floor(diffMin)} dk`
  const diffH = diffMin / 60
  if (diffH < 24)   return `${Math.floor(diffH)} sa`
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Jitsi call davet mesaji mi?
 * Format: "[CALL:audio]https://meet.jit.si/xxx" veya "[CALL:video]..."
 */
export function parseCallInvite(content) {
  if (!content) return null
  const m = content.match(/^\[CALL:(audio|video)\]\s*(https?:\/\/[^\s]+)$/)
  if (!m) return null
  return { type: m[1], url: m[2] }
}

/**
 * FAZ D5: Cloudinary raw PDF URL'ini image transformation ile ilk sayfa
 * JPG thumbnail'ine cevirir.
 *   .../raw/upload/...  ->  .../image/upload/pg_1,f_jpg,w_240,h_320,c_fill/...
 * Hesap plani PDF islemeyi desteklemiyorsa <img onError> fallback'i renkli
 * rozeti gosterir.
 */
export function pdfThumbnailUrl(rawUrl) {
  if (!rawUrl || !rawUrl.includes('/raw/upload/')) return null
  return rawUrl.replace('/raw/upload/', '/image/upload/pg_1,f_jpg,w_240,h_320,c_fill,q_auto/')
}

/** Dosya uzantisina gore ikon/renk meta — PDF kirmizi, DOC mavi, XLS yesil, diger champagne. */
export function fileTypeMeta(ext) {
  const docPath = 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z'
  switch (ext) {
    case 'pdf':
      return { label: 'PDF', bg: 'rgba(180, 106, 85, 0.12)', border: 'rgba(180, 106, 85, 0.28)',
               iconColor: '#dc2626', iconPath: docPath }
    case 'doc': case 'docx':
      return { label: ext.toUpperCase(), bg: 'rgba(107, 138, 163, 0.12)', border: 'rgba(107, 138, 163, 0.28)',
               iconColor: '#6b8aa3', iconPath: docPath }
    case 'xls': case 'xlsx': case 'csv':
      return { label: ext.toUpperCase(), bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.30)',
               iconColor: '#059669', iconPath: docPath }
    default:
      return { label: ext.toUpperCase().slice(0, 4) || 'FILE',
               bg: 'rgba(205, 183, 143, 0.10)', border: 'rgba(205, 183, 143, 0.22)',
               iconColor: '#8a7349', iconPath: docPath }
  }
}
