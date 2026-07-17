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
import { useOnline } from '../../lib/presence'
import { formatRelative } from './utils'

/* FAZ 5.8 — Slack tarzi 3. sutun: sohbet detay paneli (lg+ ekranlarda, dark glass)
   FAZ 11.W3.1 — Basvuru linki: business ise Wave 2 split-view'a derin link */
export default function ContextPanel({ conversation, userRole, navigate }) {
  const c = conversation
  const online = useOnline(c?.otherPartyId)
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
          background: 'linear-gradient(180deg, rgba(19, 17, 15, 0.94) 0%, rgba(13, 11, 9, 0.94) 100%)',
          borderColor: 'rgba(205, 183, 143, 0.10)',
          zIndex: 5,  // FAZ 5.8 polish — ReportModal (z-50) ile catismayi onler
        }}
      >
        {/* Avatar + isim header — Bebas + radial glow */}
        <div className="relative px-5 py-6 text-center border-b" style={{ borderColor: 'rgba(205, 183, 143, 0.10)' }}>
          {/* Dekoratif glow */}
          <div
            aria-hidden
            className="absolute pointer-events-none inset-0"
            style={{
              background:
                'radial-gradient(circle 200px at 50% 0%, rgba(205, 183, 143, 0.18) 0%, transparent 65%)',
            }}
          />
          <div className="relative">
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
              className="relative inline-block mb-3 cursor-pointer hover:scale-105 transition-transform"
            >
              {c.otherPartyAvatarUrl ? (
                <img
                  src={cldImg(c.otherPartyAvatarUrl, { w: ImgSize.avatarMd })}
                  alt={c.otherPartyName}
                  loading="lazy" decoding="async"
                  className="w-20 h-20 rounded-full object-cover"
                  style={{ border: '2px solid rgba(205, 183, 143, 0.30)', boxShadow: '0 0 24px rgba(205, 183, 143, 0.22)' }}
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-3xl text-white"
                  style={{
                    background: 'linear-gradient(135deg, #1b1815 0%, #b8902d 100%)',
                    boxShadow: '0 0 24px rgba(205, 183, 143, 0.30)',
                    border: '2px solid rgba(205, 183, 143, 0.22)',
                  }}
                >
                  {initial}
                </div>
              )}
              {online && (
                <span
                  className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full"
                  style={{ background: '#7a9f7a', border: '2.5px solid #221f1b', boxShadow: '0 0 10px rgba(122, 159, 122, 0.45)' }}
                  title="Çevrimiçi"
                />
              )}
            </a>
            <h3
              className="text-xl tracking-wider uppercase text-white truncate"
              style={{ textShadow: '0 0 12px rgba(205, 183, 143, 0.30)' }}
            >
              {c.otherPartyName}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: online ? '#7a9f7a' : '#52525b', boxShadow: online ? '0 0 6px #7a9f7a' : 'none' }}
              />
              <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: online ? '#a8c8a8' : '#928678' }}>
                {online ? 'Çevrimiçi' : 'Çevrimdışı'}
              </span>
              {c.otherPartyRole && (
                <>
                  <span style={{ color: '#8a7349' }}>·</span>
                  <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: '#cdb78f' }}>
                    {isBiz ? 'İşletme' : 'Aday'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ilan kart */}
        {c.listingTitle && (
          <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(205, 183, 143, 0.08)' }}>
            <div className="text-[10px] tracking-[0.25em] uppercase mb-2" style={{ color: '#cdb78f' }}>
              İlan
            </div>
            <div
              className="rounded-xl p-3"
              style={{
                background: 'rgba(27, 24, 21, 0.75)',
                border: '1px solid rgba(205, 183, 143, 0.10)',
              }}
            >
              <div className="text-sm font-semibold text-white line-clamp-2 mb-2">{c.listingTitle}</div>
              {c.listingId && (
                <a
                  href={`/listings/${c.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full transition-all hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)', color: '#1a1208',
                    color: '#ffffff',
                    boxShadow: '0 0 12px rgba(205, 183, 143, 0.30)',
                  }}
                >
                  İlana Git
                </a>
              )}
            </div>
          </div>
        )}

        {/* Sohbet istatistik — kompakt */}
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(205, 183, 143, 0.08)' }}>
          <div className="text-[10px] tracking-[0.25em] uppercase mb-2.5" style={{ color: '#cdb78f' }}>
            Sohbet
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span style={{ color: '#928678' }}>Başladı</span>
              <span className="font-bold" style={{ color: '#ede4d3' }}>{startedLabel}</span>
            </div>
            {c.lastMessageAt && (
              <div className="flex justify-between items-center">
                <span style={{ color: '#928678' }}>Son mesaj</span>
                <span className="font-bold" style={{ color: '#ede4d3' }}>{formatRelative(c.lastMessageAt)}</span>
              </div>
            )}
            {c.unreadCount > 0 && (
              <div className="flex justify-between items-center">
                <span style={{ color: '#928678' }}>Okunmamış</span>
                <span
                  className="font-bold text-[10px] px-2 py-0.5 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #d4a853 0%, #b8902d 100%)', color: '#1a1208',
                    color: '#ffffff',
                  }}
                >
                  {c.unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Hizli islemler */}
        <div className="px-5 py-4 space-y-2 flex-1">
          <div className="text-[10px] tracking-[0.25em] uppercase mb-1" style={{ color: '#cdb78f' }}>
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
              background: 'rgba(27, 24, 21, 0.75)',
              color: '#cdb78f',
              border: '1px solid rgba(205, 183, 143, 0.10)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#cdb78f" strokeWidth={2.2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
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
              background: 'rgba(27, 24, 21, 0.75)',
              color: '#cdb78f',
              border: '1px solid rgba(205, 183, 143, 0.10)',
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#cdb78f" strokeWidth={2.2} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5 19.5 4.5m0 0v15m0-15h-15" /></svg>
            <span className="font-semibold">İlanı Görüntüle</span>
          </button>
          {/* FAZ 11.W3.1 — Business: basvuruyu split-view'da ac (Wave 2 URL entegrasyonu) */}
          {userRole === 'BUSINESS_OWNER' && c.applicationId && (
            <button
              onClick={() => navigate?.(`/business?tab=applications&id=${c.applicationId}`)}
              className="w-full text-left text-[12px] px-3 py-2.5 rounded-lg flex items-center gap-2.5 transition-all hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 168, 83, 0.16) 0%, rgba(184, 144, 45, 0.10) 100%)',
                color: '#d4a853',
                border: '1px solid rgba(212, 168, 83, 0.35)',
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
        <div className="px-5 py-3 border-t text-center" style={{ borderColor: 'rgba(205, 183, 143, 0.08)' }}>
          <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: '#8a7349' }}>
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
