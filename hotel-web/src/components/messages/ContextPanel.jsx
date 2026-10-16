/**
 * FAZ 17 — Messages Hub bağlam paneli.
 *
 * İçerik (ContextDetails): karşı taraf kimliği, ilan kartı, sohbet bilgisi,
 * hızlı işlemler (profil, ilan, başvuruyu yönet, kullanıcıyı bildir).
 *
 *   ContextPanel — masaüstü sağ sütun (lg+)
 *   ContextSheet — mobil / tablet alttan açılan sayfa (lg altı). Sohbet
 *                  başlığındaki "Sohbet bilgileri" düğmesi açar.
 * İkisi aynı içeriği kullanır; mobilde de profil, ilan ve bildir erişilebilir.
 */
import { useRef, useState } from 'react'
import cldImg, { ImgSize } from '../../lib/cldImg'
import useFocusTrap from '../../lib/useFocusTrap'
import ReportModal from '../ReportModal'
import { formatRelative } from './utils'

function startedLabelOf(createdAt) {
  if (!createdAt) return '—'
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
  if (days === 0) return 'Bugün'
  if (days === 1) return 'Dün'
  if (days < 7) return `${days} gün önce`
  return new Date(createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Profil adresi: işletme profili İŞLETME id'si ile açılır (otherPartyId kullanıcı
 *  id'sidir, /p/business/ için yanlış). Alan yoksa bağlantı gösterilmez. */
function profilePathOf(c) {
  const isBiz = c?.otherPartyRole === 'BUSINESS_OWNER'
  return isBiz
    ? (c?.otherPartyBusinessId ? `/p/business/${c.otherPartyBusinessId}` : null)
    : (c?.otherPartyId ? `/p/candidate/${c.otherPartyId}` : null)
}

const ACTION_CLS = 'w-full text-left type-body font-semibold px-3 min-h-[44px] rounded-lg flex items-center gap-2.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed'

function ActionIcon({ d, children }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={2} className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      {d ? <path strokeLinecap="round" strokeLinejoin="round" d={d} /> : children}
    </svg>
  )
}

/** Panel ve alt sayfanın ortak gövdesi. */
function ContextDetails({ conversation: c, userRole, navigate, onReport, onAction }) {
  const isBiz = c?.otherPartyRole === 'BUSINESS_OWNER'
  const profilePath = profilePathOf(c)
  const initial = (c?.otherPartyName?.charAt(0) || '?').toLocaleUpperCase('tr-TR')
  const done = () => onAction?.()

  return (
    <>
      {/* Kimlik */}
      <div className="px-5 py-6 text-center border-b" style={{ borderColor: 'var(--ah-line)' }}>
        <ProfileAvatarLink href={profilePath}>
          {c.otherPartyAvatarUrl ? (
            <img
              src={cldImg(c.otherPartyAvatarUrl, { w: ImgSize.avatarMd })}
              alt={c.otherPartyName}
              loading="lazy" decoding="async"
              className="w-20 h-20 rounded-full object-cover"
              style={{ border: '1px solid var(--ah-line)' }}
            />
          ) : (
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-semibold"
                 style={{ background: 'var(--ah-brand)', color: 'var(--text-inverse)' }} aria-hidden="true">
              {initial}
            </div>
          )}
        </ProfileAvatarLink>
        <h3 className="type-card truncate">{c.otherPartyName}</h3>
        {c.otherPartyRole && (
          <div className="flex items-center justify-center mt-1.5">
            <span className="badge badge-neutral">{isBiz ? 'İşletme' : 'Aday'}</span>
          </div>
        )}
      </div>

      {/* İlan */}
      {c.listingTitle && (
        <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--ah-line)' }} aria-label="İlan">
          <h4 className="type-label mb-2">İlan</h4>
          <div className="rounded-lg p-3" style={{ background: 'var(--ah-band)', border: '1px solid var(--ah-line)' }}>
            <div className="type-body font-semibold line-clamp-2" style={{ color: 'var(--ah-ink)' }}>{c.listingTitle}</div>
            {c.listingId && (
              <a href={`/listings/${c.listingId}`} target="_blank" rel="noopener noreferrer"
                 className="btn-secondary !min-h-[36px] mt-2.5 w-full sm:w-auto">
                İlana git<span className="sr-only"> (yeni sekmede açılır)</span>
              </a>
            )}
          </div>
        </section>
      )}

      {/* Sohbet bilgisi */}
      <section className="px-5 py-4 border-b" style={{ borderColor: 'var(--ah-line)' }} aria-label="Sohbet bilgisi">
        <h4 className="type-label mb-2">Sohbet</h4>
        <dl className="space-y-1.5">
          <div className="flex justify-between items-center gap-3">
            <dt className="type-meta">Başladı</dt>
            <dd className="type-meta font-semibold" style={{ color: 'var(--ah-ink-2)' }}>{startedLabelOf(c.createdAt)}</dd>
          </div>
          {c.lastMessageAt && (
            <div className="flex justify-between items-center gap-3">
              <dt className="type-meta">Son mesaj</dt>
              <dd className="type-meta font-semibold" style={{ color: 'var(--ah-ink-2)' }}>{formatRelative(c.lastMessageAt)}</dd>
            </div>
          )}
          {c.unreadCount > 0 && (
            <div className="flex justify-between items-center gap-3">
              <dt className="type-meta">Okunmamış</dt>
              <dd><span className="badge badge-neutral type-num">{c.unreadCount}</span></dd>
            </div>
          )}
        </dl>
      </section>

      {/* Hızlı işlemler */}
      <section className="px-5 py-4 space-y-1.5 flex-1" aria-label="Hızlı işlemler">
        <h4 className="type-label mb-1.5">Hızlı işlemler</h4>
        {profilePath && (
          <button type="button" className={`${ACTION_CLS} hover:bg-[var(--ah-band)]`}
            style={{ color: 'var(--ah-ink)', outlineColor: 'var(--ah-brand)' }}
            onClick={() => { window.open(profilePath, '_blank', 'noopener,noreferrer'); done() }}>
            <ActionIcon><path strokeLinecap="round" strokeLinejoin="round" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></ActionIcon>
            {isBiz ? 'İşletme profili' : 'Aday profili'}
          </button>
        )}
        <button type="button" disabled={!c.listingId} className={`${ACTION_CLS} hover:bg-[var(--ah-band)]`}
          style={{ color: 'var(--ah-ink)', outlineColor: 'var(--ah-brand)' }}
          onClick={() => { if (c.listingId) { window.open(`/listings/${c.listingId}`, '_blank', 'noopener,noreferrer'); done() } }}>
          <ActionIcon d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          İlanı görüntüle
        </button>
        {userRole === 'BUSINESS_OWNER' && c.applicationId && (
          <button type="button" className={`${ACTION_CLS} hover:bg-[var(--ah-band)]`}
            style={{ color: 'var(--ah-ink)', outlineColor: 'var(--ah-brand)' }}
            onClick={() => { navigate?.(`/business?tab=applications&id=${c.applicationId}`); done() }}>
            <ActionIcon><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></ActionIcon>
            Başvuruyu yönet
          </button>
        )}
        <div className="pt-2 mt-1 border-t" style={{ borderColor: 'var(--ah-line)' }}>
          <button type="button" className={`${ACTION_CLS} hover:bg-[var(--ah-danger-soft)]`}
            style={{ color: 'var(--ah-danger)', outlineColor: 'var(--ah-danger)' }}
            onClick={onReport}>
            <ActionIcon d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            Kullanıcıyı bildir
          </button>
        </div>
      </section>
    </>
  )
}

