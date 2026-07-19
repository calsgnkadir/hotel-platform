/**
 * FAZ 17 — Messages Hub sag sutun: baglam paneli.
 *
 * MessagesPage.jsx monolitinden birebir cikarildi (eski adi
 * ConversationDetailPanel). Icerik: karsi taraf kimligi + presence,
 * ilan karti, sohbet istatistikleri, hizli islemler (profil, ilan,
 * basvuruyu yonet, bildir).
 */
import { useState } from 'react'
import cldImg, { ImgSize } from '../../lib/cldImg'
import ReportModal from '../ReportModal'
import { formatRelative } from './utils'

/* FAZ 5.8 — Slack tarzi 3. sutun: sohbet detay paneli (lg+ ekranlarda, dark glass)
   FAZ 11.W3.1 — Basvuru linki: business ise Wave 2 split-view'a derin link */
export default function ContextPanel({ conversation, userRole, navigate }) {
  const c = conversation
  const [reportOpen, setReportOpen] = useState(false)

  const startedDays = c?.createdAt
    ? Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 86400000)
    : null
  const startedLabel = startedDays == null ? '—'
    : startedDays === 0 ? 'Bugün'
    : startedDays === 1 ? 'Dün'
    : startedDays < 7 ? `${startedDays} gün önce`
    : new Date(c.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  const initial = (c?.otherPartyName?.charAt(0) || '?').toUpperCase()
  const isBiz = c?.otherPartyRole === 'BUSINESS_OWNER'

  return (
    <>
      <div
        className="hidden lg:flex flex-col w-80 min-w-[20rem] border-l overflow-hidden relative"
        style={{
          background: 'var(--ah-card)',
          borderColor: 'var(--ah-line)',
          zIndex: 5,  // FAZ 5.8 polish — ReportModal (z-50) ile catismayi onler
        }}
      >
        {/* Avatar + isim header (FAZ 25 — glow/gradyan sokuldu, duz teal) */}
        <div className="px-5 py-6 text-center border-b" style={{ borderColor: 'var(--ah-line)' }}>
          {/* Dalga G3 — avatar tiklayinca public profil yeni sekmede acilir */}
          <a
            href={c?.otherPartyId
              ? (c.otherPartyRole === 'BUSINESS_OWNER'
                  ? `/p/business/${c.otherPartyId}`
                  : `/p/candidate/${c.otherPartyId}`)
              : undefined}
            target="_blank"
            rel="noopener noreferrer"
            title="Profili gor"
            className="inline-block mb-3 cursor-pointer hover:opacity-90 transition-opacity"
          >
            {c.otherPartyAvatarUrl ? (
              <img
                src={cldImg(c.otherPartyAvatarUrl, { w: ImgSize.avatarMd })}
                alt={c.otherPartyName}
                loading="lazy" decoding="async"
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: '1px solid var(--ah-line)' }}
              />
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-semibold text-white"
                style={{ background: '#0f766e' }}
              >
                {initial}
              </div>
            )}
          </a>
          <h3 className="text-lg font-semibold truncate" style={{ color: 'var(--ah-ink)' }}>
            {c.otherPartyName}
          </h3>
          {c.otherPartyRole && (
            <div className="flex items-center justify-center mt-1">
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#0f766e' }}>
                {isBiz ? 'İşletme' : 'Aday'}
              </span>
            </div>
          )}
        </div>

        {/* Ilan kart */}
        {c.listingTitle && (
          <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(15, 118, 110, 0.08)' }}>
            <div className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#0f766e' }}>
              İlan
            </div>
            <div
              className="rounded-xl p-3"
              style={{ background: 'var(--ah-page)', border: '1px solid var(--ah-line)' }}
            >
              <div className="text-sm font-semibold line-clamp-2 mb-2" style={{ color: 'var(--ah-ink)' }}>{c.listingTitle}</div>
              {c.listingId && (
                <a
                  href={`/listings/${c.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-opacity hover:opacity-90"
                  style={{ background: '#0f766e', color: '#ffffff' }}
                >
                  İlana Git
                </a>
              )}
            </div>
          </div>
        )}

        {/* Sohbet istatistik — kompakt */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(15, 118, 110, 0.08)' }}>
          <div className="text-[10px] tracking-[0.25em] uppercase mb-2.5" style={{ color: '#0f766e' }}>
            Sohbet
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span style={{ color: '#6b7574' }}>Başladı</span>
              <span className="font-bold" style={{ color: '#3f4b4a' }}>{startedLabel}</span>
            </div>
            {c.lastMessageAt && (
              <div className="flex justify-between items-center">
                <span style={{ color: '#6b7574' }}>Son mesaj</span>
                <span className="font-bold" style={{ color: '#3f4b4a' }}>{formatRelative(c.lastMessageAt)}</span>
              </div>
            )}
            {c.unreadCount > 0 && (
              <div className="flex justify-between items-center">
                <span style={{ color: '#6b7574' }}>Okunmamış</span>
                <span
                  className="font-bold text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: '#0f766e', color: '#ffffff' }}
                >
                  {c.unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Hizli islemler */}
        <div className="px-5 py-4 space-y-2 flex-1">
          <div className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: '#0f766e' }}>
            Hızlı İşlemler
          </div>
          {/* Dalga G — Kullanici profilini gor (role'a gore /p/business/:id veya /p/candidate/:id) */}
          <button
            onClick={() => {
              if (!c?.otherPartyId) return
              const path = c.otherPartyRole === 'BUSINESS_OWNER'
                ? `/p/business/${c.otherPartyId}`
                : `/p/candidate/${c.otherPartyId}`
              window.open(path, '_blank')
            }}
            disabled={!c?.otherPartyId}
            className="w-full text-left text-[12px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--ah-page)',
              color: '#0f766e',
              border: '1px solid var(--ah-line)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth={2.2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <span className="font-semibold">
              {c?.otherPartyRole === 'BUSINESS_OWNER' ? 'İşletme Profili' : 'Aday Profili'}
            </span>
          </button>
          <button
            onClick={() => {
              if (c.listingId) window.open(`/listings/${c.listingId}`, '_blank')
            }}
            disabled={!c.listingId}
            className="w-full text-left text-[12px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'var(--ah-page)',
              color: '#0f766e',
              border: '1px solid var(--ah-line)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth={2.2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5 19.5 4.5m0 0v15m0-15h-15" /></svg>
            <span className="font-semibold">İlanı Görüntüle</span>
          </button>
          {/* FAZ 11.W3.1 — Business: basvuruyu split-view'da ac (Wave 2 URL entegrasyonu) */}
          {userRole === 'BUSINESS_OWNER' && c.applicationId && (
            <button
              onClick={() => navigate?.(`/business?tab=applications&id=${c.applicationId}`)}
              className="w-full text-left text-[12px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all hover:-translate-y-0.5"
              style={{
                background: 'var(--ah-brand-soft)',
                color: '#0f766e',
                border: '1px solid rgba(15, 118, 110, 0.35)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <span className="font-semibold">Başvuruyu Yönet</span>
            </button>
          )}
          <button
            onClick={() => setReportOpen(true)}
            className="w-full text-left text-[12px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all hover:-translate-y-0.5"
            style={{
              background: 'rgba(180, 106, 85, 0.10)',
              color: '#d39481',
              border: '1px solid rgba(180, 106, 85, 0.22)',
            }}
          >
            <span className="text-base">!</span>
            <span className="font-semibold">Kullanıcıyı Bildir</span>
          </button>
        </div>

        {/* Alt imza */}
        <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'rgba(15, 118, 110, 0.08)' }}>
          <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: 'var(--ah-ink-4)' }}>
            AjansHotel · Sohbet
          </span>
        </div>
      </div>

      {/* Bildir modal */}
      {reportOpen && c?.otherPartyId && (
        <ReportModal
          targetType="USER"
          targetId={c.otherPartyId}
          targetLabel={c.otherPartyName}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  )
}