/** Masaüstü sağ sütun (lg+). */
export default function ContextPanel({ conversation, userRole, navigate }) {
  const [reportOpen, setReportOpen] = useState(false)
  const c = conversation
  return (
    <>
      <aside
        aria-label="Sohbet bilgileri"
        className="hidden lg:flex flex-col w-80 min-w-[20rem] border-l overflow-y-auto relative"
        style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)', zIndex: 5 }}
      >
        <ContextDetails conversation={c} userRole={userRole} navigate={navigate}
                        onReport={() => setReportOpen(true)} />
      </aside>
      {reportOpen && c?.otherPartyId && (
        <ReportModal targetType="USER" targetId={c.otherPartyId} targetLabel={c.otherPartyName}
                     onClose={() => setReportOpen(false)} />
      )}
    </>
  )
}

/**
 * Mobil / tablet: alttan açılan sayfa (lg altı). Esc, karartma ve "Kapat"
 * kapatır; odak sayfa içinde kalır, kapanınca açan düğmeye döner.
 */
export function ContextSheet({ open, onClose, conversation, userRole, navigate }) {
  const ref = useRef(null)
  const [reportOpen, setReportOpen] = useState(false)
  useFocusTrap(ref, open && !reportOpen, onClose)
  const c = conversation

  return (
    <>
      {open && c && !reportOpen && (
        <div className="fixed inset-0 lg:hidden flex items-end" style={{ zIndex: 60, background: 'rgba(17, 24, 39, 0.5)' }}
             onClick={onClose}>
          <div ref={ref} role="dialog" aria-modal="true" aria-label="Sohbet bilgileri"
               onClick={e => e.stopPropagation()}
               className="w-full max-h-[85vh] overflow-y-auto flex flex-col"
               style={{
                 background: 'var(--ah-card)', borderTopLeftRadius: 16, borderTopRightRadius: 16,
                 boxShadow: 'var(--elev-3)', paddingBottom: 'env(safe-area-inset-bottom)',
                 animation: 'slideUp 200ms ease-out',
               }}>
            <div className="sticky top-0 flex items-center justify-between px-4 py-1.5 border-b"
                 style={{ background: 'var(--ah-card)', borderColor: 'var(--ah-line)' }}>
              <span className="type-card">Sohbet bilgileri</span>
              <button type="button" onClick={onClose} aria-label="Kapat" className="ah-icon-btn -mr-2">
                <span className="ah-icon-btn__face">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </span>
              </button>
            </div>
            <ContextDetails conversation={c} userRole={userRole} navigate={navigate}
                            onReport={() => setReportOpen(true)} onAction={onClose} />
          </div>
        </div>
      )}
      {reportOpen && c?.otherPartyId && (
        <ReportModal targetType="USER" targetId={c.otherPartyId} targetLabel={c.otherPartyName}
                     onClose={() => { setReportOpen(false); onClose?.() }} />
      )}
    </>
  )
}

/* Avatar: profil adresi varsa yeni sekmede açan bağlantı, yoksa düz kutu */
function ProfileAvatarLink({ href, children }) {
  if (!href) return <div className="inline-block mb-3">{children}</div>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title="Profili gör"
       className="inline-block mb-3 rounded-full cursor-pointer hover:opacity-90 transition-opacity">
      {children}
      <span className="sr-only">Profili gör (yeni sekmede açılır)</span>
    </a>
  )
}
